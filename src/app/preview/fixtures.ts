// Development-only sample data for the design preview (/preview/*). Never used in production.
import type { ActivityEvent, InventoryItem, InventoryLocation, ProductCategory, ShoppingListItem } from "@/lib/types";

export const HID = "00000000-0000-4000-8000-000000000001";
export const ME = "00000000-0000-4000-8000-0000000000a1";
export const PARTNER = "00000000-0000-4000-8000-0000000000b2";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

export const categories: ProductCategory[] = [
  ["פירות וירקות", 1], ["מוצרי חלב", 2], ["בשר ודגים", 3], ["מאפים ולחם", 4], ["קפואים", 5], ["מזווה", 6], ["משקאות", 7], ["ניקיון", 8],
].map(([name, i]) => ({ id: `00000000-0000-4000-8000-0000000000c${i}`, household_id: HID, name: name as string, icon: null, sort_order: i as number }));
const cat = (i: number) => categories[i - 1].id;

let n = 0;
function item(p: Partial<ShoppingListItem> & { name: string }): ShoppingListItem {
  n++;
  return {
    id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`,
    household_id: HID, list_id: "l", catalog_product_id: null, inventory_item_id: null, category_id: null,
    quantity: 1, unit: "יח׳", brand: null, variant: null, notes: null, priority: "normal", status: "pending",
    image_path: null, added_by: ME, purchased_by: null, purchased_at: null, cleared_at: null, deleted_at: null,
    version: 1, created_at: ago(200 - n * 10), updated_at: ago(5), ...p,
  };
}

export const groceries: ShoppingListItem[] = [
  item({ name: "עגבניות שרי", quantity: 2, unit: "מגש", category_id: cat(1) }),
  item({ name: "אבוקדו", quantity: 3, category_id: cat(1), added_by: PARTNER }),
  item({ name: "בננות", category_id: cat(1), status: "purchased", purchased_at: ago(3) }),
  item({ name: "חלב", quantity: 2, unit: "ליטר", brand: "תנובה", variant: "3%", category_id: cat(2), priority: "high", added_by: PARTNER }),
  item({ name: "יוגורט יווני", quantity: 4, category_id: cat(2), brand: "דנונה" }),
  item({ name: "גבינה צהובה", unit: "חבילה", category_id: cat(2), notes: "פרוסה דקה", status: "purchased", purchased_at: ago(6) }),
  item({ name: "חזה עוף", quantity: 1, unit: "ק״ג", category_id: cat(3), added_by: PARTNER }),
  item({ name: "לחם מחמצת", category_id: cat(4) }),
  item({ name: "פסטה פנה", quantity: 2, unit: "חבילה", category_id: cat(6), brand: "ברילה" }),
  item({ name: "אבקת כביסה", category_id: cat(8), priority: "high", added_by: PARTNER }),
  item({ name: "נייר טואלט", unit: "חבילה", category_id: cat(8) }),
];

export const locations: InventoryLocation[] = ["מקרר", "מקפיא", "מזווה", "ארונות מטבח", "ארון ניקיון"].map((name, i) => ({
  id: `00000000-0000-4000-8000-0000000000d${i + 1}`, household_id: HID, name, icon: null, sort_order: i + 1,
}));
const loc = (i: number) => locations[i - 1].id;

let m = 0;
function inv(p: Partial<InventoryItem> & { name: string }): InventoryItem {
  m++;
  return {
    id: `00000000-0000-4000-8000-0000000002${String(m).padStart(2, "0")}`,
    household_id: HID, catalog_product_id: null, brand: null, barcode: null, category_id: null, location_id: null,
    unit: "יח׳", quantity: 1, min_threshold: null, restock_quantity: null, expires_on: null, image_path: null, notes: null,
    stock_confidence: "confirmed", last_verified_at: ago(60 * 24 * 2), last_purchased_at: ago(60 * 24 * 5), last_movement_at: ago(60),
    created_at: ago(60 * 24 * 30), updated_at: ago(60), archived_at: null, ...p,
  };
}

export const inventory: InventoryItem[] = [
  inv({ name: "חלב 3%", unit: "ליטר", quantity: 0.5, min_threshold: 1, location_id: loc(1), category_id: cat(2) }),
  inv({ name: "ביצים", quantity: 4, min_threshold: 6, location_id: loc(1), category_id: cat(2) }),
  inv({ name: "יוגורט", quantity: 2, location_id: loc(1), expires_on: inDays(1), category_id: cat(2) }),
  inv({ name: "שמנת מתוקה", quantity: 1, location_id: loc(1), expires_on: inDays(-1) }),
  inv({ name: "אפונה קפואה", unit: "שקית", quantity: 2, location_id: loc(2) }),
  inv({ name: "אורז בסמטי", unit: "ק״ג", quantity: 2, min_threshold: 1, location_id: loc(3) }),
  inv({ name: "שמן זית", unit: "בקבוק", quantity: 1, min_threshold: 1, location_id: loc(3), stock_confidence: "estimated" }),
  inv({ name: "קפה", unit: "חבילה", quantity: 3, location_id: loc(4), last_verified_at: ago(60 * 24 * 40) }),
  inv({ name: "טבליות למדיח", quantity: 0, min_threshold: 10, location_id: loc(5) }),
  inv({ name: "נוזל כלים", unit: "בקבוק", quantity: 2, location_id: loc(5) }),
];

export const activity: ActivityEvent[] = [
  { id: 1, household_id: HID, actor_id: PARTNER, entity_type: "shopping_item", entity_id: null, action: "created", summary: { name: "אבקת כביסה" }, created_at: ago(4) },
  { id: 2, household_id: HID, actor_id: ME, entity_type: "shopping_item", entity_id: null, action: "status_changed", summary: { name: "בננות", to: "purchased" }, created_at: ago(18) },
  { id: 3, household_id: HID, actor_id: PARTNER, entity_type: "inventory_item", entity_id: null, action: "created", summary: { name: "קפה" }, created_at: ago(140) },
  { id: 4, household_id: HID, actor_id: PARTNER, entity_type: "membership", entity_id: null, action: "joined", summary: {}, created_at: ago(60 * 26) },
];

export const memberNames = { [ME]: "אלעד", [PARTNER]: "נעה" };
