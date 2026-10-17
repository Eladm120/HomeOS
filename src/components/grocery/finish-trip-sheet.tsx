"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { finishShoppingTrip } from "@/server/actions/grocery";
import type { ShoppingListItem } from "@/lib/types";
import { matchInventory } from "@/lib/grocery";
import { formatQuantity } from "@/lib/format";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";

export interface InventoryOption {
  id: string;
  name: string;
  unit: string;
}

interface Row {
  item: ShoppingListItem;
  include: boolean;
  inventoryId: string | null;
  quantity: number;
}

/**
 * End of trip: review which purchased items go into the home inventory.
 * Nothing is written to inventory without this explicit confirmation.
 */
export function FinishTripSheet({
  open,
  onOpenChange,
  purchased,
  inventory,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  purchased: ShoppingListItem[];
  inventory: InventoryOption[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRows(
      purchased.map((item) => {
        const match = matchInventory(item, inventory);
        return { item, include: !!match, inventoryId: match?.id ?? null, quantity: Number(item.quantity) };
      }),
    );
  }, [open, purchased, inventory]);

  const included = useMemo(() => rows.filter((r) => r.include).length, [rows]);

  function update(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.item.id === id ? { ...r, ...patch } : r)));
  }

  async function confirm() {
    setSaving(true);
    const res = await finishShoppingTrip({
      to_inventory: rows
        .filter((r) => r.include && r.quantity > 0)
        .map((r) => ({ shopping_item_id: r.item.id, inventory_item_id: r.inventoryId, quantity: r.quantity })),
    });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(
      res.data.stocked ? `הקנייה הסתיימה · ${res.data.stocked} מוצרים עודכנו במלאי` : "הקנייה הסתיימה · הרשימה נוקתה",
    );
    onOpenChange(false);
    onDone?.();
    router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="סיום קנייה"
      description="סמנו מה להכניס למלאי הבית. המוצרים שנקנו יוסרו מהרשימה."
      footer={
        <Button size="lg" className="w-full" onClick={confirm} loading={saving}>
          <PackageCheck />
          {included ? `סיום ועדכון ${included} מוצרים במלאי` : "סיום וניקוי הרשימה"}
        </Button>
      }
    >
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.item.id} className="rounded-2xl border border-border p-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={r.include}
                onChange={(e) => update(r.item.id, { include: e.target.checked })}
                className="size-5 accent-[var(--sage)]"
              />
              <span className="min-w-0 flex-1 truncate font-medium">{r.item.name}</span>
              <span className="num text-sm text-muted">
                {formatQuantity(r.item.quantity)} {r.item.unit}
              </span>
            </label>
            {r.include && (
              <div className="mt-2 flex items-center gap-2 ps-8">
                <select
                  aria-label="מוצר במלאי"
                  value={r.inventoryId ?? ""}
                  onChange={(e) => update(r.item.id, { inventoryId: e.target.value || null })}
                  className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-surface px-2 text-sm"
                >
                  <option value="">+ מוצר חדש במלאי</option>
                  {inventory.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="כמות שנכנסת למלאי"
                  inputMode="decimal"
                  value={r.quantity}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    if (!Number.isNaN(n)) update(r.item.id, { quantity: n });
                  }}
                  className="num h-9 w-16 rounded-xl border border-border bg-surface text-center text-sm"
                />
                {!r.inventoryId && <Badge tone="sky">חדש</Badge>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
