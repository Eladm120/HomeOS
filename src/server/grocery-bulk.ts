import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult } from "@/lib/types";
import { guessCategoryId } from "@/lib/category-style";
import { escapeLike } from "@/lib/utils";
import { dbFail, fail, ok } from "@/server/action-utils";
import { convert } from "@/lib/ingredients";

export interface NewListItem {
  name: string;
  quantity: number;
  unit: string;
  inventory_item_id?: string | null;
  notes?: string | null;
  category_id?: string | null;
}

/**
 * Add several items to the household's default list in one go (recipes, meal
 * plans, AI suggestions). A pending item with the same name — or the same linked
 * inventory product — gets its quantity bumped instead of a duplicate row,
 * converting units when they are compatible.
 */
export async function addItemsToDefaultList(
  supabase: SupabaseClient,
  householdId: string,
  items: NewListItem[],
): Promise<ActionResult<{ added: number; merged: number }>> {
  let { data: list } = await supabase.from("shopping_lists").select("id").eq("household_id", householdId).eq("is_default", true).maybeSingle();
  if (!list) {
    const created = await supabase.from("shopping_lists").insert({ household_id: householdId, name: "סופר", is_default: true }).select("id").single();
    list = created.data;
  }
  if (!list) return fail("לא נמצאה רשימת קניות");

  const [{ data: categories }, { data: inventory }] = await Promise.all([
    supabase.from("product_categories").select("id, name, icon").eq("household_id", householdId),
    supabase.from("inventory_items").select("id, category_id, image_path, catalog_product_id, brand").eq("household_id", householdId),
  ]);
  const invById = new Map((inventory ?? []).map((i) => [i.id as string, i]));

  let added = 0;
  let merged = 0;
  for (const it of items) {
    let q = supabase
      .from("shopping_list_items")
      .select("id, quantity, unit")
      .eq("list_id", list.id)
      .eq("status", "pending")
      .is("deleted_at", null)
      .is("cleared_at", null);
    q = it.inventory_item_id ? q.eq("inventory_item_id", it.inventory_item_id) : q.ilike("name", escapeLike(it.name));
    const { data: dup } = await q.limit(1).maybeSingle();

    if (dup) {
      const extra = convert(it.quantity, it.unit, dup.unit as string);
      if (extra != null) {
        const { error } = await supabase
          .from("shopping_list_items")
          .update({ quantity: Math.round((Number(dup.quantity) + extra) * 1000) / 1000 })
          .eq("id", dup.id);
        if (error) return dbFail("grocery.bulk.merge", error);
        merged++;
        continue;
      }
    }

    const inv = it.inventory_item_id ? invById.get(it.inventory_item_id) : undefined;
    const { error } = await supabase.from("shopping_list_items").insert({
      household_id: householdId,
      list_id: list.id,
      name: it.name,
      quantity: it.quantity,
      unit: it.unit || "יח׳",
      notes: it.notes ?? null,
      inventory_item_id: it.inventory_item_id ?? null,
      category_id: it.category_id ?? (inv?.category_id as string | null) ?? guessCategoryId(it.name, categories ?? []),
      image_path: (inv?.image_path as string | null) ?? null,
      catalog_product_id: (inv?.catalog_product_id as string | null) ?? null,
      brand: (inv?.brand as string | null) ?? null,
    });
    if (error) return dbFail("grocery.bulk.add", error);
    added++;
  }
  return ok({ added, merged });
}
