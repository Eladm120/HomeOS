import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkIngredients, type IngredientCheck, type StockItem } from "@/lib/ingredients";
import type { RecipeIngredient } from "@/lib/types";

export async function loadStock(supabase: SupabaseClient, householdId: string): Promise<StockItem[]> {
  const { data } = await supabase
    .from("inventory_items")
    .select("id, name, quantity, unit, stock_confidence, expires_on")
    .eq("household_id", householdId)
    .is("archived_at", null);
  return (data ?? []).map((i) => ({ ...i, quantity: Number(i.quantity) })) as StockItem[];
}

export async function loadMappings(supabase: SupabaseClient, householdId: string): Promise<Record<string, string>> {
  const { data } = await supabase.from("ingredient_product_mappings").select("ingredient_key, inventory_item_id").eq("household_id", householdId);
  return Object.fromEntries((data ?? []).map((m) => [m.ingredient_key as string, m.inventory_item_id as string]));
}

export function checkRecipe(
  ingredients: RecipeIngredient[],
  stock: StockItem[],
  mappings: Record<string, string>,
  servingsFactor = 1,
): IngredientCheck[] {
  return checkIngredients(
    ingredients.map((i) => ({ name: i.name, quantity: i.quantity != null ? Number(i.quantity) : null, unit: i.unit, optional: i.optional, inventory_item_id: i.inventory_item_id })),
    stock,
    { servingsFactor, mappings },
  );
}

/** Missing (non-optional) ingredient count per recipe: 0 = can cook now. */
export function readiness(checks: IngredientCheck[]): { missing: number; unclear: number; total: number } {
  const required = checks.filter((c) => !c.ingredient.optional);
  return {
    missing: required.filter((c) => c.status === "missing" || c.status === "insufficient").length,
    unclear: required.filter((c) => c.status === "unclear").length,
    total: required.length,
  };
}
