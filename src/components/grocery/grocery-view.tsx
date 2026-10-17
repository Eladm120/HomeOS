"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Camera, ChevronDown, CloudOff, PackageCheck, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { addShoppingItem, deleteShoppingItem, restoreShoppingItem } from "@/server/actions/grocery";
import { useGroceryList, type SyncState } from "@/hooks/use-grocery-list";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { groupByCategory, splitByStatus } from "@/lib/grocery";
import { categoryStyle, guessCategoryId } from "@/lib/category-style";
import { parseBulkLine } from "@/lib/validation";
import type { ProductCategory, ShoppingListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { SwipeRow } from "@/components/ui/swipe-row";
import { GroceryItemRow } from "./item-row";
import { GroceryItemSheet } from "./item-sheet";
import { FinishTripSheet, type InventoryOption } from "./finish-trip-sheet";

export interface GroceryViewProps {
  householdId: string;
  initialItems: ShoppingListItem[];
  categories: ProductCategory[];
  memberNames: Record<string, string>;
  currentUserId: string;
  signedUrls: Record<string, string>;
  inventory: InventoryOption[];
  renderedAt: number;
  preview?: boolean;
}

export function SyncBadge({ sync, pendingOps }: { sync: SyncState; pendingOps: number }) {
  if (sync === "live" && !pendingOps) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-sage">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-sage opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-sage" />
        </span>
        משותפת ומתעדכנת בזמן אמת
      </span>
    );
  }
  if (sync === "offline") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-amber">
        <CloudOff className="size-3.5" /> לא מקוון{pendingOps ? ` · ${pendingOps} ממתינים לסנכרון` : ""}
      </span>
    );
  }
  return <span className="text-[13px] text-muted">מתחבר…{pendingOps ? ` · ${pendingOps} ממתינים` : ""}</span>;
}

type Phase = "check" | "leave";
const CHECK_MS = 600;
const LEAVE_MS = 260;

/**
 * The one shopping list — also the in-store view. Big rows, product pictures,
 * category cards, offline check-off. Ticking an item shows the check mark,
 * then the row leaves the list and waits in the cart until the trip is finished.
 */
export function GroceryView(props: GroceryViewProps) {
  const { items, sync, pendingOps, setStatus, upsertLocal, removeLocal } = useGroceryList(props);
  const [editing, setEditing] = useState<ShoppingListItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useOpenFromQuery(() => openNew());

  const catById = useMemo(() => new Map(props.categories.map((c) => [c.id, c])), [props.categories]);
  const { pending, done } = useMemo(() => splitByStatus(items), [items]);
  const groups = useMemo(() => groupByCategory(pending, props.categories), [pending, props.categories]);
  const visibleGroups = filter === "all" ? groups : groups.filter((g) => (g.id ?? "none") === filter);
  const total = pending.length + done.length;
  const parsed = useMemo(() => parseBulkLine(draft), [draft]);
  useEffect(() => {
    if (filter !== "all" && !groups.some((g) => (g.id ?? "none") === filter)) setFilter("all");
  }, [groups, filter]);

  const nameOf = (id: string | null) => (id && id !== props.currentUserId ? props.memberNames[id] || undefined : undefined);

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }

  function latest(id: string) {
    return itemsRef.current.find((i) => i.id === id);
  }

  function undoPurchase(id: string) {
    const cur = latest(id);
    if (cur) setStatus(cur, "pending");
  }

  /** Tick: show the check, then let the row leave, then mark purchased. */
  function complete(item: ShoppingListItem) {
    if (phase[item.id]) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setPhase((p) => ({ ...p, [item.id]: "check" }));
    timers.current.push(
      window.setTimeout(() => {
        setPhase((p) => ({ ...p, [item.id]: "leave" }));
        timers.current.push(
          window.setTimeout(() => {
            setStatus(latest(item.id) ?? item, "purchased");
            setPhase((p) => {
              const next = { ...p };
              delete next[item.id];
              return next;
            });
            toast(`${item.name} בעגלה ✓`, { action: { label: "ביטול", onClick: () => undoPurchase(item.id) } });
          }, reduced ? 0 : LEAVE_MS),
        );
      }, reduced ? 150 : CHECK_MS),
    );
  }

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed) return;
    setAdding(true);
    const res = await addShoppingItem({
      name: parsed.name,
      quantity: parsed.quantity,
      unit: parsed.unit,
      category_id: guessCategoryId(parsed.name, props.categories),
      save_to_catalog: false,
    });
    setAdding(false);
    if (!res.ok) return void toast.error(res.error);
    upsertLocal(res.data.item);
    setDraft("");
    const cat = res.data.item.category_id ? catById.get(res.data.item.category_id) : null;
    if (res.data.merged) toast.success(`${parsed.name} כבר ברשימה, עדכנתי את הכמות`);
    else if (cat) toast(`${parsed.name} נוסף ל${cat.name}`);
  }

  async function remove(item: ShoppingListItem) {
    removeLocal(item.id);
    const res = await deleteShoppingItem(item.id);
    if (!res.ok) {
      upsertLocal(item);
      return void toast.error(res.error);
    }
    toast(`${item.name} הוסר`, {
      action: {
        label: "ביטול",
        onClick: async () => {
          const r = await restoreShoppingItem(item.id);
          if (r.ok) upsertLocal({ ...item, version: item.version + 2 });
        },
      },
    });
  }

  const pillGroups = groups.length > 1 ? groups : [];

  return (
    <>
      <PageHeader title="רשימת קניות" subtitle={<SyncBadge sync={sync} pendingOps={pendingOps} />} />

      {total > 0 && (
        <div className="mb-4 flex items-center gap-3 px-1">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
            <div className="h-full rounded-full bg-primary transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ width: `${(done.length / total) * 100}%` }} />
          </div>
          <span className="num footnote shrink-0 font-semibold text-muted">
            {done.length}/{total}
          </span>
        </div>
      )}

      {pillGroups.length > 0 && (
        <div role="group" aria-label="סינון לפי קטגוריה" className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
          {[{ id: "all", name: "הכל", count: pending.length, emoji: "" }, ...pillGroups.map((g) => ({ id: g.id ?? "none", name: g.name, count: g.items.length, emoji: categoryStyle(g.id ? catById.get(g.id) : null).emoji }))].map((c) => {
            const active = filter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.id)}
                aria-pressed={active}
                className={cn(
                  "pressable flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[15px] font-medium transition-colors",
                  active ? "border-transparent bg-foreground text-background" : "border-border bg-surface text-foreground",
                )}
              >
                {c.emoji && <span aria-hidden>{c.emoji}</span>}
                {c.name}
                <span className={cn("num text-[12px]", active ? "opacity-70" : "text-muted")}>{c.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {total === 0 ? (
        <EmptyState icon={<ShoppingCart />} title="הרשימה ריקה" description="כתבו למטה מה צריך, למשל ״2 חלב״. שניכם תראו את זה מיד." />
      ) : (
        <div className="space-y-4">
          {visibleGroups.map((g) => {
            const category = g.id ? (catById.get(g.id) ?? null) : null;
            const style = categoryStyle(category);
            return (
              <section
                key={g.id ?? "none"}
                aria-label={g.name}
                className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface"
                style={{ "--h": style.hue } as React.CSSProperties}
              >
                <h2 className="cat-tint flex items-center gap-2.5 border-b border-border px-3.5 py-2.5">
                  <span aria-hidden className="grid size-8 place-items-center rounded-[10px] bg-surface text-[18px] leading-none">
                    {style.emoji}
                  </span>
                  <span className="headline flex-1">{g.name}</span>
                  <span className="num cat-ink rounded-full bg-surface px-2.5 py-0.5 text-[13px] font-bold">{g.items.length}</span>
                </h2>
                <div className="[&>*+*]:border-t [&>*+*]:border-border">
                  {g.items.map((it) => {
                    const ph = phase[it.id];
                    return (
                      <div
                        key={it.id}
                        className={cn(
                          "grid transition-[grid-template-rows,opacity,transform] duration-[260ms] ease-out",
                          ph === "leave" ? "grid-rows-[0fr] -translate-x-6 opacity-0" : "grid-rows-[1fr]",
                        )}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <SwipeRow
                            onComplete={() => {
                              setStatus(it, "purchased");
                              toast(`${it.name} בעגלה ✓`, { action: { label: "ביטול", onClick: () => undoPurchase(it.id) } });
                            }}
                            onDelete={() => remove(it)}
                            completeLabel="נקנה"
                          >
                            <GroceryItemRow
                              item={it}
                              category={category}
                              checked={!!ph}
                              addedByName={nameOf(it.added_by)}
                              onToggle={() => complete(it)}
                              onOpen={() => {
                                setEditing(it);
                                setSheetOpen(true);
                              }}
                            />
                          </SwipeRow>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {pending.length === 0 && done.length > 0 && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-2 grid size-16 animate-pop place-items-center rounded-full bg-primary text-3xl text-primary-foreground">✓</div>
              <p className="headline">הכל בעגלה</p>
              <p className="footnote mt-1 text-muted">סיימו קנייה כדי לעדכן את המלאי</p>
            </div>
          )}

          {done.length > 0 && (
            <section className="pt-2">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="mb-2 flex items-center gap-1 px-1 text-[15px] font-semibold text-muted"
                aria-expanded={showDone}
              >
                בעגלה · <span className="num">{done.length}</span>
                <ChevronDown className={cn("size-4 transition-transform duration-300", showDone && "rotate-180")} />
              </button>
              {showDone && (
                <div className="animate-fade-up overflow-hidden rounded-[var(--radius)] border border-border bg-surface [&>*+*]:border-t [&>*+*]:border-border">
                  {done.map((it) => (
                    <SwipeRow key={it.id} onComplete={() => setStatus(it, "pending")} onDelete={() => remove(it)} completeLabel="החזרה">
                      <GroceryItemRow
                        item={it}
                        category={it.category_id ? (catById.get(it.category_id) ?? null) : null}
                        checked
                        onToggle={() => setStatus(it, "pending")}
                      />
                    </SwipeRow>
                  ))}
                </div>
              )}
            </section>
          )}
          <p className="caption px-1 pt-1 text-center text-muted">טיפ: החליקו שורה ימינה לסימון מהיר, שמאלה למחיקה</p>
        </div>
      )}

      <div className={done.length ? "h-36" : "h-20"} aria-hidden />

      {/* Thumb-reach dock above the tab bar: finish-trip action + quick add */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.6rem+62px+10px)] z-30 px-3 lg:start-72 lg:bottom-6">
        <div className="mx-auto flex max-w-md flex-col gap-2 lg:max-w-xl">
          {done.length > 0 && (
            <Button size="lg" className="w-full shadow-lift" onClick={() => setFinishOpen(true)}>
              <PackageCheck /> סיום קנייה · <span className="num">{done.length}</span> בעגלה
            </Button>
          )}
          <form onSubmit={quickAdd} className="glass flex items-center gap-1.5 rounded-full p-1.5">
            <button type="button" onClick={openNew} className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-fill text-foreground/80" aria-label="הוספה עם תמונה ופרטים">
              <Camera className="size-5" />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="מה צריך לקנות?"
              aria-label="הוספה מהירה לרשימה"
              maxLength={120}
              enterKeyHint="send"
              className="h-10 min-w-0 flex-1 bg-transparent px-1 text-[17px] outline-none placeholder:text-muted"
            />
            {parsed && parsed.quantity !== 1 && (
              <span className="num shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-[13px] font-semibold text-primary">
                {parsed.quantity} {parsed.unit}
              </span>
            )}
            <button
              type="submit"
              disabled={!parsed || adding}
              aria-label="הוספה"
              className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
            >
              <ArrowUp className="size-5" strokeWidth={2.75} />
            </button>
          </form>
        </div>
      </div>

      <GroceryItemSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        householdId={props.householdId}
        categories={props.categories}
        item={editing}
        addedByName={editing ? (props.memberNames[editing.added_by ?? ""] ?? undefined) : undefined}
        onSaved={upsertLocal}
        onDeleted={removeLocal}
      />
      <FinishTripSheet open={finishOpen} onOpenChange={setFinishOpen} purchased={done} inventory={props.inventory} />
    </>
  );
}
