"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Droplets, Leaf, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addPlantCare, deletePlant, identifyPlant, savePlant, waterPlant } from "@/server/actions/admin";
import type { Plant, PlantCareEvent, Room } from "@/lib/types";
import { LIGHT_LABEL } from "@/lib/labels";
import { addDays, daysUntil, formatShortDate, relativeDays, todayInZone } from "@/lib/format";
import { primeSignedUrls } from "@/lib/media";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { AddButton, Panel, PanelHeading } from "@/components/ui/panel";
import { PhotoPicker } from "@/components/media/photo-picker";
import { SignedImage } from "@/components/media/signed-image";

export function nextWatering(p: Pick<Plant, "last_watered_on" | "watering_interval_days">): string {
  return p.last_watered_on ? addDays(p.last_watered_on, p.watering_interval_days) : todayInZone();
}

function WaterBadge({ p }: { p: Plant }) {
  const d = daysUntil(nextWatering(p));
  if (d <= 0) return <Badge tone={d < 0 ? "danger" : "amber"}>{d < 0 ? `צמא · ${relativeDays(d)}` : "להשקות היום"}</Badge>;
  return <Badge>השקיה {relativeDays(d)}</Badge>;
}

export function PlantsView({ householdId, plants, rooms, signedUrls, aiEnabled }: { householdId: string; plants: Plant[]; rooms: Room[]; signedUrls: Record<string, string>; aiEnabled: boolean }) {
  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useOpenFromQuery(() => setSheet(true));
  const sorted = [...plants].sort((a, b) => nextWatering(a).localeCompare(nextWatering(b)));
  const thirsty = plants.filter((p) => daysUntil(nextWatering(p)) <= 0).length;

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
        <EmptyState icon={<Leaf />} title="עוד אין צמחים" description="צלמו צמח, HomeOS ינסה לזהות אותו ויציע כל כמה ימים להשקות." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sorted.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
              <Link href={`/plants/${p.id}`} className="block">
                {p.image_path ? (
                  <SignedImage path={p.image_path} alt={p.name} className="aspect-square w-full" />
                ) : (
                  <span className="cat-tint grid aspect-square w-full place-items-center text-[48px]" style={{ "--h": 140 } as React.CSSProperties}>
                    🪴
                  </span>
                )}
              </Link>
              <div className="space-y-2 p-3">
                <Link href={`/plants/${p.id}`} className="block truncate font-semibold">
                  {p.name}
                </Link>
                <WaterBadge p={p} />
                <Button size="sm" variant="soft" className="w-full" onClick={() => water(p)} loading={busy === p.id} disabled={p.last_watered_on === todayInZone()}>
                  <Droplets /> {p.last_watered_on === todayInZone() ? "הושקה היום" : "השקיתי"}
                </Button>
              </div>
            </div>
          ))}
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
