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

// ---------------------------------------------------------------------------
// Phase 2: household modules
// ---------------------------------------------------------------------------
export type PlannedPurchaseStatus = "idea" | "researching" | "considering" | "ready" | "purchased" | "canceled";
export type ProjectKind = "project" | "repair";
export type ProjectStatus = "idea" | "planned" | "in_progress" | "waiting" | "completed" | "canceled";
export type ProjectActivityKind = "note" | "troubleshooting" | "technician_visit" | "quote" | "status_change" | "resolution";
export type ChoreFrequency = "once" | "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | "custom";
export type ChoreStatus = "active" | "paused" | "archived";
export type RecipeSource = "manual" | "website" | "instagram" | "tiktok" | "youtube" | "facebook" | "photo" | "other";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type AttachmentEntity = "project" | "planned_purchase" | "appliance" | "plant" | "utility_bill";

export interface ServiceProvider {
  id: string;
  household_id: string;
  name: string;
  trade: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

export interface HomeProject {
  id: string;
  household_id: string;
  kind: ProjectKind;
  title: string;
  description: string | null;
  room_id: string | null;
  priority: ItemPriority;
  status: ProjectStatus;
  owner_id: string | null;
  due_on: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  currency: string;
  provider_id: string | null;
  symptoms: string | null;
  first_reported_on: string | null;
  warranty_notes: string | null;
  resolution: string | null;
  completed_at: string | null;
  cover_path: string | null;
  notes: string | null;
  appliance_id?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectTask {
  id: string;
  household_id: string;
  project_id: string;
  title: string;
  done: boolean;
  done_at: string | null;
  assignee_id: string | null;
  due_on: string | null;
  sort_order: number;
}

export interface ProjectActivity {
  id: string;
  household_id: string;
  project_id: string;
  kind: ProjectActivityKind;
  body: string;
  occurred_on: string;
  amount: number | null;
  provider_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PlannedPurchase {
  id: string;
  household_id: string;
  name: string;
  room_id: string | null;
  project_id: string | null;
  store: string | null;
  url: string | null;
  price: number | null;
  currency: string;
  quantity: number;
  priority: ItemPriority;
  status: PlannedPurchaseStatus;
  dimensions: string | null;
  color: string | null;
  material: string | null;
  image_path: string | null;
  notes: string | null;
  purchased_at: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseAlternative {
  id: string;
  household_id: string;
  purchase_id: string;
  name: string;
  store: string | null;
  url: string | null;
  price: number | null;
  currency: string;
  dimensions: string | null;
  color: string | null;
  material: string | null;
  image_path: string | null;
  notes: string | null;
}

export interface Attachment {
  id: string;
  household_id: string;
  entity_type: AttachmentEntity;
  entity_id: string;
  path: string;
  file_name: string | null;
  mime_type: string;
  size_bytes: number | null;
  caption: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Chore {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  room_id: string | null;
  assignee_id: string | null;
  frequency: ChoreFrequency;
  interval_days: number | null;
  next_due_on: string;
  last_completed_at: string | null;
  priority: ItemPriority;
  status: ChoreStatus;
  remind: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ChoreCompletion {
  id: string;
  household_id: string;
  chore_id: string;
  due_on: string;
  completed_by: string | null;
  completed_at: string;
  note: string | null;
}

export interface Recipe {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  image_path: string | null;
  image_url: string | null;
  source_url: string | null;
  source_platform: RecipeSource;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  category: string | null;
  tags: string[];
  notes: string | null;
  is_favorite: boolean;
  rating: number | null;
  last_cooked_on: string | null;
  times_cooked: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: string;
  household_id: string;
  recipe_id: string;
  position: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  optional: boolean;
  inventory_item_id: string | null;
}

export interface RecipeStep {
  id: string;
  household_id: string;
  recipe_id: string;
  position: number;
  body: string;
}

export interface MealPlanEntry {
  id: string;
  household_id: string;
  plan_date: string;
  slot: MealSlot;
  recipe_id: string | null;
  title: string | null;
  servings: number | null;
  notes: string | null;
  sort_order: number;
  created_by: string | null;
}

// ---------------------------------------------------------------------------
// Phase 4: administration
// ---------------------------------------------------------------------------
export type DocumentCategory = "rental" | "insurance" | "warranty" | "invoice" | "utility_bill" | "maintenance" | "contract" | "receipt" | "medical" | "vehicle" | "tax" | "other";
export type BillCategory = "electricity" | "water" | "arnona" | "gas" | "internet" | "building" | "insurance" | "other";
export type EventCategory = "technician" | "delivery" | "guests" | "task" | "payment" | "maintenance" | "family" | "other";

export interface HouseholdDocument {
  id: string;
  household_id: string;
  title: string;
  category: DocumentCategory;
  tags: string[];
  file_path: string;
  file_name: string | null;
  mime_type: string;
  size_bytes: number | null;
  version: number;
  previous_version_id: string | null;
  issued_on: string | null;
  expires_on: string | null;
  remind_on: string | null;
  sensitive: boolean;
  extracted_text: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appliance {
  id: string;
  household_id: string;
  name: string;
  kind: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  room_id: string | null;
  purchased_on: string | null;
  store: string | null;
  purchase_price: number | null;
  currency: string;
  warranty_until: string | null;
  warranty_provider: string | null;
  invoice_document_id: string | null;
  manual_document_id: string | null;
  image_path: string | null;
  notes: string | null;
  created_at: string;
}

export interface ApplianceMaintenance {
  id: string;
  household_id: string;
  appliance_id: string;
  kind: "maintenance" | "repair" | "inspection" | "cleaning";
  performed_on: string;
  description: string;
  cost: number | null;
  provider_id: string | null;
  created_by: string | null;
}

export interface UtilityBill {
  id: string;
  household_id: string;
  category: BillCategory;
  provider_name: string | null;
  account_ref: string | null;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  currency: string;
  issue_date: string | null;
  due_on: string | null;
  paid_on: string | null;
  payment_status: "unpaid" | "paid" | "autopay";
  consumption: number | null;
  consumption_unit: string | null;
  fixed_charges: number | null;
  document_id: string | null;
  source: "manual" | "upload" | "email" | "api";
  import_status: "needs_review" | "confirmed";
  verified: boolean;
  extraction: Record<string, unknown> | null;
  last_synced_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface RecurringCharge {
  id: string;
  household_id: string;
  title: string;
  category: string;
  amount: number;
  currency: string;
  frequency: "weekly" | "monthly" | "bimonthly" | "quarterly" | "yearly";
  next_due_on: string | null;
  provider: string | null;
  active: boolean;
  notes: string | null;
}

export interface HouseholdExpense {
  id: string;
  household_id: string;
  title: string;
  category: string;
  amount: number;
  currency: string;
  spent_on: string;
  recurring_charge_id: string | null;
  notes: string | null;
  created_by: string | null;
}

export interface HouseholdEvent {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  assignee_id: string | null;
  remind_minutes: number | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  external_source: string | null;
  external_id: string | null;
  created_by: string | null;
}

export interface Plant {
  id: string;
  household_id: string;
  name: string;
  species: string | null;
  room_id: string | null;
  location_note: string | null;
  image_path: string | null;
  watering_interval_days: number;
  last_watered_on: string | null;
  light: "low" | "medium" | "bright" | "direct" | null;
  notes: string | null;
  identified_by_ai: boolean;
  ai_confidence: number | null;
}

export interface PlantCareEvent {
  id: string;
  household_id: string;
  plant_id: string;
  kind: "water" | "fertilize" | "repot" | "prune" | "note";
  performed_on: string;
  note: string | null;
  created_by: string | null;
}
