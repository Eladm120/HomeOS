"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Camera, CloudOff, LayoutGrid, ListTodo, PackageCheck, Plus, ShoppingCart, Sparkles, Store } from "lucide-react";
import { toast } from "sonner";
import { addShoppingItem, deleteShoppingItem, restoreShoppingItem } from "@/server/actions/grocery";
import { useGroceryList, type SyncState } from "@/hooks/use-grocery-list";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { groupByCategory, splitByStatus, suggestProducts, type SmartSuggestion } from "@/lib/grocery";
import { categoryStyle, guessCategoryId, productEmoji } from "@/lib/category-style";
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
import { Highlight } from "@/components/ui/product-combobox";
import { StoreMode } from "./store-mode";
import { Emoji3D } from "@/components/ui/emoji-3d";

export interface GroceryViewProps {
  householdId: string;
  initialItems: ShoppingListItem[];
  categories: ProductCategory[];
  memberNames: Record<string, string>;
  currentUserId: string;
  signedUrls: Record<string, string>;
  inventory: InventoryOption[];
  renderedAt: number;
  /** One-tap additions: running out, bought often. */
  suggestions?: SmartSuggestion[];
  /** Open straight into the full-screen supermarket mode (/shopping/mode). */
  initialStore?: boolean;
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
  const [tab, setTab] = useState<"buy" | "cart">("buy");
  const [finishOpen, setFinishOpen] = useState(false);
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const [store, setStore] = useState(!!props.initialStore);
  const [usedSuggestions, setUsedSuggestions] = useState<Set<string>>(new Set());
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
  const total = pending.length + done.length;
  const parsed = useMemo(() => parseBulkLine(draft), [draft]);
  // Products the home already knows whose name contains what's being typed ("חלב" → חלב, חלב סויה…).
  const suggestions = useMemo(() => (parsed && parsed.name.length >= 2 ? suggestProducts(parsed.name, props.inventory, 6) : []), [parsed, props.inventory]);

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
    await add(parsed.name, parsed.unit, null);
  }

  /** Tap a suggestion: add that exact product, linked to its inventory item, with the typed quantity. */
  async function addSuggestion(s: InventoryOption) {
    if (!parsed) return;
    await add(s.name, parsed.unit === "יח׳" ? s.unit : parsed.unit, s.id);
  }

  /** From the draft by default; `opts.quantity` marks a one-tap add that leaves the draft alone. */
  async function add(name: string, unit: string, inventoryId: string | null, opts: { quantity?: number; categoryId?: string | null } = {}) {
    const fromDraft = opts.quantity === undefined;
    const quantity = opts.quantity ?? parsed?.quantity;
    if (!quantity || adding) return false;
    setAdding(true);
    const res = await addShoppingItem({
      name,
      quantity,
      unit,
      category_id: opts.categoryId ?? guessCategoryId(name, props.categories),
      inventory_item_id: inventoryId,
      save_to_catalog: false,
    });
    setAdding(false);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    upsertLocal(res.data.item);
    if (fromDraft) setDraft("");
    const cat = res.data.item.category_id ? catById.get(res.data.item.category_id) : null;
    if (res.data.merged) toast.success(`${name} כבר ברשימה, עדכנתי את הכמות`);
    else if (cat) toast(`${name} נוסף ל${cat.name}`);
    return true;
  }

  async function addSmart(sg: SmartSuggestion) {
    setUsedSuggestions((u) => new Set(u).add(sg.key));
    if (props.preview) return void toast.success(`${sg.name} נוסף לרשימה`);
    const ok = await add(sg.name, sg.unit, sg.inventory_item_id, { quantity: 1, categoryId: sg.category_id });
    if (!ok)
      setUsedSuggestions((u) => {
        const n = new Set(u);
        n.delete(sg.key);
        return n;
      });
  }
  function closeStore() {
    setStore(false);
    // Reached via /shopping/mode: land back on the list's own address.
    if (window.location.pathname.startsWith("/shopping/mode")) window.history.replaceState(null, "", "/shopping");
  }

  const smart = (props.suggestions ?? []).filter((sg) => !usedSuggestions.has(sg.key));

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

  const inCart = done.length;

  return (
    <>
      <PageHeader
        title="קניות"
        subtitle={<SyncBadge sync={sync} pendingOps={pendingOps} />}
        actions={
          <>
            <Link href="/shopping/catalog" className="pressable flex h-10 items-center gap-1.5 rounded-full bg-surface px-4 text-[15px] font-semibold shadow-[var(--card-shadow)]">
              <LayoutGrid className="size-[18px]" /> קטלוג
            </Link>
            {pending.length + done.length > 0 && (
              <button type="button" onClick={() => setStore(true)} className="pressable flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-[15px] font-semibold text-primary-foreground">
                <Store className="size-[18px]" /> מצב סופר
              </button>
            )}
          </>
        }
      />

      {/* Two clear places: what's left to buy, and what's already in the cart */}
      <div className="sticky top-[calc(env(safe-area-inset-top)+56px)] z-20 -mx-4 mb-4 px-4 pb-1 lg:top-4">
        <div role="tablist" aria-label="תצוגת רשימה" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-3/80 p-1 backdrop-blur-xl">
          {(
            [
              { id: "buy", label: "לקנות", count: pending.length, icon: <ListTodo className="size-[18px]" /> },
              { id: "cart", label: "בעגלה", count: inCart, icon: <ShoppingCart className="size-[18px]" /> },
            ] as const
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-xl text-[16px] font-semibold transition-all duration-300",
                  active ? "bg-surface text-foreground shadow-[var(--card-shadow)]" : "text-muted",
                )}
              >
                {t.icon}
                {t.label}
                <span
                  key={t.count}
                  className={cn(
                    "num grid h-6 min-w-6 animate-pop place-items-center rounded-full px-1.5 text-[13px] font-bold",
                    active ? (t.id === "cart" ? "bg-primary text-primary-foreground" : "bg-honey-soft text-honey") : "bg-fill text-muted",
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
        {total > 0 && (
          <div className="mt-2 flex h-1 justify-start overflow-hidden rounded-full bg-fill" aria-hidden>
            <div className="h-full rounded-full bg-primary transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ width: `${(inCart / total) * 100}%` }} />
          </div>
        )}
      </div>

      {tab === "buy" && smart.length > 0 && (
        <section aria-label="הצעות חכמות" className="mb-5">
          <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[14px] font-semibold text-primary">
            <Sparkles className="size-4" /> הצעות חכמות
          </h2>
          <div className="scrollbar-none -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
            {smart.map((sg) => (
              <button
                key={sg.key}
                type="button"
                onClick={() => addSmart(sg)}
                disabled={adding}
                className="card pressable flex w-[150px] shrink-0 snap-start flex-col gap-2 p-3 text-start"
              >
                <span className="flex items-start justify-between">
                  <span aria-hidden className="cat-tint grid size-11 place-items-center rounded-[14px] text-[24px]" style={{ "--h": categoryStyle(sg.category_id ? (catById.get(sg.category_id) ?? null) : null).hue } as React.CSSProperties}>
                    <Emoji3D emoji={productEmoji(sg.name, sg.category_id ? catById.get(sg.category_id) : null)} className="size-9" />
                  </span>
                  <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Plus className="size-4" strokeWidth={2.75} />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{sg.name}</span>
                  <span className={cn("block text-[12px] font-medium", sg.reason === "low" ? "text-terracotta" : "text-muted")}>
                    {sg.reason === "low" ? "כנראה נגמר" : "נקנה לעיתים קרובות"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === "buy" ? (
        total === 0 ? (
          <EmptyState icon={<ShoppingCart />} title="הרשימה ריקה" description="כתבו למטה מה צריך, למשל ״2 חלב״. מוצרים שיורדים מתחת למינימום במלאי נכנסים לכאן לבד." />
        ) : pending.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-8 text-center">
            <div className="mb-3 grid size-16 animate-pop place-items-center rounded-full bg-primary text-3xl text-primary-foreground">✓</div>
            <p className="title-2">הכל בעגלה!</p>
            <p className="footnote mt-1 mb-4 text-muted">סיימו את הקנייה כדי לעדכן את המלאי בבית</p>
            <Button size="lg" onClick={() => setFinishOpen(true)}>
              <PackageCheck /> סיום קנייה
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => {
              const category = g.id ? (catById.get(g.id) ?? null) : null;
              const style = categoryStyle(category);
              return (
                <section key={g.id ?? "none"} aria-label={g.name}>
                  <h2 className="mb-2 flex items-center gap-2.5 px-1">
                    <Emoji3D emoji={style.emoji} className="size-8 text-[20px]" />
                    <span className="text-[16px] font-semibold">{g.name}</span>
                    <span className="num cat-ink cat-tint grid h-6 min-w-6 place-items-center rounded-full px-2 text-[12px] font-bold" style={{ "--h": style.hue } as React.CSSProperties}>
                      {g.items.length}
                    </span>
                  </h2>
                  <div className="card overflow-hidden [&>*+*]:border-t [&>*+*]:border-border">
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
                              completeLabel="לעגלה"
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
          </div>
        )
      ) : inCart === 0 ? (
        <EmptyState icon={<ShoppingCart />} title="העגלה ריקה" description="ברשימה, סמנו ✓ כל מוצר שנכנס לעגלה. בסוף לוחצים ״סיום קנייה״ והמלאי מתעדכן." />
      ) : (
        <div className="space-y-3">
          <div className="card overflow-hidden [&>*+*]:border-t [&>*+*]:border-border">
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
          <p className="footnote px-1 text-center text-muted">נגיעה ב-✓ מחזירה מוצר לרשימה</p>
        </div>
      )}

      <div className="h-24" aria-hidden />

      {/* One thumb-reach dock: add on the list, checkout in the cart */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.6rem+62px+10px)] z-30 px-3 lg:start-72 lg:bottom-6">
        <div className="mx-auto max-w-md lg:max-w-xl">
          {tab === "cart" && inCart > 0 ? (
            <Button size="lg" className="w-full shadow-lift" onClick={() => setFinishOpen(true)}>
              <PackageCheck /> סיום קנייה · עדכון המלאי
            </Button>
          ) : (
            <div className="relative flex items-center gap-2">
              {suggestions.length > 0 && (
                <div className="absolute inset-x-0 bottom-full mb-2">
                  <div>
                    <div role="listbox" aria-label="הצעות מהמלאי" className="glass scrollbar-none flex gap-1.5 overflow-x-auto rounded-2xl p-1.5">
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          role="option"
                          aria-selected={false}
                          disabled={adding}
                          onClick={() => addSuggestion(s)}
                          className="pressable flex h-9 shrink-0 items-center gap-1 rounded-full bg-surface px-3 text-[15px] shadow-[var(--card-shadow)]"
                        >
                          <Highlight text={s.name} query={parsed?.name ?? ""} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <form onSubmit={quickAdd} className="glass flex min-w-0 flex-1 items-center gap-1.5 rounded-full p-1.5">
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
              {inCart > 0 && (
                <button
                  type="button"
                  onClick={() => setTab("cart")}
                  className="glass pressable relative grid size-[52px] shrink-0 place-items-center rounded-full text-primary"
                  aria-label={`לעגלה, ${inCart} מוצרים`}
                >
                  <ShoppingCart className="size-[22px]" />
                  <span key={inCart} className="num absolute -top-1 -end-1 grid h-5 min-w-5 animate-pop place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                    {inCart}
                  </span>
                </button>
              )}
            </div>
          )}
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
      {store && (
        <StoreMode
          pending={pending}
          done={done}
          categories={props.categories}
          onToggle={(it) => setStatus(it, it.status === "pending" ? "purchased" : "pending")}
          onFinish={() => setFinishOpen(true)}
          onClose={closeStore}
        />
      )}
      <FinishTripSheet open={finishOpen} onOpenChange={setFinishOpen} purchased={done} inventory={props.inventory} onDone={() => {
          setTab("buy");
          closeStore();
        }}
      />
    </>
  );
}
