"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PackageCheck, ShoppingCart, X } from "lucide-react";
import { useGroceryList } from "@/hooks/use-grocery-list";
import { groupByCategory, splitByStatus } from "@/lib/grocery";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { ActivityRings } from "@/components/dashboard/activity-rings";
import { GroceryItemRow } from "./item-row";
import { FinishTripSheet } from "./finish-trip-sheet";
import { SyncBadge, categoryColor, type GroceryViewProps } from "./grocery-view";

/**
 * Supermarket mode: one-handed, big targets, photos, category chips, works offline.
 * Tapping a row only ever sets "purchased"/"pending" — nothing is deleted here.
 */
export function ShoppingMode(props: GroceryViewProps) {
  const { items, sync, pendingOps, setStatus } = useGroceryList(props);
  const [category, setCategory] = useState<string | "all">("all");
  const [finishOpen, setFinishOpen] = useState(false);

  const { pending, done } = useMemo(() => splitByStatus(items), [items]);
  const groups = useMemo(() => groupByCategory(pending, props.categories), [pending, props.categories]);
  const visibleGroups = category === "all" ? groups : groups.filter((g) => (g.id ?? "none") === category);
  const total = pending.length + done.length;
  const progress = total ? done.length / total : 0;

  return (
    <div className="-mx-4 min-h-dvh">
      <header className="glass-thin sticky top-0 z-30 border-b-[0.5px] border-border px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-3">
          <Link href="/shopping" className="glass pressable grid size-10 place-items-center rounded-full" aria-label="יציאה ממצב קנייה">
            <X className="size-5" strokeWidth={2.5} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="headline">מצב קנייה</h1>
            <SyncBadge sync={sync} pendingOps={pendingOps} />
          </div>
          <div className="relative grid place-items-center">
            <ActivityRings rings={[{ label: "בעגלה", value: progress, color: "#34c759", track: "rgba(52,199,89,0.2)" }]} size={52} />
            <span className="num absolute text-[12px] font-bold">
              {done.length}/{total}
            </span>
          </div>
        </div>
        {groups.length > 1 && (
          <div className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {[{ id: "all", name: "הכול", count: pending.length, color: "var(--foreground)" }, ...groups.map((g) => ({ id: g.id ?? "none", name: g.name, count: g.items.length, color: categoryColor(props.categories, g.id) }))].map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  aria-pressed={active}
                  className={cn("pressable h-9 shrink-0 rounded-full px-4 text-[15px] font-semibold transition-colors", active ? "text-white" : "bg-fill text-foreground/80")}
                  style={active ? { background: c.color === "var(--foreground)" ? "var(--foreground)" : c.color, color: c.color === "var(--foreground)" ? "var(--background)" : "#fff" } : undefined}
                >
                  {c.name} <span className="num opacity-70">{c.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="px-3 pt-4 pb-36">
        {total === 0 ? (
          <EmptyState icon={<ShoppingCart />} title="אין מה לקנות" description="הרשימה ריקה כרגע." />
        ) : (
          <>
            {visibleGroups.map((g) => {
              const color = categoryColor(props.categories, g.id);
              return (
                <section key={g.id ?? "none"} className="mb-5">
                  <h2 className="title-2 mb-2 px-2" style={{ color }}>
                    {g.name}
                  </h2>
                  <div className="space-y-2">
                    {g.items.map((it) => (
                      <div key={it.id} className="pressable animate-fade-up overflow-hidden rounded-[1.5rem] bg-surface">
                        <GroceryItemRow item={it} large color={color} onToggle={() => setStatus(it, "purchased")} onOpen={() => setStatus(it, "purchased")} />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
            {pending.length === 0 && (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 grid size-20 animate-pop place-items-center rounded-full bg-sage text-4xl text-white shadow-[0_12px_32px_-8px_rgba(52,199,89,0.6)]">✓</div>
                <p className="title-2">הכול בעגלה</p>
              </div>
            )}

            {done.length > 0 && (
              <section className="mt-8">
                <h2 className="footnote mb-2 px-2 text-muted">בעגלה · {done.length}</h2>
                <div className="hairline-list-inset overflow-hidden rounded-[1.5rem] bg-surface [--separator-inset:3.5rem]">
                  {done.map((it) => (
                    <GroceryItemRow key={it.id} item={it} color={categoryColor(props.categories, it.category_id)} onToggle={() => setStatus(it, "pending")} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {done.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button size="lg" className="glass mx-auto flex w-full max-w-md !bg-sage text-white shadow-[0_12px_32px_-8px_rgba(52,199,89,0.6)]" onClick={() => setFinishOpen(true)} disabled={sync === "offline"}>
            <PackageCheck /> {sync === "offline" ? "סיום יתאפשר כשיחזור החיבור" : `סיום קנייה · ${done.length} בעגלה`}
          </Button>
        </div>
      )}

      <FinishTripSheet open={finishOpen} onOpenChange={setFinishOpen} purchased={done} inventory={props.inventory} />
    </div>
  );
}
