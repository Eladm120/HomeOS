"use client";

import { useState } from "react";
import Link from "next/link";
import { BookmarkPlus, ChevronLeft, ListPlus, ScanLine, ShoppingCart } from "lucide-react";
import type { ProductCategory } from "@/lib/types";
import { Sheet } from "@/components/ui/sheet";
import { QuickAddRow } from "./widgets";

/** Four everyday starts, one row, all thumb-reachable — each wears its module's colour. */
export function QuickActions({ categories, inventory, preview }: { categories: ProductCategory[]; inventory: { id: string; name: string; unit: string }[]; preview?: boolean }) {
  const [add, setAdd] = useState(false);

  const tile = "mod-tile pressable flex flex-col items-center gap-2 px-1 pt-3 pb-2.5 text-center";
  const chip = "mod-chip grid size-11 place-items-center rounded-[15px]";
  const label = "text-[12.5px] leading-tight font-semibold";
  const hue = (h: number) => ({ "--h": h }) as React.CSSProperties;
  return (
    <>
      <nav aria-label="פעולות מהירות" className="grid grid-cols-4 gap-2">
        <button type="button" className={tile} style={hue(155)} onClick={() => setAdd(true)}>
          <span className={chip}>
            <ShoppingCart className="size-[21px]" strokeWidth={2} />
          </span>
          <span className={label}>הוספת פריט</span>
        </button>
        <Link href="/receipts" className={tile} style={hue(280)}>
          <span className={chip}>
            <ScanLine className="size-[21px]" strokeWidth={2} />
          </span>
          <span className={label}>סריקת קבלה</span>
        </Link>
        <Link href="/recipes/new" className={tile} style={hue(40)}>
          <span className={chip}>
            <BookmarkPlus className="size-[21px]" strokeWidth={2} />
          </span>
          <span className={label}>שמירת מתכון</span>
        </Link>
        <Link href="/chores?new=1" className={tile} style={hue(75)}>
          <span className={chip}>
            <ListPlus className="size-[21px]" strokeWidth={2} />
          </span>
          <span className={label}>הוספת משימה</span>
        </Link>
      </nav>

      <Sheet open={add} onOpenChange={setAdd} title="מוצר לרשימת הקניות" description="כתבו שם וכמות, או בחרו מהמוצרים שכבר בבית.">
        <div className="-mx-3">
          <QuickAddRow categories={categories} inventory={inventory} preview={preview} autoFocus />
        </div>
        <Link href="/shopping" className="mt-1 flex items-center gap-1 text-[14px] font-medium text-primary">
          לרשימה המלאה <ChevronLeft className="size-4" />
        </Link>
      </Sheet>
    </>
  );
}
