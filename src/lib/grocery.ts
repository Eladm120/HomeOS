import type { ProductCategory, ShoppingListItem } from "@/lib/types";

export const UNITS = ["יח׳", "ק״ג", "גרם", "ליטר", "מ״ל", "חבילה", "בקבוק", "קופסה", "שקית", "מגש"] as const;

export const PRIORITY_RANK = { high: 0, normal: 1, low: 2 } as const;

export interface CategoryGroup {
  id: string | null;
  name: string;
  items: ShoppingListItem[];
}

function byPriorityThenAge(a: ShoppingListItem, b: ShoppingListItem) {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.created_at.localeCompare(b.created_at);
}

/** Groups items by category in the household's category order; uncategorized last. */
export function groupByCategory(items: ShoppingListItem[], categories: Pick<ProductCategory, "id" | "name" | "sort_order">[]): CategoryGroup[] {
  const order = new Map(categories.map((c) => [c.id, c]));
  const groups = new Map<string | null, ShoppingListItem[]>();
  for (const it of items) {
    const key = it.category_id && order.has(it.category_id) ? it.category_id : null;
    const arr = groups.get(key) ?? [];
    arr.push(it);
    groups.set(key, arr);
  }
  return [...groups.entries()]
    .map(([id, list]) => ({
      id,
      name: id ? order.get(id)!.name : "ללא קטגוריה",
      sort: id ? order.get(id)!.sort_order : Number.MAX_SAFE_INTEGER,
      items: list.sort(byPriorityThenAge),
    }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ id, name, items }) => ({ id, name, items }));
}

export function splitByStatus(items: ShoppingListItem[]) {
  const pending: ShoppingListItem[] = [];
  const done: ShoppingListItem[] = [];
  for (const it of items) (it.status === "pending" ? pending : done).push(it);
  done.sort((a, b) => (b.purchased_at ?? b.updated_at).localeCompare(a.purchased_at ?? a.updated_at));
  return { pending, done };
}

/** Find the most likely inventory item for a purchased grocery item (exact name match, case-insensitive). */
export function matchInventory<T extends { id: string; name: string }>(item: Pick<ShoppingListItem, "name" | "inventory_item_id">, inventory: T[]): T | null {
  if (item.inventory_item_id) {
    const linked = inventory.find((i) => i.id === item.inventory_item_id);
    if (linked) return linked;
  }
  const n = item.name.trim().toLowerCase();
  return inventory.find((i) => i.name.trim().toLowerCase() === n) ?? null;
}
