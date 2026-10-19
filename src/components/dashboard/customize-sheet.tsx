"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
import { moveWidget, toggleWidget, WIDGETS, type DashboardLayout, type WidgetId } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/** Each member arranges their own home screen: order, and what to hide. */
export function CustomizeSheet({
  open,
  onOpenChange,
  layout,
  onChange,
  onReset,
  unavailable,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  layout: DashboardLayout;
  onChange: (l: DashboardLayout) => void;
  onReset: () => void;
  /** Widgets that have nothing to show yet, with the reason. */
  unavailable: Partial<Record<WidgetId, string>>;
  saving: boolean;
}) {
  const byId = new Map(WIDGETS.map((w) => [w.id, w]));
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="המסך שלי"
      description="סדרו מה מופיע ראשון. השינוי נשמר רק אצלך."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="flex-1" onClick={onReset}>
            איפוס
          </Button>
          <Button className="flex-1" onClick={() => onOpenChange(false)} loading={saving}>
            סיום
          </Button>
        </div>
      }
    >
      <ul className="space-y-1.5">
        {layout.order.map((id, i) => {
          const w = byId.get(id)!;
          const hidden = layout.hidden.includes(id);
          return (
            <li key={id} className={cn("flex items-center gap-2 rounded-2xl bg-surface-2 p-2 ps-3 transition-opacity", hidden && "opacity-55")}>
              <span aria-hidden className="text-[20px]">
                {w.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{w.label}</span>
                {unavailable[id] && <span className="block truncate text-[12px] text-muted">{unavailable[id]}</span>}
              </span>
              <button type="button" disabled={i === 0} onClick={() => onChange(moveWidget(layout, id, -1))} className="grid size-9 place-items-center rounded-full disabled:opacity-25 active:bg-fill" aria-label={`${w.label} למעלה`}>
                <ArrowUp className="size-4" />
              </button>
              <button type="button" disabled={i === layout.order.length - 1} onClick={() => onChange(moveWidget(layout, id, 1))} className="grid size-9 place-items-center rounded-full disabled:opacity-25 active:bg-fill" aria-label={`${w.label} למטה`}>
                <ArrowDown className="size-4" />
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={!hidden}
                onClick={() => onChange(toggleWidget(layout, id))}
                className={cn("grid size-9 place-items-center rounded-full", hidden ? "bg-fill text-muted" : "bg-primary-soft text-primary")}
                aria-label={hidden ? `הצגת ${w.label}` : `הסתרת ${w.label}`}
              >
                {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-2 p-2 ps-3">
        <span className="font-semibold">מראה בהיר / כהה</span>
        <ThemeToggle />
      </div>
    </Sheet>
  );
}
