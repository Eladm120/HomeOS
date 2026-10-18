import "server-only";

import { stockLevel } from "@/lib/inventory-logic";
import type { getSupabaseServer } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof getSupabaseServer>>;

interface StockSnapshot {
  id: string;
  quantity: number | string;
  min_threshold: number | string | null;
}

/**
 * Put an inventory item on the shopping list. Returns whether a new row was
 * created (false when a pending linked row already exists).
 */
export async function listInventoryItem(supabase: Supabase, householdId: string, inventoryItemId: string): Promise<{ created: boolean } | { error: unknown }> {
  const { data: inv } = await supabase
    .from("inventory_items")
    .select("id, name, brand, unit, category_id, image_path, catalog_product_id, restock_quantity")
    .eq("id", inventoryItemId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!inv) return { error: new Error("item not found") };

  const { data: existing } = await supabase
    .from("shopping_list_items")
    .select("id")
    .eq("household_id", householdId)
    .eq("inventory_item_id", inv.id)
    .eq("status", "pending")
    .is("deleted_at", null)
    .is("cleared_at", null)
    .limit(1)
    .maybeSingle();
  if (existing) return { created: false };

  const { data: list } = await supabase.from("shopping_lists").select("id").eq("household_id", householdId).order("is_default", { ascending: false }).order("created_at").limit(1).maybeSingle();
  if (!list) return { error: new Error("no shopping list") };

  const { error } = await supabase.from("shopping_list_items").insert({
    household_id: householdId,
    list_id: list.id,
    name: inv.name,
    brand: inv.brand,
    unit: inv.unit,
    quantity: inv.restock_quantity ?? 1,
    category_id: inv.category_id,
    image_path: inv.image_path,
    catalog_product_id: inv.catalog_product_id,
    inventory_item_id: inv.id,
  });
  return error ? { error } : { created: true };
}

/**
 * The household's minimum is the rule: when an item drops to (or below) its
 * minimum, it goes straight onto the shopping list. Items without a minimum
 * are left alone. Returns true when a new list row was created.
 */
export async function autoRestock(supabase: Supabase, householdId: string, item: StockSnapshot): Promise<boolean> {
  if (item.min_threshold == null) return false;
  const level = stockLevel({ quantity: Number(item.quantity), min_threshold: Number(item.min_threshold) });
  if (level !== "low" && level !== "out") return false;
  const res = await listInventoryItem(supabase, householdId, item.id);
  return "created" in res && res.created;
}
