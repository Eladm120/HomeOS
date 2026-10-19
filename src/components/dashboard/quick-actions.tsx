"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, ChefHat, ChevronLeft, ListPlus, ShoppingBasket } from "lucide-react";
import type { ProductCategory } from "@/lib/types";
import { Sheet } from "@/components/ui/sheet";
import { QuickAddRow } from "./widgets";

/** Four everyday starts, one row, all thumb-reachable. */
export function QuickActions({ categories, inventory, preview }: { categories: ProductCategory[]; inventory: { id: string; name: string; unit: string }[]; preview?: boolean }) {
  const [add, setAdd] = useState(false);
  const [capture, setCapture] = useState(false);

  // Keycaps: each action is a small physical key with its own ink colour.
  const btn = "key flex flex-col items-center justify-center gap-1.5 py-3 text-center";
  const icon = "grid size-9 place-items-center rounded-xl";
  return (
    <>
      <nav aria-label="פעולות מהירות" className="grid grid-cols-4 gap-2.5">
        <button type="button" className={btn} onClick={() => setAdd(true)}>
          <span className={`${icon} bg-primary-soft text-primary`}>
            <ShoppingBasket className="size-6" strokeWidth={2.1} />
          </span>
          <span className="text-[12px] leading-tight font-semibold text-foreground/85">מוצר לסופר</span>
        </button>
        <button type="button" className={btn} onClick={() => setCapture(true)}>
          <span className={`${icon} bg-terracotta-soft text-terracotta`}>
            <Camera className="size-6" strokeWidth={2.1} />
          </span>
          <span className="text-[12px] leading-tight font-semibold text-foreground/85">צילום</span>
        </button>
        <Link href="/recipes/new" className={btn}>
          <span className={`${icon} bg-honey-soft text-honey`}>
            <ChefHat className="size-6" strokeWidth={2.1} />
          </span>
          <span className="text-[12px] leading-tight font-semibold text-foreground/85">מתכון</span>
        </Link>
        <Link href="/chores?new=1" className={btn}>
          <span className={`${icon} bg-sage-soft text-sage`}>
            <ListPlus className="size-6" strokeWidth={2.1} />
          </span>
          <span className="text-[12px] leading-tight font-semibold text-foreground/85">משימה</span>
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

      <Sheet open={capture} onOpenChange={setCapture} title="מה מצלמים?">
        <ul className="space-y-2">
          {[
            { href: "/receipts", emoji: "🧾", title: "קבלה מהסופר", text: "המוצרים נכנסים למלאי אחרי בדיקה" },
            { href: "/scan", emoji: "📦", title: "מוצר או ברקוד", text: "מוסיפים למלאי בלי להקליד" },
            { href: "/recipes/new", emoji: "🍳", title: "מתכון", text: "מספר, ממחברת או צילום מסך" },
            { href: "/bills", emoji: "💡", title: "חשבון לתשלום", text: "חשמל, מים, ארנונה" },
          ].map((o) => (
            <li key={o.href}>
              <Link href={o.href} onClick={() => setCapture(false)} className="pressable flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-[22px]">
                  {o.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{o.title}</span>
                  <span className="footnote block text-muted">{o.text}</span>
                </span>
                <ChevronLeft className="size-5 text-muted-2" />
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
