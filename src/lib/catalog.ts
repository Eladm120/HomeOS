import { normalizeProductName } from "@/lib/grocery";

/**
 * The household's supermarket catalog: every product that was ever on the
 * list, from the saved catalog rows plus the list history (older items that
 * predate the catalog, or were added without one). One entry per product
 * (catalog id, else name + brand), with how often and how recently it was
 * bought and whether it's on the list right now.
 */
export interface CatalogEntry {
  key: string;
  catalogId: string | null;
  name: string;
  brand: string | null;
  unit: string;
  categoryId: string | null;
  imagePath: string | null;
  timesBought: number;
  lastAt: string | null;
  /** Quantity currently waiting on the list (0 = not on the list). */
  onList: number;
  /** Running out at home (stock at or under its minimum). */
  low: boolean;
}

export interface CatalogRow {
  id: string;
  name: string;
  brand: string | null;
  default_unit: string;
  category_id: string | null;
  image_path: string | null;
  created_at: string;
}

export interface HistoryRow {
  name: string;
  brand: string | null;
  unit: string;
  quantity: number | string;
  category_id: string | null;
  image_path: string | null;
  catalog_product_id: string | null;
  status: string;
  cleared_at: string | null;
  created_at: string;
}

const nameKey = (name: string, brand: string | null) => `n:${normalizeProductName(name)}|${normalizeProductName(brand ?? "")}`;

export function buildCatalog(input: { catalog: CatalogRow[]; history: HistoryRow[]; lowNames?: string[] }): CatalogEntry[] {
  const byKey = new Map<string, CatalogEntry>();
  const catalogKeyByName = new Map<string, string>();
  const low = new Set((input.lowNames ?? []).map(normalizeProductName));

  for (const c of input.catalog) {
    const key = `c:${c.id}`;
    catalogKeyByName.set(nameKey(c.name, c.brand), key);
    byKey.set(key, {
      key,
      catalogId: c.id,
      name: c.name,
      brand: c.brand,
      unit: c.default_unit,
      categoryId: c.category_id,
      imagePath: c.image_path,
      timesBought: 0,
      lastAt: null,
      onList: 0,
      low: low.has(normalizeProductName(c.name)),
    });
  }

  // Oldest first, so the newest row's details (category, photo, unit) win.
  const history = [...input.history].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const h of history) {
    const nk = nameKey(h.name, h.brand);
    const key = (h.catalog_product_id && byKey.has(`c:${h.catalog_product_id}`) ? `c:${h.catalog_product_id}` : null) ?? catalogKeyByName.get(nk) ?? nk;
    let e = byKey.get(key);
    if (!e) {
      e = { key, catalogId: null, name: h.name, brand: h.brand, unit: h.unit, categoryId: h.category_id, imagePath: h.image_path, timesBought: 0, lastAt: null, onList: 0, low: low.has(normalizeProductName(h.name)) };
      byKey.set(key, e);
    }
    e.categoryId = h.category_id ?? e.categoryId;
    e.imagePath = h.image_path ?? e.imagePath;
    e.unit = h.unit || e.unit;
    const active = !h.cleared_at;
    if (active && h.status === "pending") e.onList += Number(h.quantity) || 1;
    if (!active || h.status === "purchased") {
      e.timesBought += 1;
      if (!e.lastAt || h.created_at > e.lastAt) e.lastAt = h.created_at;
    }
  }
  return [...byKey.values()];
}

export type CatalogSort = "popular" | "recent" | "missing";

export function sortCatalog(entries: CatalogEntry[], sort: CatalogSort): CatalogEntry[] {
  const list = sort === "missing" ? entries.filter((e) => e.low) : [...entries];
  if (sort === "recent") return list.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "") || a.name.localeCompare(b.name, "he"));
  return list.sort((a, b) => b.timesBought - a.timesBought || (b.lastAt ?? "").localeCompare(a.lastAt ?? "") || a.name.localeCompare(b.name, "he"));
}
