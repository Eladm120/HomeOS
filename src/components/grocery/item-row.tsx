"use client";

import { useState } from "react";
import { Check, Flag, ShoppingBasket, StickyNote } from "lucide-react";
import type { ShoppingListItem } from "@/lib/types";
import { formatQuantityWithUnit } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ImageViewer, SignedImage } from "@/components/media/signed-image";

export function CheckCircle({ checked, onToggle, size = "md", label }: { checked: boolean; onToggle: () => void; size?: "md" | "lg"; label: string }) {
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
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-2 transition-all active:scale-90",
        size === "lg" ? "size-11" : "size-8",
        checked ? "animate-pop border-sage bg-sage text-white" : "border-border bg-surface hover:border-sage",
      )}
    >
      {checked && <Check className={size === "lg" ? "size-6" : "size-4"} strokeWidth={3} />}
    </button>
  );
}

export function GroceryItemRow({
  item,
  addedByName,
  onToggle,
  onOpen,
  large,
}: {
  item: ShoppingListItem;
  addedByName?: string;
  onToggle: () => void;
  onOpen?: () => void;
  large?: boolean;
}) {
  const [viewer, setViewer] = useState(false);
  const done = item.status === "purchased";
  const meta = [item.brand, item.variant].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 transition-all",
        large ? "min-h-20 py-3" : "min-h-16 py-2.5",
        onOpen && "cursor-pointer hover:bg-surface-2/60",
        done && "opacity-55",
      )}
      onClick={onOpen}
    >
      <CheckCircle checked={done} onToggle={onToggle} size={large ? "lg" : "md"} label={done ? `ביטול סימון ${item.name}` : `סימון ${item.name} כנקנה`} />

      {item.image_path ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setViewer(true);
          }}
          className={cn("shrink-0 overflow-hidden rounded-xl border border-border/70", large ? "size-16" : "size-12")}
          aria-label={`הגדלת תמונה של ${item.name}`}
        >
          <SignedImage path={item.image_path} alt={item.name} className="size-full" />
        </button>
      ) : large ? (
        <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted/60">
          <ShoppingBasket className="size-6" />
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {item.priority === "high" && !done && <Flag className="size-3.5 shrink-0 text-danger" aria-label="דחוף" />}
          <span className={cn("truncate font-medium", large ? "text-lg" : "text-[15px]", done && "line-through decoration-muted/60")}>{item.name}</span>
        </div>
        {(meta || item.notes) && (
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            {meta && <span className="truncate">{meta}</span>}
            {item.notes && (
              <span className="flex min-w-0 items-center gap-1 truncate">
                <StickyNote className="size-3 shrink-0" />
                {large ? item.notes : ""}
              </span>
            )}
          </div>
        )}
        {addedByName && !large && <div className="mt-0.5 text-[11px] text-muted/80">{addedByName}</div>}
      </div>

      <span className={cn("num shrink-0 rounded-full bg-surface-2 px-2.5 py-1 font-medium", large ? "text-base" : "text-sm")}>
        {formatQuantityWithUnit(item.quantity, item.unit)}
      </span>

      {item.image_path && <ImageViewer path={item.image_path} alt={item.name} open={viewer} onOpenChange={setViewer} />}
    </div>
  );
}
