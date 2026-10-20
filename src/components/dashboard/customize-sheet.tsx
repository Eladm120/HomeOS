"use client";

import { Emoji3D } from "@/components/ui/emoji-3d";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff } from "lucide-react";
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
                <Emoji3D emoji={w.emoji} className="size-[72%]" />
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
      <AccentPicker />
      <div className="mt-2 flex items-center justify-between rounded-2xl bg-surface-2 p-2 ps-3">
        <span className="font-semibold">מראה בהיר / כהה</span>
        <ThemeToggle />
      </div>
    </Sheet>
  );
}

const ACCENTS = [
  { id: "mint", label: "מרווה", swatch: "#77aa91" },
  { id: "mauve", label: "לילך", swatch: "#a99fe0" },
  { id: "gold", label: "משמש", swatch: "#f0bd84" },
  { id: "peach", label: "טרקוטה", swatch: "#e08a66" },
] as const;

/** The house colour, per device: applied on <html data-accent> before first paint (see the root layout). */
function AccentPicker() {
  const [accent, setAccent] = useState<string>("mint");
  useEffect(() => setAccent(document.documentElement.dataset.accent ?? "mint"), []);
  function pick(id: string) {
    setAccent(id);
    if (id === "mint") delete document.documentElement.dataset.accent;
    else document.documentElement.dataset.accent = id;
    try {
      if (id === "mint") localStorage.removeItem("homeos:accent");
      else localStorage.setItem("homeos:accent", id);
    } catch {
      /* private mode: this visit only */
    }
  }
  return (
    <div className="mt-4 rounded-2xl bg-surface-2 p-3">
      <p className="mb-2.5 font-semibold">צבע הבית</p>
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="צבע הבית">
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={accent === a.id}
            onClick={() => pick(a.id)}
            className="flex flex-col items-center gap-1.5 rounded-xl py-1.5 text-[12px] font-medium"
          >
            <span
              className={cn("grid size-10 place-items-center rounded-full transition-shadow", accent === a.id && "shadow-[0_0_0_2px_var(--surface-2),0_0_0_4px_var(--foreground)]")}
              style={{ background: a.swatch }}
            >
              {accent === a.id && <Check className="size-4 text-black/70" strokeWidth={3} />}
            </span>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
