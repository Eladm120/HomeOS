"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Droplets, Leaf, Loader2, Search, Sparkles, Sun, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addPlantCare, deletePlant, identifyPlant, savePlant, waterPlant } from "@/server/actions/admin";
import type { Plant, PlantCareEvent, Room } from "@/lib/types";
import { LIGHT_LABEL } from "@/lib/labels";
import { addDays, daysUntil, formatShortDate, relativeDays, todayInZone } from "@/lib/format";
import { primeSignedUrls } from "@/lib/media";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { AddButton, Panel, PanelHeading } from "@/components/ui/panel";
import { PhotoPicker } from "@/components/media/photo-picker";
import { SignedImage } from "@/components/media/signed-image";
import { Emoji3D } from "@/components/ui/emoji-3d";

export function nextWatering(p: Pick<Plant, "last_watered_on" | "watering_interval_days">): string {
  return p.last_watered_on ? addDays(p.last_watered_on, p.watering_interval_days) : todayInZone();
}

function WaterBadge({ p }: { p: Plant }) {
  const d = daysUntil(nextWatering(p));
  if (d <= 0) return <Badge tone={d < 0 ? "danger" : "amber"}>{d < 0 ? `צמא · ${relativeDays(d)}` : "להשקות היום"}</Badge>;
  return <Badge>השקיה {relativeDays(d)}</Badge>;
}

/** A 3D picture that fits the plant until the household photographs it. */
export function plantEmoji(p: Pick<Plant, "name" | "species">): string {
  const t = `${p.name} ${p.species ?? ""}`;
  if (/קקטוס|סוקולנט|אלוורה|cact|succul|aloe/i.test(t)) return "🌵";
  if (/בזיליקום|נענע|רוזמרין|תבלין|פטרוזיליה|כוסברה|basil|mint|herb/i.test(t)) return "🌿";
  if (/סחלב|ורד|פרח|טוליפ|orchid|rose|tulip/i.test(t)) return "🌷";
  if (/חמני|sunflower/i.test(t)) return "🌻";
  if (/דקל|palm/i.test(t)) return "🌴";
  if (/פיקוס|עץ|ficus|tree/i.test(t)) return "🌳";
  if (/נבט|שתיל|seed/i.test(t)) return "🌱";
  return "🪴";
}

function PlantPicture({ p, className, emojiClass }: { p: Plant; className?: string; emojiClass?: string }) {
  if (p.image_path) return <SignedImage path={p.image_path} alt={p.name} className={cn("object-cover", className)} />;
  return (
    <span className={cn("grid place-items-center", className)}>
      <Emoji3D emoji={plantEmoji(p)} className={emojiClass} />
    </span>
  );
}

function wateredText(p: Plant): string {
  if (!p.last_watered_on) return "עוד לא הושקה";
  const d = -daysUntil(p.last_watered_on);
  return d <= 0 ? "הושקה היום" : d === 1 ? "הושקה אתמול" : `הושקה לפני ${d} ימים`;
}

function nextText(p: Plant): string {
  const d = daysUntil(nextWatering(p));
  return d < 0 ? `צמא · ${relativeDays(d)}` : d === 0 ? "היום" : relativeDays(d);
}

/**
 * Plants, like a plant-care app: the plant that needs you most as a big hero
 * (picture, last watering, next watering, light), then every plant as a card
 * with its picture and a green water button.
 */
export function PlantsView({ householdId, plants, rooms, signedUrls, aiEnabled }: { householdId: string; plants: Plant[]; rooms: Room[]; signedUrls: Record<string, string>; aiEnabled: boolean }) {
  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  useOpenFromQuery(() => setSheet(true));
  const sorted = [...plants].sort((a, b) => nextWatering(a).localeCompare(nextWatering(b)));
  const thirsty = plants.filter((p) => daysUntil(nextWatering(p)) <= 0).length;
  const shown = sorted.filter((p) => !query.trim() || `${p.name} ${p.species ?? ""}`.includes(query.trim()));
  const hero = sorted[0];
  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name;
  const today = todayInZone();

  async function water(p: Plant) {
    setBusy(p.id);
    const r = await waterPlant(p.id);
    setBusy(null);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`${p.name} הושקה 💧`);
    router.refresh();
  }

  return (
    <>
      <PageHeader title="צמחים" back={{ href: "/household", label: "משק הבית" }} subtitle={plants.length ? (thirsty ? `${thirsty} צריכים מים` : "כולם מושקים") : "השקיה ותזכורות"} actions={<AddButton onClick={() => setSheet(true)} label="צמח" />} />
      {plants.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-10 text-center">
          <Emoji3D emoji="🪴" className="mb-3 size-24 text-[64px]" />
          <p className="title-2">עוד אין צמחים</p>
          <p className="mt-1 max-w-xs text-[14px] text-muted">צלמו צמח, HomeOS ינסה לזהות אותו ויציע כל כמה ימים להשקות.</p>
          <Button className="mt-4" onClick={() => setSheet(true)}>
            <Leaf /> הוספת צמח
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <label className="flex h-12 items-center gap-2.5 rounded-full bg-surface px-4 shadow-[var(--card-shadow)]">
            <Search className="size-[18px] text-muted" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש צמח" aria-label="חיפוש צמח" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted" />
          </label>

          {hero && !query && (
            <section aria-label={hero.name} className="relative isolate flex min-h-[200px] gap-3 overflow-hidden rounded-[1.75rem] bg-[linear-gradient(150deg,color-mix(in_oklab,var(--sage)_22%,var(--surface)),var(--surface)_70%)] p-3 shadow-[var(--card-shadow)]">
              <Link href={`/plants/${hero.id}`} className="relative w-[46%] shrink-0 overflow-hidden rounded-[1.375rem]">
                <PlantPicture p={hero} className="absolute inset-0 size-full" emojiClass="size-[88%] text-[90px]" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-2 py-1">
                <div>
                  <Link href={`/plants/${hero.id}`} className="block truncate text-[19px] font-bold">
                    {hero.name}
                  </Link>
                  <p className="text-[12.5px] text-muted">{wateredText(hero)}</p>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-surface/80 p-2 shadow-[inset_0_0_0_0.5px_var(--border)]">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sage text-white dark:text-[var(--accent-ink)]">
                    <Droplets className="size-4" />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-[11.5px] text-muted">השקיה הבאה</span>
                    <span className={cn("block truncate text-[14px] font-bold", daysUntil(nextWatering(hero)) <= 0 ? "text-terracotta" : "text-sage")}>{nextText(hero)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-surface/80 p-2 shadow-[inset_0_0_0_0.5px_var(--border)]">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fill">
                    <Sun className="size-4" />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-[11.5px] text-muted">{roomName(hero.room_id) ?? "אור"}</span>
                    <span className="block truncate text-[14px] font-bold">{hero.light ? LIGHT_LABEL[hero.light] : `כל ${hero.watering_interval_days} ימים`}</span>
                  </span>
                </div>
                <Button size="sm" className="mt-auto" onClick={() => water(hero)} loading={busy === hero.id} disabled={hero.last_watered_on === today}>
                  <Droplets /> {hero.last_watered_on === today ? "הושקה היום" : "השקיתי"}
                </Button>
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2.5 px-1 text-[19px] font-bold">כל הצמחים</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {shown.map((p) => {
                const due = daysUntil(nextWatering(p));
                const done = p.last_watered_on === today;
                return (
                  <div key={p.id} className="card relative flex flex-col overflow-hidden rounded-[1.5rem] p-2.5">
                    <span aria-hidden className={cn("absolute top-3.5 start-3.5 z-10 grid size-8 place-items-center rounded-full bg-surface/90 shadow-sm", due <= 0 ? "text-terracotta" : "text-sage")}>
                      <Droplets className="size-4" />
                    </span>
                    <Link href={`/plants/${p.id}`} className="block">
                      <PlantPicture p={p} className="aspect-[1/0.95] w-full rounded-[1.125rem] bg-[color-mix(in_oklab,var(--sage)_12%,var(--surface-2))]" emojiClass="size-[78%] text-[64px]" />
                    </Link>
                    <div className="flex items-end gap-2 px-1 pt-2.5">
                      <Link href={`/plants/${p.id}`} className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold">{p.name}</span>
                        <span className={cn("block truncate text-[12.5px]", due <= 0 ? "font-semibold text-terracotta" : "text-muted")}>{due <= 0 ? (due < 0 ? `צמא · ${relativeDays(due)}` : "להשקות היום") : `השקיה ${relativeDays(due)}`}</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => water(p)}
                        disabled={busy === p.id || done}
                        aria-label={done ? `${p.name} הושקה היום` : `השקיתי את ${p.name}`}
                        className={cn("pressable grid size-10 shrink-0 place-items-center rounded-[14px] transition-colors", done ? "bg-fill text-sage" : "bg-sage text-white dark:text-[var(--accent-ink)]")}
                      >
                        {busy === p.id ? <Loader2 className="size-[18px] animate-spin" /> : done ? <Check className="size-[18px]" strokeWidth={3} /> : <Leaf className="size-[18px]" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
      <PlantSheet open={sheet} onOpenChange={setSheet} householdId={householdId} plant={null} rooms={rooms} aiEnabled={aiEnabled} />
    </>
  );
}

export function PlantSheet({ open, onOpenChange, householdId, plant, rooms, aiEnabled }: { open: boolean; onOpenChange: (o: boolean) => void; householdId: string; plant: Plant | null; rooms: Room[]; aiEnabled: boolean }) {
  const router = useRouter();
  const blank = { name: "", species: "", room_id: "", location_note: "", image_path: null as string | null, watering_interval_days: "7", light: "" as string, notes: "", identified_by_ai: false, ai_confidence: null as number | null };
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setSuggestion(null);
    setF(
      plant
        ? { name: plant.name, species: plant.species ?? "", room_id: plant.room_id ?? "", location_note: plant.location_note ?? "", image_path: plant.image_path, watering_interval_days: String(plant.watering_interval_days), light: plant.light ?? "", notes: plant.notes ?? "", identified_by_ai: plant.identified_by_ai, ai_confidence: plant.ai_confidence }
        : blank,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when opened
  }, [open, plant]);

  async function identify(path: string) {
    if (!aiEnabled) return;
    setIdentifying(true);
    const r = await identifyPlant(path);
    setIdentifying(false);
    if (!r.ok) return void toast.error(r.error);
    if (!r.data.is_plant) return void setSuggestion("לא זיהינו צמח בתמונה.");
    setF((x) => ({
      ...x,
      name: x.name || r.data.common_name_he,
      species: r.data.species,
      watering_interval_days: String(r.data.watering_interval_days),
      light: r.data.light,
      notes: x.notes || r.data.care_tips,
      identified_by_ai: true,
      ai_confidence: Math.round(r.data.confidence * 100) / 100,
    }));
    setSuggestion(`הצעה: ${r.data.common_name_he} (${r.data.species}) · ודאות ${Math.round(r.data.confidence * 100)}%. זו הערכה — אפשר לתקן.`);
  }

  async function save() {
    setSaving(true);
    const r = await savePlant(plant?.id ?? null, { ...f, light: (f.light || null) as Plant["light"] });
    setSaving(false);
    if (!r.ok) return void toast.error(r.error);
    onOpenChange(false);
    if (!plant) router.push(`/plants/${r.data.id}`);
    else router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={plant ? "עריכת צמח" : "צמח חדש"}
      footer={
        <Button size="lg" className="w-full" onClick={save} loading={saving} disabled={!f.name.trim()}>
          שמירה
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <PhotoPicker
          householdId={householdId}
          module="plants"
          value={f.image_path}
          onChange={(p) => {
            setF((x) => ({ ...x, image_path: p }));
            if (p && !plant) void identify(p);
          }}
        />
        {identifying && (
          <p className="flex items-center gap-2 text-[14px] text-muted">
            <Loader2 className="size-4 animate-spin" /> מזהה את הצמח…
          </p>
        )}
        {suggestion && (
          <p className="flex gap-2 rounded-2xl bg-primary-soft px-3 py-2 text-[14px]">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" /> {suggestion}
          </p>
        )}
        {plant && f.image_path && aiEnabled && (
          <Button variant="ghost" size="sm" onClick={() => identify(f.image_path!)} disabled={identifying}>
            <Sparkles /> לזהות מהתמונה
          </Button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="שם" htmlFor="pl-name">
            <Input id="pl-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="מונסטרה" />
          </Field>
          <Field label="סוג (מדעי)" htmlFor="pl-species">
            <Input id="pl-species" dir="ltr" value={f.species} onChange={(e) => setF({ ...f, species: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="השקיה כל (ימים)" htmlFor="pl-int">
            <Input id="pl-int" inputMode="numeric" value={f.watering_interval_days} onChange={(e) => setF({ ...f, watering_interval_days: e.target.value })} />
          </Field>
          <Field label="אור" htmlFor="pl-light">
            <Select id="pl-light" value={f.light} onChange={(e) => setF({ ...f, light: e.target.value })}>
              <option value="">—</option>
              {Object.entries(LIGHT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="חדר" htmlFor="pl-room">
            <Select id="pl-room" value={f.room_id} onChange={(e) => setF({ ...f, room_id: e.target.value })}>
              <option value="">—</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="איפה בדיוק" htmlFor="pl-loc">
            <Input id="pl-loc" value={f.location_note} onChange={(e) => setF({ ...f, location_note: e.target.value })} placeholder="ליד החלון" />
          </Field>
        </div>
        <Field label="הערות טיפול" htmlFor="pl-notes">
          <Textarea id="pl-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Sheet>
  );
}

const CARE_LABEL: Record<PlantCareEvent["kind"], string> = { water: "💧 השקיה", fertilize: "🌱 דישון", repot: "🪴 העברת עציץ", prune: "✂️ גיזום", note: "📝 הערה" };

export function PlantDetail({ householdId, plant: p, history, rooms, aiEnabled, members }: { householdId: string; plant: Plant; history: PlantCareEvent[]; rooms: Room[]; aiEnabled: boolean; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const watered = p.last_watered_on === todayInZone();
  return (
    <>
      <PageHeader title={p.name} back={{ href: "/plants", label: "צמחים" }} subtitle={p.species ?? undefined} actions={<Button size="sm" variant="secondary" onClick={() => setEdit(true)}>עריכה</Button>} />
      <div className="space-y-6 pb-10">
        {p.image_path ? <SignedImage path={p.image_path} alt={p.name} className="aspect-[4/3] w-full rounded-[var(--radius)] border border-border" thumb={false} /> : null}
        <section className="flex flex-wrap items-center gap-2">
          <WaterBadge p={p} />
          {p.identified_by_ai && <Badge>זוהה בעזרת AI{p.ai_confidence != null ? ` · ${Math.round(p.ai_confidence * 100)}%` : ""}</Badge>}
        </section>
        <Button
          size="lg"
          className="w-full"
          disabled={watered}
          onClick={async () => {
            const r = await waterPlant(p.id);
            if (!r.ok) return void toast.error(r.error);
            toast.success("נרשמה השקיה 💧");
            router.refresh();
          }}
        >
          <Droplets /> {watered ? "הושקה היום" : "השקיתי עכשיו"}
        </Button>
        <Panel>
          {[
            ["השקיה", `כל ${p.watering_interval_days} ימים`],
            ["הושקה לאחרונה", p.last_watered_on ? formatShortDate(p.last_watered_on) : "עוד לא"],
            ["ההשקיה הבאה", formatShortDate(nextWatering(p))],
            ["אור", p.light ? LIGHT_LABEL[p.light] : null],
            ["מיקום", [rooms.find((r) => r.id === p.room_id)?.name, p.location_note].filter(Boolean).join(" · ") || null],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between px-4 py-3 text-[15px]">
                <span className="text-muted">{k}</span>
                <span>{v}</span>
              </div>
            ))}
          {p.notes && <p className="px-4 py-3 text-[15px] whitespace-pre-wrap">{p.notes}</p>}
        </Panel>
        <section>
          <PanelHeading title="טיפול" />
          <div className="mb-3 flex flex-wrap gap-2">
            {(["fertilize", "repot", "prune"] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const r = await addPlantCare(p.id, k, null);
                  if (!r.ok) return void toast.error(r.error);
                  router.refresh();
                }}
              >
                {CARE_LABEL[k]}
              </Button>
            ))}
          </div>
          <form
            className="mb-3 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!note.trim()) return;
              const r = await addPlantCare(p.id, "note", note.trim());
              if (!r.ok) return void toast.error(r.error);
              setNote("");
              router.refresh();
            }}
          >
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="הערה (עלה צהוב, פרח חדש…)" aria-label="הערה" />
            <Button type="submit" variant="secondary">
              הוספה
            </Button>
          </form>
          {history.length > 0 && (
            <Panel>
              {history.map((h) => (
                <div key={h.id} className={cn("flex justify-between gap-3 px-4 py-2.5 text-[15px]")}>
                  <span>
                    {CARE_LABEL[h.kind]}
                    {h.note ? <span className="footnote block text-muted">{h.note}</span> : null}
                  </span>
                  <span className="footnote text-muted">
                    {formatShortDate(h.performed_on)}
                    {members.find((m) => m.id === h.created_by) ? ` · ${members.find((m) => m.id === h.created_by)!.name}` : ""}
                  </span>
                </div>
              ))}
            </Panel>
          )}
        </section>
        <Button variant="danger-ghost" className="w-full" onClick={() => setConfirm(true)}>
          <Trash2 /> מחיקת הצמח
        </Button>
      </div>
      <PlantSheet open={edit} onOpenChange={setEdit} householdId={householdId} plant={p} rooms={rooms} aiEnabled={aiEnabled} />
      <ConfirmSheet
        open={confirm}
        onOpenChange={setConfirm}
        title={`למחוק את ${p.name}?`}
        confirmLabel="מחיקה"
        destructive
        onConfirm={async () => {
          const r = await deletePlant(p.id);
          if (!r.ok) return void toast.error(r.error);
          router.push("/plants");
        }}
      />
    </>
  );
}
