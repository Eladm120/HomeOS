// Domain models mirroring supabase/migrations. Keep in sync with the schema.

export type HouseholdRole = "owner" | "member";
export type ShoppingItemStatus = "pending" | "purchased" | "unavailable";
export type ItemPriority = "low" | "normal" | "high";
export type InventoryMovementKind =
  | "initial"
  | "add"
  | "purchase"
  | "consume"
  | "correct"
  | "discard"
  | "transfer";
export type StockConfidence = "confirmed" | "estimated";

export interface Profile {
  id: string;
  display_name: string;
  avatar_path: string | null;
  locale: string;
}

export interface Household {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  locale: string;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface Membership {
  id: string;
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  created_at: string;
}

export interface MemberWithProfile extends Membership {
  profile: Pick<Profile, "id" | "display_name" | "avatar_path"> | null;
}

export interface Room {
  id: string;
  household_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface ProductCategory {
  id: string;
  household_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface InventoryLocation {
  id: string;
  household_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface CatalogProduct {
  id: string;
  household_id: string;
  name: string;
  brand: string | null;
  variant: string | null;
  barcode: string | null;
  category_id: string | null;
  default_unit: string;
  image_path: string | null;
}

export interface ShoppingList {
  id: string;
  household_id: string;
  name: string;
  is_default: boolean;
}

export interface ShoppingListItem {
  id: string;
  household_id: string;
  list_id: string;
  catalog_product_id: string | null;
  inventory_item_id: string | null;
  category_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  brand: string | null;
  variant: string | null;
  notes: string | null;
  priority: ItemPriority;
  status: ShoppingItemStatus;
  image_path: string | null;
  added_by: string | null;
  purchased_by: string | null;
  purchased_at: string | null;
  cleared_at: string | null;
  deleted_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  household_id: string;
  catalog_product_id: string | null;
  name: string;
  brand: string | null;
  barcode: string | null;
  category_id: string | null;
  location_id: string | null;
  unit: string;
  quantity: number;
  min_threshold: number | null;
  restock_quantity: number | null;
  expires_on: string | null;
  image_path: string | null;
  notes: string | null;
  stock_confidence: StockConfidence;
  last_verified_at: string | null;
  last_purchased_at: string | null;
  last_movement_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface InventoryMovement {
  id: string;
  household_id: string;
  item_id: string;
  kind: InventoryMovementKind;
  quantity_delta: number;
  quantity_after: number;
  from_location_id: string | null;
  to_location_id: string | null;
  source: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ActivityEvent {
  id: number;
  household_id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  summary: Record<string, unknown>;
  created_at: string;
}

/** Result envelope returned by every server action. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
