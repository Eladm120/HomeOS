"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUp, Camera, ChevronDown, CloudOff, PackageCheck, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { addShoppingItem, deleteShoppingItem, restoreShoppingItem } from "@/server/actions/grocery";
import { useGroceryList, type SyncState } from "@/hooks/use-grocery-list";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { groupByCategory, splitByStatus } from "@/lib/grocery";
import { parseBulkLine } from "@/lib/validation";
import type { ProductCategory, ShoppingListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
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

const CATEGORY_COLORS = ["#34c759", "#007aff", "#ff3b30", "#ff9500", "#5856d6", "#30b0c7", "#af52de", "#ff2d55", "#a2845e", "#64d2ff", "#8e8e93"];

export function categoryColor(categories: Pick<ProductCategory, "id">[], id: string | null): string {
  const idx = id ? categories.findIndex((c) => c.id === id) : -1;
  return idx >= 0 ? CATEGORY_COLORS[idx % CATEGORY_COLORS.length] : "#8e8e93";
}

export function SyncBadge({ sync, pendingOps }: { sync: SyncState; pendingOps: number }) {
  if (sync === "live" && !pendingOps) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-sage">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-sage opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-sage" />
        </span>
        מסונכרן בזמן אמת
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

export function GroceryView(props: GroceryViewProps) {
  const { items, sync, pendingOps, setStatus, upsertLocal, removeLocal } = useGroceryList(props);
  const [editing, setEditing] = useState<ShoppingListItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  useOpenFromQuery(() => openNew());

  const { pending, done } = useMemo(() => splitByStatus(items), [items]);
  const groups = useMemo(() => groupByCategory(pending, props.categories), [pending, props.categories]);
  const total = pending.length + done.length;
  const parsed = useMemo(() => parseBulkLine(draft), [draft]);

  const nameOf = (id: string | null) => (id ? (id === props.currentUserId ? undefined : props.memberNames[id]) : undefined);

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed) return;
    setAdding(true);
    const res = await addShoppingItem({ name: parsed.name, quantity: parsed.quantity, unit: parsed.unit, save_to_catalog: false });
    setAdding(false);
    if (!res.ok) return void toast.error(res.error);
    upsertLocal(res.data.item);
    setDraft("");
    if (res.data.merged) toast.success(`${parsed.name} כבר ברשימה, עדכנתי את הכמות`);
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

  return (
    <>
      <PageHeader
        title="קניות"
        subtitle={<SyncBadge sync={sync} pendingOps={pendingOps} />}
        actions={
          <Link href="/shopping/mode" className="glass pressable flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-semibold text-primary">
            <ShoppingCart className="size-[18px]" /> מצב קנייה
          </Link>
        }
      />

      {total > 0 && (
        <div className="mb-5 flex items-center gap-3 px-1">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
            <div className="h-full rounded-full bg-sage transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ width: `${(done.length / total) * 100}%` }} />
          </div>
          <span className="num footnote shrink-0 font-semibold text-muted">
            {done.length}/{total}
          </span>
        </div>
      )}

      {total === 0 ? (
        <EmptyState
          icon={<ShoppingCart />}
          title="הרשימה ריקה"
          description="כתבו למטה מה צריך, למשל ״2 חלב״. שניכם תראו את זה מיד."
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            const color = categoryColor(props.categories, g.id);
            return (
              <section key={g.id ?? "none"} aria-label={g.name} className="animate-fade-up">
                <h2 className="mb-2 flex items-baseline gap-2 px-1">
                  <span className="title-2" style={{ color }}>
                    {g.name}
                  </span>
                  <span className="num footnote text-muted">{g.items.length}</span>
                </h2>
                <Card className="hairline-list-inset [--separator-inset:3.5rem]">
                  {g.items.map((it) => (
                    <SwipeRow key={it.id} onComplete={() => setStatus(it, "purchased")} onDelete={() => remove(it)} completeLabel="נקנה">
                      <GroceryItemRow
                        item={it}
                        color={color}
                        addedByName={nameOf(it.added_by)}
                        onToggle={() => setStatus(it, "purchased")}
                        onOpen={() => {
                          setEditing(it);
                          setSheetOpen(true);
                        }}
                      />
                    </SwipeRow>
                  ))}
                </Card>
              </section>
            );
          })}

          {pending.length === 0 && done.length > 0 && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-2 grid size-16 animate-pop place-items-center rounded-full bg-sage text-3xl text-white">✓</div>
              <p className="headline">הכול בעגלה</p>
            </div>
          )}

          {done.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between px-1">
                <button type="button" onClick={() => setShowDone((v) => !v)} className="flex items-center gap-1 text-[15px] font-semibold text-muted" aria-expanded={showDone}>
                  נקנו · <span className="num">{done.length}</span>
                  <ChevronDown className={cn("size-4 transition-transform duration-300", showDone && "rotate-180")} />
                </button>
                <Button size="sm" variant="soft" onClick={() => setFinishOpen(true)}>
                  <PackageCheck /> סיום קנייה
                </Button>
              </div>
              {showDone && (
                <Card className="hairline-list-inset animate-fade-up [--separator-inset:3.5rem]">
                  {done.map((it) => (
                    <SwipeRow key={it.id} onComplete={() => setStatus(it, "pending")} onDelete={() => remove(it)} completeLabel="החזרה">
                      <GroceryItemRow item={it} color={categoryColor(props.categories, it.category_id)} onToggle={() => setStatus(it, "pending")} />
                    </SwipeRow>
                  ))}
                </Card>
              )}
            </section>
          )}
          <p className="caption px-1 text-center text-muted">טיפ: החליקו שורה ימינה לסימון, שמאלה למחיקה</p>
        </div>
      )}

      <div className="h-20" aria-hidden />

      {/* Floating Liquid Glass composer — sits above the tab bar, in thumb reach */}
      <form
        onSubmit={quickAdd}
        className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.6rem+62px+10px)] z-30 px-3 lg:start-72 lg:bottom-6"
      >
        <div className="glass mx-auto flex max-w-md items-center gap-1.5 rounded-full p-1.5 lg:max-w-xl">
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
            className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white transition-opacity disabled:opacity-30"
          >
            <ArrowUp className="size-5" strokeWidth={2.75} />
          </button>
        </div>
      </form>

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
