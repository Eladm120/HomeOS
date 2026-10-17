"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, CloudOff, PackageCheck, Plus, ShoppingCart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { addShoppingItem } from "@/server/actions/grocery";
import { useGroceryList, type SyncState } from "@/hooks/use-grocery-list";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { groupByCategory, splitByStatus } from "@/lib/grocery";
import type { ProductCategory, ShoppingListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
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
}

export function SyncBadge({ sync, pendingOps }: { sync: SyncState; pendingOps: number }) {
  if (sync === "live" && !pendingOps) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-sage">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-sage opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-sage" />
        </span>
        מסונכרן
      </span>
    );
  }
  if (sync === "offline") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber">
        <CloudOff className="size-3.5" /> לא מקוון{pendingOps ? ` · ${pendingOps} שינויים ממתינים` : ""}
      </span>
    );
  }
  return <span className="text-xs text-muted">מתחבר…{pendingOps ? ` · ${pendingOps} ממתינים` : ""}</span>;
}

export function GroceryView(props: GroceryViewProps) {
  const { items, sync, pendingOps, setStatus, upsertLocal, removeLocal } = useGroceryList(props);
  const [editing, setEditing] = useState<ShoppingListItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quick, setQuick] = useState("");
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  useOpenFromQuery(() => {
    setEditing(null);
    setSheetOpen(true);
  });

  const { pending, done } = useMemo(() => splitByStatus(items), [items]);
  const groups = useMemo(() => groupByCategory(pending, props.categories), [pending, props.categories]);

  const nameOf = (id: string | null) => (id ? (id === props.currentUserId ? "את/ה" : props.memberNames[id]) : undefined);

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = quick.trim();
    if (!name) return;
    setAdding(true);
    const res = await addShoppingItem({ name, save_to_catalog: false });
    setAdding(false);
    if (!res.ok) return void toast.error(res.error);
    upsertLocal(res.data.item);
    setQuick("");
    if (res.data.merged) toast.success(`"${name}" כבר ברשימה — הכמות עודכנה`);
  }

  return (
    <>
      <PageHeader
        title="רשימת קניות"
        subtitle={<SyncBadge sync={sync} pendingOps={pendingOps} />}
        actions={
          <Link href="/shopping/mode" className={buttonVariants({ variant: "soft", size: "sm" })}>
            <ShoppingCart /> מצב קנייה
          </Link>
        }
      />

      <form onSubmit={quickAdd} className="sticky top-0 z-20 -mx-4 mb-4 bg-background/85 px-4 py-2 backdrop-blur-md sm:mx-0 sm:px-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              placeholder="הוספה מהירה — למשל: חלב"
              aria-label="הוספה מהירה"
              maxLength={120}
              className="h-12 w-full rounded-full border border-border bg-surface ps-5 pe-12 text-[16px] shadow-soft outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            <button
              type="submit"
              disabled={!quick.trim() || adding}
              aria-label="הוספה"
              className="absolute end-1.5 top-1.5 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40"
            >
              <Plus className="size-5" />
            </button>
          </div>
          <Button type="button" variant="outline" size="icon" className="size-12" onClick={openNew} aria-label="הוספה מפורטת עם תמונה">
            <Sparkles />
          </Button>
        </div>
      </form>

      {pending.length === 0 && done.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShoppingCart />}
            title="הרשימה ריקה"
            description="מה צריך לקנות? הוסיפו מוצר, ושני בני הבית יראו אותו מיד."
            action={
              <Button onClick={openNew}>
                <Plus /> הוספת מוצר
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.id ?? "none"} aria-label={g.name}>
              <h2 className="mb-1.5 flex items-center gap-2 px-1 text-xs font-semibold tracking-wide text-muted">
                {g.name}
                <span className="num font-normal">{g.items.length}</span>
              </h2>
              <Card className="divide-y divide-border/60 p-1">
                {g.items.map((it) => (
                  <GroceryItemRow
                    key={it.id}
                    item={it}
                    addedByName={nameOf(it.added_by)}
                    onToggle={() => setStatus(it, "purchased")}
                    onOpen={() => {
                      setEditing(it);
                      setSheetOpen(true);
                    }}
                  />
                ))}
              </Card>
            </section>
          ))}

          {pending.length === 0 && done.length > 0 && (
            <p className="py-4 text-center text-sm text-muted">הכול נקנה! 🎉</p>
          )}

          {done.length > 0 && (
            <section>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowDone((v) => !v)} className="flex flex-1 items-center gap-2 px-1 py-2 text-sm font-medium text-muted" aria-expanded={showDone}>
                  <ChevronDown className={cn("size-4 transition-transform", showDone && "rotate-180")} />
                  נקנו ({done.length})
                </button>
                <Button size="sm" variant="secondary" onClick={() => setFinishOpen(true)}>
                  <PackageCheck /> סיום קנייה
                </Button>
              </div>
              {showDone && (
                <Card className="mt-1 divide-y divide-border/60 p-1">
                  {done.map((it) => (
                    <GroceryItemRow key={it.id} item={it} onToggle={() => setStatus(it, "pending")} />
                  ))}
                </Card>
              )}
            </section>
          )}
        </div>
      )}

      <GroceryItemSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        householdId={props.householdId}
        categories={props.categories}
        item={editing}
        addedByName={editing ? nameOf(editing.added_by) : undefined}
        onSaved={upsertLocal}
        onDeleted={removeLocal}
      />
      <FinishTripSheet open={finishOpen} onOpenChange={setFinishOpen} purchased={done} inventory={props.inventory} />
    </>
  );
}
