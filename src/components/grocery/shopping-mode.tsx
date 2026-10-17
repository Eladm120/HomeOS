"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PackageCheck, ShoppingCart, X } from "lucide-react";
import { useGroceryList } from "@/hooks/use-grocery-list";
import { groupByCategory, splitByStatus } from "@/lib/grocery";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { GroceryItemRow } from "./item-row";
import { FinishTripSheet } from "./finish-trip-sheet";
import { SyncBadge, type GroceryViewProps } from "./grocery-view";

/**
 * Supermarket mode: big touch targets, photos, category grouping, works offline.
 * Tapping an item only ever sets "purchased"/"pending" — nothing is deleted here.
 */
export function ShoppingMode(props: GroceryViewProps) {
  const { items, sync, pendingOps, setStatus } = useGroceryList(props);
  const [category, setCategory] = useState<string | "all">("all");
  const [finishOpen, setFinishOpen] = useState(false);

  const { pending, done } = useMemo(() => splitByStatus(items), [items]);
  const groups = useMemo(() => groupByCategory(pending, props.categories), [pending, props.categories]);
  const visibleGroups = category === "all" ? groups : groups.filter((g) => (g.id ?? "none") === category);
  const total = pending.length + done.length;
  const progress = total ? Math.round((done.length / total) * 100) : 0;

  return (
    <div className="-mx-4 min-h-dvh sm:mx-0">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link href="/shopping" className="grid size-11 place-items-center rounded-full bg-surface-2" aria-label="יציאה ממצב קנייה">
            <X className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">מצב קנייה</h1>
            <SyncBadge sync={sync} pendingOps={pendingOps} />
          </div>
          <div className="text-end">
            <div className="num text-lg font-semibold">
              {done.length}/{total}
            </div>
            <div className="text-[11px] text-muted">בעגלה</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-sage transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        {groups.length > 1 && (
          <div className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {[{ id: "all", name: "הכול", count: pending.length }, ...groups.map((g) => ({ id: g.id ?? "none", name: g.name, count: g.items.length }))].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
                className={cn(
                  "h-9 shrink-0 rounded-full px-4 text-sm transition-all",
                  category === c.id ? "bg-foreground font-medium text-background" : "bg-surface-2 text-muted",
                )}
              >
                {c.name} <span className="num opacity-70">{c.count}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="px-3 pt-3 pb-32">
        {total === 0 ? (
          <EmptyState icon={<ShoppingCart />} title="אין מה לקנות" description="הרשימה ריקה כרגע." />
        ) : (
          <>
            {visibleGroups.map((g) => (
              <section key={g.id ?? "none"} className="mb-4">
                <h2 className="px-2 pb-1 text-sm font-semibold text-muted">{g.name}</h2>
                <div className="space-y-1.5">
                  {g.items.map((it) => (
                    <div key={it.id} className="rounded-3xl border border-border/70 bg-surface shadow-soft">
                      <GroceryItemRow item={it} large onToggle={() => setStatus(it, "purchased")} onOpen={() => setStatus(it, "purchased")} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {pending.length === 0 && <p className="py-6 text-center text-base font-medium text-sage">הכול בעגלה! 🎉</p>}

            {done.length > 0 && (
              <section className="mt-6">
                <h2 className="px-2 pb-1 text-sm font-semibold text-muted">בעגלה ({done.length})</h2>
                <div className="space-y-1">
                  {done.map((it) => (
                    <div key={it.id} className="rounded-3xl bg-surface-2/60">
                      <GroceryItemRow item={it} onToggle={() => setStatus(it, "pending")} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {done.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <Button size="lg" className="mx-auto flex w-full max-w-lg" onClick={() => setFinishOpen(true)} disabled={sync === "offline"}>
            <PackageCheck /> {sync === "offline" ? "סיום קנייה יתאפשר כשיחזור החיבור" : "סיום קנייה"}
          </Button>
        </div>
      )}

      <FinishTripSheet open={finishOpen} onOpenChange={setFinishOpen} purchased={done} inventory={props.inventory} />
    </div>
  );
}
