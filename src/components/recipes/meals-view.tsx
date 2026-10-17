"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, Plus, ShoppingCart, Sparkles, X } from "lucide-react";
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

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export interface MealSuggestion {
  recipeId: string;
  title: string;
  reason: string;
}

export function MealsView({
  householdId,
  weekStart,
  entries,
  recipes,
  shortfalls,
  suggestions,
}: {
  householdId: string;
  weekStart: string;
  entries: (MealPlanEntry & { recipe_title: string | null })[];
  recipes: { id: string; title: string; servings: number | null }[];
  shortfalls: ShoppingProposal[];
  suggestions: MealSuggestion[];
}) {
  useRealtimeRefresh("meal_plan_entries", householdId);
  const router = useRouter();
  const today = todayInZone();
  const [sheet, setSheet] = useState<{ date: string; slot: MealSlot; recipeId?: string } | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isThisWeek = days.includes(today);
  const fmt = (iso: string) => new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

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

  return (
    <>
      <PageHeader title="תכנון ארוחות" back={{ href: "/recipes", label: "מתכונים" }} subtitle={`${fmt(days[0])} – ${fmt(days[6])}`} />

      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={`/meals?week=${addDays(weekStart, -7)}`} className="pressable flex h-9 items-center gap-1 rounded-full bg-fill px-3 text-[15px]">
          <ChevronRight className="size-4" /> שבוע קודם
        </Link>
        {!isThisWeek && (
          <Link href="/meals" className="text-[15px] font-semibold text-primary">
            השבוע
          </Link>
        )}
        <Link href={`/meals?week=${addDays(weekStart, 7)}`} className="pressable flex h-9 items-center gap-1 rounded-full bg-fill px-3 text-[15px]">
          שבוע הבא <ChevronLeft className="size-4" />
        </Link>
      </div>

      {suggestions.length > 0 && (
        <section className="mb-5 rounded-[var(--radius)] border border-border bg-surface p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-[14px] font-semibold text-primary">
            <Sparkles className="size-4" /> הצעות לפי מה שיש בבית
          </h2>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li key={s.recipeId} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <Link href={`/recipes/${s.recipeId}`} className="block truncate font-medium">
                    {s.title}
                  </Link>
                  <span className="footnote block text-muted">{s.reason}</span>
                </span>
                <Button size="sm" variant="soft" onClick={() => setSheet({ date: isThisWeek ? today : weekStart, slot: "dinner", recipeId: s.recipeId })}>
                  לתכנן
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-3">
        {days.map((d, i) => {
          const dayEntries = entries.filter((e) => e.plan_date === d);
          return (
            <section key={d} className={cn("overflow-hidden rounded-[var(--radius)] border bg-surface", d === today ? "border-primary" : "border-border")}>
              <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2">
                <h2 className="text-[15px] font-semibold">
                  יום {DAY_NAMES[i]} <span className="num font-normal text-muted">{fmt(d)}</span>
                  {d === today && <span className="ms-2 text-[13px] text-primary">היום</span>}
                </h2>
                <button type="button" onClick={() => setSheet({ date: d, slot: "dinner" })} className="grid size-8 place-items-center rounded-full text-primary active:bg-fill" aria-label={`הוספת ארוחה ליום ${DAY_NAMES[i]}`}>
                  <Plus className="size-5" />
                </button>
              </div>
              {dayEntries.length ? (
                <div className="[&>*+*]:border-t [&>*+*]:border-border">
                  {(["breakfast", "lunch", "dinner", "snack"] as MealSlot[]).flatMap((slot) =>
                    dayEntries
                      .filter((e) => e.slot === slot)
                      .map((e) => (
                        <div key={e.id} className="flex min-h-12 items-center gap-3 px-4 py-2">
                          <span className="w-14 shrink-0 text-[13px] text-muted">{MEAL_SLOT[slot]}</span>
                          {e.recipe_id ? (
                            <Link href={`/recipes/${e.recipe_id}`} className="min-w-0 flex-1 truncate font-medium">
                              {e.recipe_title ?? "מתכון"}
                            </Link>
                          ) : (
                            <span className="min-w-0 flex-1 truncate">{e.title}</span>
                          )}
                          {e.servings && <span className="num footnote text-muted">{formatQuantity(e.servings)} מנות</span>}
                          <button
                            type="button"
                            aria-label="הסרה"
                            className="grid size-8 place-items-center rounded-full text-muted active:bg-fill"
                            onClick={async () => {
                              const r = await deleteMealEntry(e.id);
                              if (!r.ok) toast.error(r.error);
                              router.refresh();
                            }}
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      )),
                  )}
                </div>
              ) : (
                <button type="button" onClick={() => setSheet({ date: d, slot: "dinner" })} className="w-full px-4 py-3 text-start text-[14px] text-muted">
                  עוד לא תוכנן
                </button>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 pb-28">
        <Button
          variant="secondary"
          onClick={async () => {
            const res = await copyMealWeek(addDays(weekStart, -7), weekStart);
            if (!res.ok) return void toast.error(res.error);
            toast.success(res.data.copied ? `הועתקו ${res.data.copied} ארוחות מהשבוע הקודם` : "בשבוע הקודם לא היה תכנון");
            router.refresh();
          }}
        >
          <Copy /> כמו בשבוע שעבר
        </Button>
      </div>

      {shortfalls.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.6rem+62px+10px)] z-30 px-3 lg:start-72 lg:bottom-6">
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
