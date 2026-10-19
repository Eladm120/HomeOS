"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Copy, Heart, Plus, ShoppingCart, Sparkles, UtensilsCrossed, WandSparkles, X } from "lucide-react";
import { toast } from "sonner";
import { copyMealWeek, deleteMealEntry, saveMealEntry } from "@/server/actions/meals";
import { addIngredientsToList } from "@/server/actions/recipes";
import type { MealPlanEntry, MealSlot } from "@/lib/types";
import type { ShoppingProposal } from "@/lib/ingredients";
import { MEAL_SLOT, options } from "@/lib/labels";
import { addDays, formatQuantity, todayInZone } from "@/lib/format";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { primeSignedUrls } from "@/lib/media";
import { RecipeImage } from "./recipes-view";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const DAY_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export interface MealSuggestion {
  recipeId: string;
  title: string;
  reason: string;
  image_path?: string | null;
  image_url?: string | null;
}

type MealEntry = MealPlanEntry & {
  recipe_title: string | null;
  recipe_image_path?: string | null;
  recipe_image_url?: string | null;
  recipe_minutes?: number | null;
};

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

/**
 * Weekly meal planner: a week strip on top (like a calendar), then each day as
 * a card with its meals as photos — slot, dish, time and whether the home has
 * what it needs. An empty week gets one inviting card with real next steps,
 * including "build my week" from what can be cooked now.
 */
export function MealsView({
  householdId,
  weekStart,
  entries,
  recipes,
  shortfalls,
  suggestions,
  signedUrls = {},
}: {
  householdId: string;
  weekStart: string;
  entries: MealEntry[];
  recipes: { id: string; title: string; servings: number | null }[];
  shortfalls: ShoppingProposal[];
  suggestions: MealSuggestion[];
  signedUrls?: Record<string, string>;
}) {
  useRealtimeRefresh("meal_plan_entries", householdId);
  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);
  const router = useRouter();
  const today = todayInZone();
  const [sheet, setSheet] = useState<{ date: string; slot: MealSlot; recipeId?: string } | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [building, setBuilding] = useState(false);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isThisWeek = days.includes(today);
  const fmt = (iso: string) => new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const dayNum = (iso: string) => Number(iso.slice(8, 10));
  const missingFor = (title: string | null) => (title ? shortfalls.filter((s) => s.sources.includes(title)).length : 0);
  const planned = new Set(entries.map((e) => e.plan_date));

  async function addToList() {
    const items = shortfalls.filter((s) => picked[s.key] !== false).map((s) => ({ name: s.name, quantity: s.quantity, unit: s.unit, inventory_item_id: s.inventory_item_id, note: `לתפריט: ${s.sources.slice(0, 3).join(", ")}`.slice(0, 200) }));
    if (!items.length) return setShopOpen(false);
    setAdding(true);
    const res = await addIngredientsToList({ items });
    setAdding(false);
    if (!res.ok) return void toast.error(res.error);
    setShopOpen(false);
    toast.success(`${res.data.added + res.data.merged} מצרכים ברשימת הקניות`, { action: { label: "לרשימה", onClick: () => router.push("/shopping") } });
  }

  /** "Build my week": each suggestion becomes dinner on the next day (from today) that has no dinner yet. */
  async function buildWeek() {
    const free = days.filter((d) => d >= (isThisWeek ? today : weekStart) && !entries.some((e) => e.plan_date === d && e.slot === "dinner"));
    const plan = suggestions.slice(0, free.length).map((sg, i) => ({ date: free[i], sg }));
    if (!plan.length) return void toast("אין כרגע הצעות — הוסיפו מתכונים או מלאי");
    setBuilding(true);
    let saved = 0;
    for (const { date, sg } of plan) {
      const res = await saveMealEntry(null, { plan_date: date, slot: "dinner", recipe_id: sg.recipeId, title: null, servings: "", notes: "" });
      if (res.ok) saved++;
      else toast.error(res.error);
    }
    setBuilding(false);
    if (saved) toast.success(`תוכננו ${saved} ארוחות ערב`);
    router.refresh();
  }

  async function copyLastWeek() {
    const res = await copyMealWeek(addDays(weekStart, -7), weekStart);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.data.copied ? `הועתקו ${res.data.copied} ארוחות מהשבוע הקודם` : "בשבוע הקודם לא היה תכנון");
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="תכנון ארוחות"
        back={{ href: "/recipes", label: "מתכונים" }}
        subtitle={`${fmt(days[0])} – ${fmt(days[6])}${entries.length ? ` · ${entries.length} ארוחות` : ""}`}
        actions={
          <div className="flex items-center gap-1.5">
            <Link href={`/meals?week=${addDays(weekStart, -7)}`} aria-label="שבוע קודם" className="pressable grid size-10 place-items-center rounded-full bg-surface shadow-[var(--card-shadow)]">
              <ChevronRight className="size-5" />
            </Link>
            <Link href={`/meals?week=${addDays(weekStart, 7)}`} aria-label="שבוע הבא" className="pressable grid size-10 place-items-center rounded-full bg-surface shadow-[var(--card-shadow)]">
              <ChevronLeft className="size-5" />
            </Link>
          </div>
        }
      />

      {/* Week strip */}
      <div className="card mb-5 p-2">
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            const isToday = d === today;
            return (
              <a
                key={d}
                href={`#day-${d}`}
                className={cn("pressable flex flex-col items-center gap-1 rounded-full py-2.5 transition-colors", isToday ? "bg-primary text-primary-foreground" : "bg-surface-2")}
              >
                <span className="num text-[17px] leading-none font-bold">{dayNum(d)}</span>
                <span className={cn("text-[11px] leading-none", isToday ? "opacity-80" : "text-muted")}>{DAY_SHORT[i]}</span>
                <span aria-hidden className={cn("size-1.5 rounded-full", planned.has(d) ? (isToday ? "bg-primary-foreground" : "bg-primary") : "bg-transparent")} />
              </a>
            );
          })}
        </div>
        {!isThisWeek && (
          <Link href="/meals" className="mt-2 block text-center text-[13px] font-semibold text-primary">
            חזרה לשבוע הנוכחי
          </Link>
        )}
      </div>

      {entries.length === 0 ? (
        <section className="hero mb-5 p-5 text-center">
          <span aria-hidden className="mx-auto mb-3 grid size-16 place-items-center rounded-[22px] bg-primary text-primary-foreground">
            <CalendarDays className="size-8" strokeWidth={1.8} />
          </span>
          <h2 className="title-2">עדיין לא תכננתם את השבוע</h2>
          <p className="hero-muted mx-auto mt-1 max-w-xs text-[14px]">בחרו מתכונים, או תנו ל־HomeOS להציע תפריט לפי מה שיש בבית.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={buildWeek} loading={building} disabled={!suggestions.length}>
              <WandSparkles /> בנה לי שבוע
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/recipes/new">
                <Plus /> הוסף מתכון
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/recipes?filter=favorites">
                <Heart /> מועדפים
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {suggestions.length > 0 && (
        <section className="mb-5">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-primary">
              <Sparkles className="size-4" /> הצעות לפי מה שיש בבית
            </h2>
            {entries.length > 0 && (
              <button type="button" onClick={buildWeek} disabled={building} className="flex items-center gap-1 text-[13px] font-semibold text-primary disabled:opacity-50">
                <WandSparkles className="size-4" /> השלמת השבוע
              </button>
            )}
          </div>
          <div className="scrollbar-none -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1">
            {suggestions.map((sg) => (
              <div key={sg.recipeId} className="card w-[220px] shrink-0 snap-start overflow-hidden">
                <Link href={`/recipes/${sg.recipeId}`} className="relative block h-24">
                  <RecipeImage r={{ title: sg.title, image_path: sg.image_path ?? null, image_url: sg.image_url ?? null }} className="absolute inset-0 size-full text-[34px]" />
                </Link>
                <div className="flex items-center gap-2 p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{sg.title}</span>
                    <span className="block truncate text-[12px] text-muted">{sg.reason}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`לתכנן ${sg.title}`}
                    onClick={() => setSheet({ date: isThisWeek ? today : weekStart, slot: "dinner", recipeId: sg.recipeId })}
                    className="pressable grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Plus className="size-[18px]" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-3">
        {days.map((d, i) => {
          const dayEntries = SLOTS.flatMap((slot) => entries.filter((e) => e.plan_date === d && e.slot === slot));
          const isToday = d === today;
          const past = d < today;
          return (
            <section key={d} id={`day-${d}`} className={cn("card scroll-mt-24 p-3", isToday && "shadow-[0_0_0_1.5px_var(--primary),var(--card-shadow)]", past && "opacity-70")}>
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="flex items-baseline gap-2 text-[17px] font-semibold [font-family:var(--font-display)]">
                  יום {DAY_NAMES[i]}
                  <span className="num text-[13px] font-normal text-muted">{fmt(d)}</span>
                  {isToday && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">היום</span>}
                </h2>
                <button type="button" onClick={() => setSheet({ date: d, slot: "dinner" })} className="pressable grid size-8 place-items-center rounded-full bg-fill text-primary" aria-label={`הוספת ארוחה ליום ${DAY_NAMES[i]}`}>
                  <Plus className="size-[18px]" />
                </button>
              </div>
              {dayEntries.length ? (
                <div className="scrollbar-none -mx-3 flex snap-x gap-2.5 overflow-x-auto px-3">
                  {dayEntries.map((e) => {
                    const title = e.recipe_id ? (e.recipe_title ?? "מתכון") : (e.title ?? "");
                    const missing = e.recipe_id ? missingFor(e.recipe_title) : 0;
                    const card = (
                      <>
                        <RecipeImage r={{ title, image_path: e.recipe_image_path ?? null, image_url: e.recipe_image_url ?? null }} className="absolute inset-0 size-full text-[40px]" />
                        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                        <span className="absolute top-2 start-2 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">{MEAL_SLOT[e.slot]}</span>
                        <span className="absolute inset-x-0 bottom-0 p-2.5 text-white">
                          <span className="block truncate text-[15px] leading-tight font-semibold">{title}</span>
                          <span className="mt-1 flex items-center gap-1.5 text-[11px]">
                            {e.recipe_minutes ? (
                              <span className="flex items-center gap-0.5 opacity-85">
                                <Clock className="size-3" />
                                <span className="num">{e.recipe_minutes}</span> דק׳
                              </span>
                            ) : null}
                            {e.recipe_id && (
                              <span className={cn("rounded-full px-1.5 py-px font-bold", missing ? "bg-terracotta text-white" : "bg-white/25")}>{missing ? `חסרים ${missing}` : "יש מצרכים"}</span>
                            )}
                            {e.servings ? <span className="num opacity-85">{formatQuantity(e.servings)} מנות</span> : null}
                          </span>
                        </span>
                      </>
                    );
                    return (
                      <div key={e.id} className="relative h-[150px] w-[168px] shrink-0 snap-start overflow-hidden rounded-[1.125rem]">
                        {e.recipe_id ? (
                          <Link href={`/recipes/${e.recipe_id}`} className="absolute inset-0">
                            {card}
                          </Link>
                        ) : (
                          <div className="absolute inset-0">{card}</div>
                        )}
                        <button
                          type="button"
                          aria-label={`הסרת ${title}`}
                          className="absolute top-2 end-2 grid size-7 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md"
                          onClick={async () => {
                            const r = await deleteMealEntry(e.id);
                            if (!r.ok) toast.error(r.error);
                            router.refresh();
                          }}
                        >
                          <X className="size-3.5" strokeWidth={2.75} />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setSheet({ date: d, slot: "dinner" })}
                    className="pressable grid h-[150px] w-[90px] shrink-0 snap-start place-items-center rounded-[1.125rem] border border-dashed border-border text-[13px] font-medium text-primary"
                  >
                    <span className="flex flex-col items-center gap-1">
                      <Plus className="size-5" /> ארוחה
                    </span>
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setSheet({ date: d, slot: "dinner" })} className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-3 text-start text-[14px] text-muted">
                  <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-fill">
                    <UtensilsCrossed className="size-[18px]" />
                  </span>
                  {past ? "לא תוכנן" : "מה אוכלים? הוספת ארוחה"}
                </button>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 pb-28">
        <Button variant="secondary" onClick={copyLastWeek}>
          <Copy /> כמו בשבוע שעבר
        </Button>
      </div>

      {shortfalls.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.6rem+62px+10px)] z-30 px-4 lg:start-72 lg:bottom-6">
          <div className="mx-auto max-w-md lg:max-w-xl">
            <Button size="lg" className="w-full shadow-lift" onClick={() => setShopOpen(true)}>
              <ShoppingCart /> חסרים {shortfalls.length} מצרכים לתפריט · לרשימה
            </Button>
          </div>
        </div>
      )}

      <Sheet
        open={shopOpen}
        onOpenChange={setShopOpen}
        title="מצרכים חסרים לשבוע"
        description="מחושב מול המלאי. מה שכבר ברשימה יעודכן."
        footer={
          <Button size="lg" className="w-full" onClick={addToList} loading={adding}>
            הוספה לרשימת הקניות
          </Button>
        }
      >
        <Panel>
          {shortfalls.map((s) => (
            <label key={s.key} className="flex items-center gap-3 px-4 py-3">
              <input type="checkbox" checked={picked[s.key] !== false} onChange={(e) => setPicked((p) => ({ ...p, [s.key]: e.target.checked }))} className="size-5 accent-[var(--primary)]" />
              <span className="min-w-0 flex-1">
                <span className="block">{s.name}</span>
                <span className="footnote block truncate text-muted">{s.sources.join(", ")}</span>
              </span>
              <span className="num shrink-0 text-muted">
                {formatQuantity(s.quantity)} {s.unit}
              </span>
            </label>
          ))}
        </Panel>
      </Sheet>

      <MealSheet state={sheet} onClose={() => setSheet(null)} recipes={recipes} />
    </>
  );
}

function MealSheet({ state, onClose, recipes }: { state: { date: string; slot: MealSlot; recipeId?: string } | null; onClose: () => void; recipes: { id: string; title: string; servings: number | null }[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [recipeId, setRecipeId] = useState("");
  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [seen, setSeen] = useState<typeof state>(null);
  if (state !== seen) {
    setSeen(state);
    if (state) {
      setDate(state.date);
      setSlot(state.slot);
      setRecipeId(state.recipeId ?? "");
      setTitle("");
      setServings("");
      setNotes("");
    }
  }

  return (
    <Sheet
      open={!!state}
      onOpenChange={(o) => !o && onClose()}
      title="ארוחה בתכנון"
      footer={
        <Button
          size="lg"
          className="w-full"
          loading={saving}
          disabled={!recipeId && !title.trim()}
          onClick={async () => {
            setSaving(true);
            const res = await saveMealEntry(null, { plan_date: date, slot, recipe_id: recipeId || null, title: recipeId ? null : title, servings, notes });
            setSaving(false);
            if (!res.ok) return void toast.error(res.error);
            onClose();
            router.refresh();
          }}
        >
          הוספה
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="יום" htmlFor="ml-date">
            <Input id="ml-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="ארוחה" htmlFor="ml-slot">
            <Select id="ml-slot" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
              {options(MEAL_SLOT).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="מתכון" htmlFor="ml-recipe">
          <Select id="ml-recipe" value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
            <option value="">בלי מתכון (כתיבה חופשית)</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </Select>
        </Field>
        {!recipeId && (
          <Field label="מה אוכלים?" htmlFor="ml-title">
            <Input id="ml-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="פיצה בחוץ / שאריות" maxLength={160} />
          </Field>
        )}
        <Field label="מנות" htmlFor="ml-serv" hint={recipeId ? "ריק = לפי המתכון" : undefined}>
          <Input id="ml-serv" inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} />
        </Field>
        <Field label="הערה" htmlFor="ml-notes">
          <Textarea id="ml-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" />
        </Field>
      </div>
    </Sheet>
  );
}
