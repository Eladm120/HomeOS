import "server-only";

import { getSupabaseServer } from "@/lib/supabase/server";
import type { ProductCategory, ShoppingListItem } from "@/lib/types";
import type { HouseholdContext } from "@/server/context";
import { signPaths } from "@/server/media";

/** Everything the grocery list and shopping mode need, loaded in parallel. */
export async function loadGroceryData(ctx: HouseholdContext) {
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const [items, categories, inventory] = await Promise.all([
    supabase
      .from("shopping_list_items")
      .select("*")
      .eq("household_id", hid)
      .is("deleted_at", null)
      .is("cleared_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("product_categories").select("*").eq("household_id", hid).order("sort_order"),
    supabase.from("inventory_items").select("id, name, unit").eq("household_id", hid).is("archived_at", null).order("name"),
  ]);

  const list = (items.data ?? []) as ShoppingListItem[];
  const signedUrls = await signPaths(supabase, list.map((i) => i.image_path));
  const memberNames = Object.fromEntries(ctx.members.map((m) => [m.user_id, m.profile?.display_name ?? ""]));

  return {
    householdId: hid,
    initialItems: list,
    categories: (categories.data ?? []) as ProductCategory[],
    inventory: (inventory.data ?? []) as { id: string; name: string; unit: string }[],
    signedUrls,
    memberNames,
    currentUserId: ctx.user.id,
    renderedAt: Date.now(),
  };
}
