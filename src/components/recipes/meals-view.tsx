"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Coffee, Cookie, Copy, LayoutGrid, Moon, MoveHorizontal, Plus, Replace, ShoppingCart, Sparkles, Sun, Trash2, WandSparkles, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { copyMealWeek, deleteMealEntry, moveMealEntry, saveMealEntry } from "@/server/actions/meals";
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
const SLOT_TITLE: Record<MealSlot, string> = { breakfast: "ארוחת בוקר", lunch: "ארוחת צהריים", dinner: "ארוחת ערב", snack: "נשנוש" };
const SLOT_ICON: Record<MealSlot, LucideIcon> = { breakfast: Coffee, lunch: Sun, dinner: Moon, snack: Cookie };
const SLOT_HUE: Record<MealSlot, number> = { breakfast: 75, lunch: 40, dinner: 280, snack: 330 };

/** One planned meal in the day agenda: photo, time, servings, availability, and what you can do with it. */
function AgendaCard({ e, title, missing, onReplace, onMove, onRemove }: { e: MealEntry; title: string; missing: number | null; onReplace: () => void; onMove: () => void; onRemove: () => void }) {
  const body = (
    <>
      <span className="relative block h-40 overflow-hidden">
        <RecipeImage r={{ title, image_path: e.recipe_image_path ?? null, image_url: e.recipe_image_url ?? null }} className="absolute inset-0 size-full text-[56px]" />
        {missing !== null && (
          <span className={cn("absolute top-2.5 start-2.5 rounded-full px-2.5 py-1 text-[12px] font-bold shadow-sm", missing ? "bg-terracotta text-white" : "bg-surface/95 text-sage")}>
            {missing ? `חסרים ${missing} מצרכים` : "יש הכל בבית"}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2 px-4 pt-3">
        <span className="min-w-0 flex-1 truncate text-[18px] font-bold">{title}</span>
      </span>
      <span className="flex items-center gap-3 px-4 pt-1 text-[13px] text-muted">
        {e.recipe_minutes ? (
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" /> <span className="num">{e.recipe_minutes}</span> דק׳
          </span>
        ) : null}
        {e.servings ? <span className="num">{formatQuantity(e.servings)} מנות</span> : null}
        {!e.recipe_id && <span>בלי מתכון</span>}
      </span>
    </>
  );
  return (
    <div className="card overflow-hidden">
      {e.recipe_id ? (
        <Link href={`/recipes/${e.recipe_id}`} className="block">
          {body}
        </Link>
      ) : (
        <div>{body}</div>
      )}
      <div className="flex gap-1.5 p-3 pt-2.5">
        <button type="button" onClick={onReplace} className="pressable flex h-9 items-center gap-1.5 rounded-full bg-fill px-3 text-[13px] font-semibold">
          <Replace className="size-4" /> החלפה
        </button>
        <button type="button" onClick={onMove} className="pressable flex h-9 items-center gap-1.5 rounded-full bg-fill px-3 text-[13px] font-semibold">
          <MoveHorizontal className="size-4" /> העברה
        </button>
        <span className="flex-1" />
        <button type="button" onClick={onRemove} aria-label={`הסרת ${title}`} className="pressable grid size-9 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger">
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Weekly meal planner, two ways to look at it:
 * - Day: a day selector on top and the selected day as an agenda — breakfast,
 *   lunch and dinner slots with photo cards (time, servings, whether the home
 *   has what it needs), replace / move / remove, and inviting empty slots.
 * - Week: every day at a glance; on desktop a 7-column board where meals are
 *   dragged between days, on phones a compact list (tap a day to open it).
 * "Plan my week" fills empty dinners from what can be cooked with what's home.
 */
export function MealsView({
  householdId,
  weekStart,
  entries,
  recipes,
  shortfalls,
  suggestions,
  signedUrls = {},
  hasStock = true,
}: {
  householdId: string;
  weekStart: string;
  entries: MealEntry[];
  recipes: { id: string; title: string; servings: number | null }[];
  shortfalls: ShoppingProposal[];
  suggestions: MealSuggestion[];
  signedUrls?: Record<string, string>;
  /** Without inventory data, never claim ingredients are (or aren't) at home. */
  hasStock?: boolean;
}) {
  useRealtimeRefresh("meal_plan_entries", householdId);
  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);
  const router = useRouter();
  const today = todayInZone();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isThisWeek = days.includes(today);
  const [selected, setSelected] = useState(isThisWeek ? today : weekStart);
  const [view, setView] = useState<"day" | "week">("day");
  const [sheet, setSheet] = useState<SheetState>(null);
  const [moving, setMoving] = useState<MealEntry | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [building, setBuilding] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const fmt = (iso: string) => new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const dayNum = (iso: string) => Number(iso.slice(8, 10));
  const dayIdx = (iso: string) => days.indexOf(iso);
  const missingFor = (title: string | null) => (title ? shortfalls.filter((s) => s.sources.includes(title)).length : 0);
  const byDay = (d: string) => SLOTS.flatMap((slot) => entries.filter((e) => e.plan_date === d && e.slot === slot));
  const titleOf = (e: MealEntry) => (e.recipe_id ? (e.recipe_title ?? "מתכון") : (e.title ?? ""));

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

  /** "Plan my week": each suggestion becomes dinner on the next day (from today) that has no dinner yet. */
  async function buildWeek() {
    const free = days.filter((d) => d >= (isThisWeek ? today : weekStart) && !entries.some((e) => e.plan_date === d && e.slot === "dinner"));
    const plan = suggestions.slice(0, free.length).map((sg, i) => ({ date: free[i], sg }));
    if (!plan.length) return void toast(free.length ? "אין כרגע הצעות — הוסיפו מתכונים ומלאי" : "כל ארוחות הערב השבוע כבר מתוכננות");
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

  async function move(e: MealEntry, date: string, slot: MealSlot = e.slot) {
    if (date === e.plan_date && slot === e.slot) return;
    const res = await moveMealEntry(e.id, { plan_date: date, slot });
    if (!res.ok) return void toast.error(res.error);
    toast.success(`${titleOf(e)} עבר ליום ${DAY_NAMES[dayIdx(date)] ?? fmt(date)}`);
    router.refresh();
  }

  async function remove(e: MealEntry) {
    const r = await deleteMealEntry(e.id);
    if (!r.ok) return void toast.error(r.error);
    toast(`${titleOf(e)} הוסר מהתכנון`);
    router.refresh();
  }

  const freeDinners = days.filter((d) => d >= (isThisWeek ? today : weekStart) && !entries.some((e) => e.plan_date === d && e.slot === "dinner")).length;
  const selIdx = dayIdx(selected);

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

      {/* Day selector */}
      <div className="card mb-3 p-1.5">
        <div className="grid grid-cols-7 gap-1" role="tablist" aria-label="ימי השבוע">
          {days.map((d, i) => {
            const isSel = d === selected;
            const count = entries.filter((e) => e.plan_date === d).length;
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={isSel}
                onClick={() => {
                  setSelected(d);
                  setView("day");
                }}
                className={cn(
                  "pressable relative flex flex-col items-center gap-1 rounded-2xl py-2.5 transition-colors",
                  isSel ? "bg-primary text-primary-foreground shadow-[0_8px_18px_-10px_var(--accent)]" : "hover:bg-fill",
                  d === today && !isSel && "shadow-[inset_0_0_0_1.5px_var(--primary)]",
                )}
              >
                <span className={cn("text-[11px] leading-none", isSel ? "opacity-85" : "text-muted")}>{DAY_SHORT[i]}</span>
                <span className="num text-[18px] leading-none font-bold">{dayNum(d)}</span>
                <span className="flex h-1.5 gap-0.5" aria-label={count ? `${count} ארוחות` : undefined}>
                  {Array.from({ length: Math.min(count, 3) }, (_, k) => (
                    <span key={k} className={cn("size-1.5 rounded-full", isSel ? "bg-primary-foreground" : "bg-primary")} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-5 flex items-center gap-2">
        <div className="flex rounded-full bg-fill p-1 text-[14px] font-semibold" role="group" aria-label="תצוגה">
          {(
            [
              { v: "day", l: "יום", icon: CalendarDays },
              { v: "week", l: "שבוע", icon: LayoutGrid },
            ] as const
          ).map((o) => (
            <button key={o.v} type="button" aria-pressed={view === o.v} onClick={() => setView(o.v)} className={cn("flex h-9 items-center gap-1.5 rounded-full px-3.5 transition-colors", view === o.v ? "bg-surface shadow-sm" : "text-muted")}>
              <o.icon className="size-4" /> {o.l}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {!isThisWeek && (
          <Link href="/meals" className="text-[14px] font-semibold text-primary">
            לשבוע הנוכחי
          </Link>
        )}
        {suggestions.length > 0 && freeDinners > 0 && (
          <Button size="sm" onClick={buildWeek} loading={building}>
            <WandSparkles /> תכנן לי את השבוע
          </Button>
        )}
      </div>

      {entries.length === 0 && (
        <section className="hero mb-5 p-5 text-center">
          <span aria-hidden className="mx-auto mb-3 grid size-16 place-items-center rounded-[22px] bg-primary text-primary-foreground">
            <CalendarDays className="size-8" strokeWidth={1.8} />
          </span>
          <h2 className="title-2">עדיין לא תכננתם את השבוע</h2>
          <p className="hero-muted mx-auto mt-1 max-w-xs text-[14px]">בחרו מתכונים, או תנו ל־HomeOS להציע תפריט לפי מה שיש בבית.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={buildWeek} loading={building} disabled={!suggestions.length}>
              <WandSparkles /> תכנן לי את השבוע
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/recipes/new">
                <Plus /> הוספת מתכון
              </Link>
            </Button>
            <Button variant="secondary" onClick={copyLastWeek}>
              <Copy /> כמו בשבוע שעבר
            </Button>
          </div>
        </section>
      )}

      {view === "day" ? (
        <>
          <h2 className="mb-3 flex items-baseline gap-2 px-1 text-[22px] font-bold">
            יום {DAY_NAMES[selIdx]}
            <span className="num text-[14px] font-normal text-muted">{fmt(selected)}</span>
            {selected === today && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[12px] font-bold text-primary">היום</span>}
          </h2>
          <div className="space-y-5">
            {(["breakfast", "lunch", "dinner", "snack"] as MealSlot[]).map((slot) => {
              const list = entries.filter((e) => e.plan_date === selected && e.slot === slot);
              if (slot === "snack" && !list.length) return null;
              const SlotIcon = SLOT_ICON[slot];
              return (
                <section key={slot} aria-label={MEAL_SLOT[slot]}>
                  <h3 className="mb-2 flex items-center gap-2 px-1 text-[15px] font-semibold text-foreground/80">
                    <span className="mod-chip grid size-7 place-items-center rounded-lg" style={{ "--h": SLOT_HUE[slot] } as React.CSSProperties}>
                      <SlotIcon className="size-4" />
                    </span>
                    {SLOT_TITLE[slot]}
                  </h3>
                  {list.length ? (
                    <div className="space-y-2.5">
                      {list.map((e) => (
                        <AgendaCard
                          key={e.id}
                          e={e}
                          title={titleOf(e)}
                          missing={hasStock && e.recipe_id ? missingFor(e.recipe_title) : null}
                          onReplace={() => setSheet({ date: e.plan_date, slot: e.slot, entryId: e.id, recipeId: e.recipe_id ?? undefined, title: e.recipe_id ? undefined : (e.title ?? "") })}
                          onMove={() => setMoving(e)}
                          onRemove={() => remove(e)}
                        />
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSheet({ date: selected, slot })}
                      className="pressable flex w-full items-center gap-3 rounded-[var(--radius)] border-2 border-dashed border-border p-4 text-start text-[15px] text-muted transition-colors hover:border-primary/40"
                    >
                      <span className="grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary">
                        <Plus className="size-5" />
                      </span>
                      <span>
                        <span className="block font-semibold text-foreground">הוספת {SLOT_TITLE[slot]}</span>
                        <span className="block text-[13px]">ממתכון שמור או כתיבה חופשית</span>
                      </span>
                    </button>
                  )}
                </section>
              );
            })}
          </div>

          {suggestions.length > 0 && (
            <section className="mt-7">
              <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[14px] font-semibold text-primary">
                <Sparkles className="size-4" /> {hasStock ? "אפשר לבשל ממה שיש בבית" : "הצעות מהמתכונים שלכם"}
              </h2>
              <div className="scrollbar-none -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1">
                {suggestions.map((sg) => (
                  <div key={sg.recipeId} className="card w-[210px] shrink-0 snap-start overflow-hidden">
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
                        aria-label={`לתכנן ${sg.title} ליום ${DAY_NAMES[selIdx]}`}
                        onClick={() => setSheet({ date: selected, slot: "dinner", recipeId: sg.recipeId })}
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
        </>
      ) : (
        /* Week board: a list on phones, a drag-and-drop board on desktop */
        <div className="space-y-2.5 lg:grid lg:grid-cols-7 lg:gap-2 lg:space-y-0">
          {days.map((d, i) => {
            const list = byDay(d);
            return (
              <section
                key={d}
                onDragOver={(ev) => {
                  ev.preventDefault();
                  setDragOver(d);
                }}
                onDragLeave={() => setDragOver((x) => (x === d ? null : x))}
                onDrop={(ev) => {
                  ev.preventDefault();
                  setDragOver(null);
                  const id = ev.dataTransfer.getData("text/meal");
                  const e = entries.find((x) => x.id === id);
                  if (e) void move(e, d);
                }}
                className={cn("card p-3 transition-shadow lg:min-h-[280px]", d === today && "shadow-[0_0_0_1.5px_var(--primary),var(--card-shadow)]", dragOver === d && "shadow-[0_0_0_2px_var(--primary),var(--card-shadow)]")}
              >
                <button type="button" onClick={() => { setSelected(d); setView("day"); }} className="mb-2 flex w-full items-baseline gap-2 text-start">
                  <span className="text-[16px] font-bold">{DAY_NAMES[i]}</span>
                  <span className="num text-[12px] text-muted">{fmt(d)}</span>
                  <span className="flex-1" />
                  <span className="text-[12px] text-muted lg:hidden">{list.length ? `${list.length} ארוחות` : "ריק"}</span>
                </button>
                <div className="scrollbar-none -mx-3 flex gap-2 overflow-x-auto px-3 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
                  {list.map((e) => (
                    <div
                      key={e.id}
                      draggable
                      onDragStart={(ev) => ev.dataTransfer.setData("text/meal", e.id)}
                      className="relative h-[92px] w-[120px] shrink-0 cursor-grab overflow-hidden rounded-2xl active:cursor-grabbing lg:w-full"
                    >
                      <RecipeImage r={{ title: titleOf(e), image_path: e.recipe_image_path ?? null, image_url: e.recipe_image_url ?? null }} className="absolute inset-0 size-full text-[30px]" />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <span className="absolute inset-x-0 bottom-0 p-2 text-white">
                        <span className="block text-[10px] font-semibold opacity-85">{MEAL_SLOT[e.slot]}</span>
                        <span className="block truncate text-[13px] leading-tight font-semibold">{titleOf(e)}</span>
                      </span>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSheet({ date: d, slot: "dinner" })}
                    aria-label={`הוספת ארוחה ליום ${DAY_NAMES[i]}`}
                    className={cn("grid shrink-0 place-items-center rounded-2xl border-2 border-dashed border-border text-primary lg:h-12 lg:w-full", list.length ? "h-[92px] w-14" : "h-11 w-full")}
                  >
                    <Plus className="size-5" />
                  </button>
                </div>
              </section>
            );
          })}
          <p className="hidden text-center text-[12px] text-muted lg:col-span-7 lg:block">גררו ארוחה ליום אחר כדי להעביר אותה</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2 pb-28">
          <Button variant="secondary" onClick={copyLastWeek}>
            <Copy /> כמו בשבוע שעבר
          </Button>
        </div>
      )}

      {shortfalls.length > 0 && hasStock && (
        <div className="fixed inset-x-0 bottom-[calc(max(0.35rem,env(safe-area-inset-bottom))+74px)] z-30 px-4 lg:start-72 lg:bottom-6">
          <div className="mx-auto max-w-md lg:max-w-xl">
            <Button size="lg" className="w-full shadow-lift" onClick={() => setShopOpen(true)}>
              <ShoppingCart /> חסרים {shortfalls.length} מצרכים לתפריט · לרשימה
            </Button>
          </div>
        </div>
      )}

      <Sheet open={!!moving} onOpenChange={(o) => !o && setMoving(null)} title={moving ? `להעביר את ${titleOf(moving)}` : ""} description="בחרו יום וארוחה">
        {moving && (
          <div className="space-y-4 pb-2">
            <div className="grid grid-cols-4 gap-2">
              {days.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    void move(moving, d);
                    setMoving(null);
                  }}
                  disabled={d === moving.plan_date}
                  className="pressable flex flex-col items-center gap-0.5 rounded-2xl bg-surface-2 py-3 disabled:opacity-40"
                >
                  <span className="text-[13px] font-semibold">{DAY_NAMES[i]}</span>
                  <span className="num text-[12px] text-muted">{fmt(d)}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["breakfast", "lunch", "dinner"] as MealSlot[])
                .filter((sl) => sl !== moving.slot)
                .map((sl) => (
                  <Button
                    key={sl}
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void move(moving, moving.plan_date, sl);
                      setMoving(null);
                    }}
                  >
                    באותו יום · {SLOT_TITLE[sl]}
                  </Button>
                ))}
            </div>
          </div>
        )}
      </Sheet>

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

type SheetState = { date: string; slot: MealSlot; recipeId?: string; entryId?: string; title?: string } | null;

function MealSheet({ state, onClose, recipes }: { state: SheetState; onClose: () => void; recipes: { id: string; title: string; servings: number | null }[] }) {
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
      setTitle(state.title ?? "");
      setServings("");
      setNotes("");
    }
  }

  return (
    <Sheet
      open={!!state}
      onOpenChange={(o) => !o && onClose()}
      title={state?.entryId ? "החלפת ארוחה" : "ארוחה בתכנון"}
      footer={
        <Button
          size="lg"
          className="w-full"
          loading={saving}
          disabled={!recipeId && !title.trim()}
          onClick={async () => {
            setSaving(true);
            const res = await saveMealEntry(state?.entryId ?? null, { plan_date: date, slot, recipe_id: recipeId || null, title: recipeId ? null : title, servings, notes });
            setSaving(false);
            if (!res.ok) return void toast.error(res.error);
            onClose();
            router.refresh();
          }}
        >
          {state?.entryId ? "שמירה" : "הוספה"}
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
