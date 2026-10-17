"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, CircleHelp, Clock, ExternalLink, Heart, Minus, Pencil, Plus, ShoppingCart, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { addIngredientsToList, deleteRecipe, linkIngredient, markRecipeCooked, setRecipeFavorite } from "@/server/actions/recipes";
import { saveMealEntry } from "@/server/actions/meals";
import type { Recipe, RecipeIngredient, RecipeStep } from "@/lib/types";
import { checkIngredients, type IngredientCheck, type StockItem } from "@/lib/ingredients";
import { MEAL_SLOT, RECIPE_SOURCE, options } from "@/lib/labels";
import { formatQuantity, formatShortDate, todayInZone } from "@/lib/format";
import { primeSignedUrls } from "@/lib/media";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Field, Input, Select } from "@/components/ui/field";
import { Panel, PanelHeading } from "@/components/ui/panel";
import { RecipeImage } from "./recipes-view";

const STATUS_UI: Record<IngredientCheck["status"], { icon: React.ReactNode; tone: string; label: string }> = {
  available: { icon: <Check className="size-4" strokeWidth={3} />, tone: "bg-sage-soft text-sage", label: "יש" },
  insufficient: { icon: <Minus className="size-4" strokeWidth={3} />, tone: "bg-amber-soft text-amber", label: "לא מספיק" },
  missing: { icon: <Plus className="size-4" strokeWidth={3} />, tone: "bg-danger-soft text-danger", label: "חסר" },
  unclear: { icon: <CircleHelp className="size-4" />, tone: "bg-fill text-muted", label: "לא ברור" },
};

interface Proposal {
  key: string;
  include: boolean;
  name: string;
  quantity: string;
  unit: string;
  inventory_item_id: string | null;
}

export function RecipeDetail({
  recipe: r,
  ingredients,
  steps,
  stock,
  mappings,
  createdBy,
  signedUrls,
}: {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  stock: StockItem[];
  mappings: Record<string, string>;
  createdBy: string | null;
  signedUrls: Record<string, string>;
}) {
  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);
  const router = useRouter();
  const base = r.servings ? Number(r.servings) : null;
  const [servings, setServings] = useState(base ?? 1);
  const factor = base ? servings / base : 1;
  const [favorite, setFavorite] = useState(r.is_favorite);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkFor, setLinkFor] = useState<IngredientCheck | null>(null);

  const checks = useMemo(
    () =>
      checkIngredients(
        ingredients.map((i) => ({ name: i.name, quantity: i.quantity != null ? Number(i.quantity) : null, unit: i.unit, optional: i.optional, inventory_item_id: i.inventory_item_id })),
        stock,
        { servingsFactor: factor, mappings },
      ),
    [ingredients, stock, mappings, factor],
  );
  const required = checks.filter((c) => !c.ingredient.optional);
  const have = required.filter((c) => c.status === "available").length;
  const short = checks.filter((c) => (c.status === "missing" || c.status === "insufficient") && !c.ingredient.optional);

  function openAddMissing() {
    setProposals(
      short.map((c, i) => ({
        key: `${i}`,
        include: true,
        name: c.match?.name ?? c.ingredient.name,
        quantity: String(c.shortfall?.quantity ?? 1),
        unit: c.shortfall?.unit ?? "יח׳",
        inventory_item_id: c.match?.id ?? null,
      })),
    );
  }

  async function confirmAdd() {
    if (!proposals) return;
    const items = proposals
      .filter((p) => p.include && p.name.trim() && Number(p.quantity) > 0)
      .map((p) => ({ name: p.name, quantity: Number(p.quantity), unit: p.unit || "יח׳", inventory_item_id: p.inventory_item_id, note: `למתכון: ${r.title}`.slice(0, 200) }));
    if (!items.length) return setProposals(null);
    setAdding(true);
    const res = await addIngredientsToList({ items });
    setAdding(false);
    if (!res.ok) return void toast.error(res.error);
    setProposals(null);
    toast.success(`${res.data.added + res.data.merged} מצרכים ברשימת הקניות${res.data.merged ? ` (${res.data.merged} כבר היו ועודכנו)` : ""}`, {
      action: { label: "לרשימה", onClick: () => router.push("/shopping") },
    });
  }

  const totalTime = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);

  return (
    <>
      <PageHeader
        title={r.title}
        back={{ href: "/recipes", label: "מתכונים" }}
        actions={
          <div className="flex gap-2">
            <Button
              size="icon-sm"
              variant="secondary"
              aria-label={favorite ? "הסרה מהמועדפים" : "הוספה למועדפים"}
              onClick={async () => {
                setFavorite(!favorite);
                const res = await setRecipeFavorite(r.id, !favorite);
                if (!res.ok) {
                  setFavorite(favorite);
                  toast.error(res.error);
                }
              }}
            >
              <Heart className={cn(favorite && "fill-danger text-danger")} />
            </Button>
            <Link href={`/recipes/${r.id}/edit`} className="pressable grid size-8 place-items-center rounded-full bg-fill" aria-label="עריכה">
              <Pencil className="size-[17px]" />
            </Link>
          </div>
        }
      />

      <div className="space-y-6 pb-28">
        <RecipeImage r={r} className="aspect-[16/10] w-full rounded-[var(--radius)] border border-border" />
        {r.description && <p className="text-[16px] leading-relaxed text-foreground/85">{r.description}</p>}

        <section className="flex flex-wrap items-center gap-2 text-[14px]">
          {totalTime > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-fill px-3 py-1.5">
              <Clock className="size-4" /> <span className="num">{totalTime}</span> דק׳
              {r.prep_minutes && r.cook_minutes ? <span className="text-muted">({r.prep_minutes} הכנה)</span> : null}
            </span>
          )}
          {r.category && <span className="rounded-full bg-fill px-3 py-1.5">{r.category}</span>}
          {r.tags.map((t) => (
            <span key={t} className="rounded-full bg-primary-soft px-3 py-1.5 text-primary">
              {t}
            </span>
          ))}
        </section>

        {/* Ingredients vs inventory */}
        <section>
          <PanelHeading
            title="מצרכים"
            action={
              base ? (
                <div className="flex items-center gap-1 rounded-full bg-fill p-1" aria-label="מספר מנות">
                  <button type="button" className="grid size-7 place-items-center rounded-full bg-surface" onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="פחות מנות">
                    <Minus className="size-3.5" />
                  </button>
                  <span className="num flex items-center gap-1 px-1 text-[14px] font-semibold">
                    <Users className="size-3.5" /> {servings}
                  </span>
                  <button type="button" className="grid size-7 place-items-center rounded-full bg-surface" onClick={() => setServings((s) => Math.min(100, s + 1))} aria-label="יותר מנות">
                    <Plus className="size-3.5" />
                  </button>
                </div>
              ) : undefined
            }
          />
          {required.length > 0 && (
            <p className="mb-2 px-1 text-[14px] text-muted">
              לפי המלאי: יש {have} מתוך {required.length}
              {short.length ? ` · חסרים ${short.length}` : " · אפשר להכין"}
              {stock.some((s) => s.stock_confidence === "estimated") ? " (חלק מהמלאי משוער)" : ""}
            </p>
          )}
          <Panel>
            {checks.map((c, i) => {
              const ui = STATUS_UI[c.status];
              const qty = c.ingredient.quantity != null ? formatQuantity(Math.round(c.ingredient.quantity * factor * 100) / 100) : "";
              return (
                <div key={i} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", ui.tone)} title={ui.label}>
                    {ui.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px]">
                      {qty && (
                        <>
                          <span className="num font-semibold">{qty}</span>{" "}
                        </>
                      )}
                      {c.ingredient.unit && qty ? <span className="font-semibold">{c.ingredient.unit} </span> : null}
                      {c.ingredient.name}
                      {c.ingredient.optional && <span className="text-muted"> (רשות)</span>}
                    </span>
                    <span className="footnote block text-muted">
                      {c.match ? `${c.match.name}: ${c.reason}` : c.reason}
                    </span>
                  </span>
                  {c.status === "unclear" || (!c.match && stock.length > 0) ? (
                    <button type="button" onClick={() => setLinkFor(c)} className="footnote shrink-0 font-semibold text-primary">
                      קישור למלאי
                    </button>
                  ) : null}
                </div>
              );
            })}
            {checks.length === 0 && <p className="px-4 py-3 text-[15px] text-muted">אין מצרכים. ערכו את המתכון כדי להוסיף.</p>}
          </Panel>
        </section>

        {steps.length > 0 && (
          <section>
            <PanelHeading title="אופן ההכנה" />
            <ol className="space-y-3">
              {steps.map((s, i) => (
                <li key={s.id} className="flex gap-3">
                  <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[14px] font-bold text-primary-foreground">{i + 1}</span>
                  <p className="pt-0.5 text-[16px] leading-relaxed">{s.body}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {r.notes && (
          <Panel>
            <div className="px-4 py-3">
              <p className="footnote mb-1 text-muted">הערות שלנו</p>
              <p className="text-[15px] whitespace-pre-wrap">{r.notes}</p>
            </div>
          </Panel>
        )}

        <section className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              const res = await markRecipeCooked(r.id);
              if (!res.ok) return void toast.error(res.error);
              toast.success("נרשם שבישלתם היום");
              router.refresh();
            }}
          >
            בישלנו היום
          </Button>
          <Button variant="secondary" onClick={() => setPlanOpen(true)}>
            <CalendarPlus /> לתכנון הארוחות
          </Button>
          {r.source_url && (
            <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="pressable inline-flex h-11 items-center gap-1.5 rounded-full bg-fill px-5 text-[17px] font-semibold">
              {RECIPE_SOURCE[r.source_platform]} <ExternalLink className="size-4" />
            </a>
          )}
        </section>

        <p className="footnote px-1 text-muted">
          {[createdBy ? `נשמר על ידי ${createdBy}` : null, r.last_cooked_on ? `בושל לאחרונה ${formatShortDate(r.last_cooked_on)}` : null, r.times_cooked ? `${r.times_cooked} פעמים` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <Button variant="danger-ghost" className="w-full" onClick={() => setConfirmDelete(true)}>
          <Trash2 /> מחיקת המתכון
        </Button>
      </div>

      {short.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.6rem+62px+10px)] z-30 px-3 lg:start-72 lg:bottom-6">
          <div className="mx-auto max-w-md lg:max-w-xl">
            <Button size="lg" className="w-full shadow-lift" onClick={openAddMissing}>
              <ShoppingCart /> הוסף את המצרכים החסרים לרשימת הקניות
            </Button>
          </div>
        </div>
      )}

      <Sheet
        open={!!proposals}
        onOpenChange={(o) => !o && setProposals(null)}
        title="להוסיף לרשימת הקניות?"
        description="בדקו כמויות. מה שכבר ברשימה יעודכן ולא יוכפל."
        footer={
          <Button size="lg" className="w-full" onClick={confirmAdd} loading={adding}>
            הוספה ({proposals?.filter((p) => p.include).length ?? 0})
          </Button>
        }
      >
        <Panel>
          {proposals?.map((p) => (
            <div key={p.key} className="flex items-center gap-2 px-3 py-2">
              <input
                type="checkbox"
                checked={p.include}
                onChange={(e) => setProposals((l) => l!.map((x) => (x.key === p.key ? { ...x, include: e.target.checked } : x)))}
                className="size-5 accent-[var(--primary)]"
                aria-label={`לכלול את ${p.name}`}
              />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <Input
                value={p.quantity}
                inputMode="decimal"
                onChange={(e) => setProposals((l) => l!.map((x) => (x.key === p.key ? { ...x, quantity: e.target.value } : x)))}
                className="w-16 px-2 text-center"
                aria-label="כמות"
              />
              <span className="w-14 shrink-0 truncate text-[14px] text-muted">{p.unit}</span>
            </div>
          ))}
        </Panel>
      </Sheet>

      <LinkSheet check={linkFor} stock={stock} onClose={() => setLinkFor(null)} />
      <PlanSheet open={planOpen} onOpenChange={setPlanOpen} recipeId={r.id} servings={base ? servings : null} />
      <ConfirmSheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`למחוק את "${r.title}"?`}
        description="המתכון יימחק גם מתכנון הארוחות."
        confirmLabel="מחיקה"
        destructive
        onConfirm={async () => {
          const res = await deleteRecipe(r.id);
          if (!res.ok) return void toast.error(res.error);
          router.push("/recipes");
        }}
      />
    </>
  );
}

function LinkSheet({ check, stock, onClose }: { check: IngredientCheck | null; stock: StockItem[]; onClose: () => void }) {
  const router = useRouter();
  const [choice, setChoice] = useState("");
  const candidates = check ? [...(check.match ? [check.match] : []), ...check.alternatives] : [];
  const rest = stock.filter((s) => !candidates.some((c) => c.id === s.id));
  return (
    <Sheet
      open={!!check}
      onOpenChange={(o) => !o && onClose()}
      title={check ? `"${check.ingredient.name}" במלאי` : ""}
      description="נזכור את הבחירה לכל המתכונים"
      footer={
        <Button
          size="lg"
          className="w-full"
          disabled={!choice}
          onClick={async () => {
            if (!check) return;
            const res = await linkIngredient(check.ingredient.name, choice);
            if (!res.ok) return void toast.error(res.error);
            toast.success("נשמר");
            onClose();
            router.refresh();
          }}
        >
          שמירה
        </Button>
      }
    >
      <Select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="מוצר במלאי">
        <option value="">בחרו מוצר…</option>
        {candidates.length > 0 && (
          <optgroup label="מתאימים">
            {candidates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({formatQuantity(s.quantity)} {s.unit})
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="כל המלאי">
          {rest.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </optgroup>
      </Select>
    </Sheet>
  );
}

function PlanSheet({ open, onOpenChange, recipeId, servings }: { open: boolean; onOpenChange: (o: boolean) => void; recipeId: string; servings: number | null }) {
  const router = useRouter();
  const [date, setDate] = useState(todayInZone());
  const [slot, setSlot] = useState<"breakfast" | "lunch" | "dinner" | "snack">("dinner");
  const [saving, setSaving] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="הוספה לתכנון הארוחות"
      footer={
        <Button
          size="lg"
          className="w-full"
          loading={saving}
          onClick={async () => {
            setSaving(true);
            const res = await saveMealEntry(null, { plan_date: date, slot, recipe_id: recipeId, servings: servings ?? null, title: null, notes: null });
            setSaving(false);
            if (!res.ok) return void toast.error(res.error);
            onOpenChange(false);
            toast.success("נוסף לתכנון", { action: { label: "לתכנון", onClick: () => router.push("/meals") } });
          }}
        >
          הוספה
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="יום" htmlFor="pl-date">
          <Input id="pl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="ארוחה" htmlFor="pl-slot">
          <Select id="pl-slot" value={slot} onChange={(e) => setSlot(e.target.value as typeof slot)}>
            {options(MEAL_SLOT).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Badge className="mt-3">{servings ? `${servings} מנות` : "כמות מנות לפי המתכון"}</Badge>
    </Sheet>
  );
}
