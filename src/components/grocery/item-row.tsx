"use client";

import { useState } from "react";
import { Check, Info } from "lucide-react";
import type { ShoppingListItem } from "@/lib/types";
import { formatQuantityWithUnit } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ImageViewer, SignedImage } from "@/components/media/signed-image";

/** Reminders-style circular checkbox that fills with the list color. */
export function CheckCircle({
  checked,
  onToggle,
  size = "md",
  label,
  color = "var(--primary)",
}: {
  checked: boolean;
  onToggle: () => void;
  size?: "md" | "lg";
  label: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        if (navigator.vibrate) navigator.vibrate(8);
        onToggle();
      }}
      className={cn("grid shrink-0 place-items-center rounded-full transition-all duration-300 active:scale-90", size === "lg" ? "size-9" : "size-[26px]")}
      style={checked ? { background: color, boxShadow: `0 0 0 0 ${color}` } : { boxShadow: `inset 0 0 0 1.75px var(--muted-2)` }}
    >
      {checked && <Check className={cn("animate-pop text-white", size === "lg" ? "size-5" : "size-[15px]")} strokeWidth={3.25} />}
    </button>
  );
}

export function GroceryItemRow({
  item,
  addedByName,
  onToggle,
  onOpen,
  large,
  color,
}: {
  item: ShoppingListItem;
  addedByName?: string;
  onToggle: () => void;
  onOpen?: () => void;
  large?: boolean;
  color?: string;
}) {
  const [viewer, setViewer] = useState(false);
  const done = item.status === "purchased";
  const meta = [item.brand, item.variant].filter(Boolean).join(" · ");

  return (
    <div className={cn("flex items-center gap-3 ps-4 pe-3", large ? "min-h-[76px] py-3" : "min-h-[60px] py-2.5")}>
      <CheckCircle
        checked={done}
        onToggle={onToggle}
        size={large ? "lg" : "md"}
        color={color}
        label={done ? `ביטול סימון ${item.name}` : `סימון ${item.name} כנקנה`}
      />

      <button type="button" onClick={onOpen} disabled={!onOpen} className="min-w-0 flex-1 text-start disabled:cursor-default">
        <span className={cn("flex items-center gap-1.5 transition-colors", done && "text-muted")}>
          {item.priority === "high" && !done && (
            <span aria-label="דחוף" className="shrink-0 text-[17px] font-bold" style={{ color: "var(--danger)" }}>
              !!
            </span>
          )}
          <span className={cn("truncate", large ? "text-[20px] font-medium" : "text-[17px]")}>{item.name}</span>
        </span>
        {(meta || item.notes || (addedByName && !large)) && (
          <span className="footnote mt-0.5 flex gap-1 truncate text-muted">
            {(meta || (large && item.notes)) && <span className="truncate">{[meta, large ? item.notes : null].filter(Boolean).join(" · ")}</span>}
            {!large && addedByName && (
              <>
                {meta && <span aria-hidden>·</span>}
                <span>{addedByName}</span>
              </>
            )}
          </span>
        )}
      </button>

      <span className={cn("num shrink-0 text-muted", large ? "text-[17px] font-semibold" : "text-[15px]")}>{formatQuantityWithUnit(item.quantity, item.unit)}</span>

      {item.image_path && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setViewer(true);
          }}
          className={cn("shrink-0 overflow-hidden rounded-[10px] transition-opacity", large ? "size-14" : "size-10", done && "opacity-50")}
          aria-label={`הגדלת תמונה של ${item.name}`}
        >
          <SignedImage path={item.image_path} alt={item.name} className="size-full" />
        </button>
      )}

      {onOpen && !large && (
        <button type="button" onClick={onOpen} className="grid size-8 shrink-0 place-items-center rounded-full text-primary active:bg-fill" aria-label={`פרטים על ${item.name}`}>
          <Info className="size-[22px]" strokeWidth={1.75} />
        </button>
      )}

      {item.image_path && <ImageViewer path={item.image_path} alt={item.name} open={viewer} onOpenChange={setViewer} />}
    </div>
  );
}
