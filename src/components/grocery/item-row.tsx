"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { ProductCategory, ShoppingListItem } from "@/lib/types";
import { formatQuantityWithUnit } from "@/lib/format";
import { categoryStyle, productEmoji } from "@/lib/category-style";
import { cn } from "@/lib/utils";
import { ImageViewer, SignedImage } from "@/components/media/signed-image";
import { Emoji3D } from "@/components/ui/emoji-3d";

/** Round checkbox; the check mark pops in when it is ticked. */
export function CheckCircle({
  checked,
  onToggle,
  label,
  size = "md",
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  size?: "md" | "lg";
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
      className={cn(
        "grid shrink-0 place-items-center rounded-full transition-all duration-300 active:scale-90",
        size === "lg" ? "size-9" : "size-[30px]",
        checked ? "bg-primary" : "shadow-[inset_0_0_0_2px_var(--muted-2)]",
      )}
    >
      {checked && <Check className={cn("animate-pop text-primary-foreground", size === "lg" ? "size-5" : "size-[17px]")} strokeWidth={3.25} />}
    </button>
  );
}

/** Product picture: the uploaded photo when there is one, else a tinted emoji tile. */
export function ProductThumb({
  name,
  imagePath,
  category,
  className,
  onOpenPhoto,
  dim,
}: {
  name: string;
  imagePath: string | null;
  category: Pick<ProductCategory, "name" | "icon"> | null;
  className?: string;
  onOpenPhoto?: () => void;
  dim?: boolean;
}) {
  const style = categoryStyle(category);
  const base = cn("size-11 shrink-0 overflow-hidden rounded-[14px] transition-[filter,opacity]", dim && "opacity-60 grayscale-[0.5]", className);
  if (imagePath) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenPhoto?.();
        }}
        className={base}
        aria-label={`הגדלת תמונה של ${name}`}
      >
        <SignedImage path={imagePath} alt={name} className="size-full" />
      </button>
    );
  }
  return (
    <span aria-hidden className={cn("cat-tint grid place-items-center text-[24px] leading-none", base)} style={{ "--h": style.hue } as React.CSSProperties}>
      <Emoji3D emoji={productEmoji(name, category)} className="size-[82%]" />
    </span>
  );
}

export function GroceryItemRow({
  item,
  category,
  addedByName,
  checked,
  onToggle,
  onOpen,
}: {
  item: ShoppingListItem;
  category: Pick<ProductCategory, "name" | "icon"> | null;
  addedByName?: string;
  /** Visual state; may run ahead of item.status while the check animation plays. */
  checked: boolean;
  onToggle: () => void;
  onOpen?: () => void;
}) {
  const [viewer, setViewer] = useState(false);
  const meta = [item.brand, item.variant, item.notes, addedByName].filter(Boolean).join(" · ");

  return (
    <div className="flex min-h-[66px] items-center gap-3 py-2.5 ps-3.5 pe-3.5">
      <CheckCircle checked={checked} onToggle={onToggle} label={checked ? `החזרת ${item.name} לרשימה` : `סימון ${item.name} כנקנה`} />
      <ProductThumb name={item.name} imagePath={item.image_path} category={category} dim={checked} onOpenPhoto={() => setViewer(true)} className="size-12" />

      <button type="button" onClick={onOpen} disabled={!onOpen} className="min-w-0 flex-1 text-start disabled:cursor-default">
        <span className={cn("flex items-center gap-2 transition-colors", checked && "text-muted")}>
          <span className={cn("truncate text-[17px] font-medium", checked && "line-through decoration-2")}>{item.name}</span>
          {item.priority === "high" && !checked && (
            <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-[12px] font-semibold text-danger">דחוף</span>
          )}
        </span>
        {meta && <span className="footnote mt-0.5 block truncate text-muted">{meta}</span>}
      </button>

      <span className={cn("num grid h-8 shrink-0 place-items-center rounded-full bg-primary-soft px-3 text-[14px] font-bold text-primary", checked && "bg-fill text-muted opacity-70")}>{formatQuantityWithUnit(item.quantity, item.unit)}</span>

      {item.image_path && <ImageViewer path={item.image_path} alt={item.name} open={viewer} onOpenChange={setViewer} />}
    </div>
  );
}
