"use client";

import Link from "next/link";
import { BookmarkPlus, FileText, ListPlus, PackagePlus, ScanLine, ShoppingCart, type LucideIcon } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";

interface CreateOption {
  href: string;
  label: string;
  text: string;
  icon: LucideIcon;
  hue: number;
}

const OPTIONS: CreateOption[] = [
  { href: "/shopping?new=1", label: "פריט לקניות", text: "עם כמות, מותג ותמונה", icon: ShoppingCart, hue: 155 },
  { href: "/chores?new=1", label: "משימה", text: "חד־פעמית או קבועה", icon: ListPlus, hue: 75 },
  { href: "/recipes/new", label: "מתכון", text: "מקישור, צילום או טקסט", icon: BookmarkPlus, hue: 40 },
  { href: "/receipts", label: "סריקת קבלה", text: "המוצרים נכנסים למלאי", icon: ScanLine, hue: 280 },
  { href: "/inventory?new=1", label: "מוצר למלאי", text: "מה יש במקרר ובמזווה", icon: PackagePlus, hue: 230 },
  { href: "/documents?new=1", label: "מסמך", text: "ביטוח, חוזה, אחריות", icon: FileText, hue: 200 },
];

/** The "+" everywhere: one sheet that starts any new thing in the home. */
export function QuickCreateSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="מה מוסיפים?">
      <ul className="grid grid-cols-2 gap-2.5 pb-2">
        {OPTIONS.map((o) => (
          <li key={o.href}>
            <Link
              href={o.href}
              onClick={() => onOpenChange(false)}
              className="mod-tile pressable flex h-full flex-col gap-3 p-3.5"
              style={{ "--h": o.hue } as React.CSSProperties}
            >
              <span aria-hidden className="mod-chip grid size-11 place-items-center rounded-[15px]">
                <o.icon className="size-[21px]" strokeWidth={2} />
              </span>
              <span>
                <span className="block text-[15px] leading-tight font-semibold">{o.label}</span>
                <span className="mt-0.5 block text-[12px] leading-tight text-muted">{o.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
