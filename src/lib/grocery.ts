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

/** Lowercase, no niqqud, one kind of quote mark, single spaces — so "חלב" finds "חָלָב" and "חלב  סויה". */
export function normalizeProductName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[֑-ׇ]/g, "")
    .replace(/[׳'`´]/g, "'")
    .replace(/[״"]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Autocomplete for product names: every candidate that contains what was typed,
 * best first — exact name, then names that start with it, then a word that
 * starts with it, then anywhere. "חלב" → חלב, חלב סויה, חלב שקדים, שוקו חלב.
 */
export function suggestProducts<T extends { name: string }>(query: string, candidates: T[], limit = 6): T[] {
  const q = normalizeProductName(query);
  if (!q) return [];
  const seen = new Set<string>();
  const scored: { item: T; score: number; len: number; name: string }[] = [];
  for (const item of candidates) {
    const name = normalizeProductName(item.name);
    if (!name || seen.has(name)) continue;
    const at = name.indexOf(q);
    if (at < 0) continue;
    seen.add(name);
    const score = name === q ? 0 : at === 0 ? 1 : name.split(" ").some((w) => w.startsWith(q)) ? 2 : 3;
    scored.push({ item, score, len: name.length, name });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.len - b.len || a.name.localeCompare(b.name, "he"))
    .slice(0, limit)
    .map((s) => s.item);
}

export interface SmartSuggestion {
  key: string;
  name: string;
  unit: string;
  inventory_item_id: string | null;
  category_id: string | null;
  reason: "low" | "frequent";
}

/**
 * One-tap additions above the list: what is probably running out (stock at or
 * under its minimum) first, then what the home buys often (≥2 past trips).
 * Anything already on the active list is skipped, by link or by name.
 */
export function smartSuggestions(input: {
  active: Pick<ShoppingListItem, "name" | "inventory_item_id">[];
  inventory: { id: string; name: string; unit: string; quantity: number; min_threshold: number | null; category_id?: string | null }[];
  history: Pick<ShoppingListItem, "name" | "unit" | "inventory_item_id" | "category_id">[];
  limit?: number;
}): SmartSuggestion[] {
  const onList = new Set(input.active.map((i) => normalizeProductName(i.name)));
  const linked = new Set(input.active.map((i) => i.inventory_item_id).filter(Boolean));
  const out: SmartSuggestion[] = [];
  const taken = new Set<string>();
  const push = (s: SmartSuggestion) => {
    const n = normalizeProductName(s.name);
    if (!n || onList.has(n) || taken.has(n) || (s.inventory_item_id && linked.has(s.inventory_item_id))) return;
    taken.add(n);
    out.push(s);
  };

  for (const i of input.inventory) {
    const q = Number(i.quantity);
    const low = q <= 0 || (i.min_threshold != null && q <= Number(i.min_threshold));
    if (low) push({ key: `low:${i.id}`, name: i.name, unit: i.unit, inventory_item_id: i.id, category_id: i.category_id ?? null, reason: "low" });
  }

  const counts = new Map<string, { n: number; item: (typeof input.history)[number] }>();
  for (const h of input.history) {
    const n = normalizeProductName(h.name);
    if (!n) continue;
    const cur = counts.get(n);
    counts.set(n, { n: (cur?.n ?? 0) + 1, item: cur?.item ?? h });
  }
  [...counts.values()]
    .filter((c) => c.n >= 2)
    .sort((a, b) => b.n - a.n)
    .forEach((c) => push({ key: `freq:${normalizeProductName(c.item.name)}`, name: c.item.name, unit: c.item.unit, inventory_item_id: c.item.inventory_item_id, category_id: c.item.category_id, reason: "frequent" }));

  return out.slice(0, input.limit ?? 8);
}
