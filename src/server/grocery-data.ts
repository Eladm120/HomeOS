import "server-only";

import { getSupabaseServer } from "@/lib/supabase/server";
import type { ProductCategory, ShoppingListItem } from "@/lib/types";
import type { HouseholdContext } from "@/server/context";
import { signPaths } from "@/server/media";
import { smartSuggestions } from "@/lib/grocery";

/** Everything the grocery list and shopping mode need, loaded in parallel. */
export async function loadGroceryData(ctx: HouseholdContext) {
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const since = new Date(Date.now() - 90 * 86400_000).toISOString();
  const [items, categories, inventory, history] = await Promise.all([
    supabase
      .from("shopping_list_items")
      .select("*")
      .eq("household_id", hid)
      .is("deleted_at", null)
      .is("cleared_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("product_categories").select("*").eq("household_id", hid).order("sort_order"),
    supabase.from("inventory_items").select("id, name, unit, quantity, min_threshold, category_id").eq("household_id", hid).is("archived_at", null).order("name"),
    // Past trips (cleared after "finish trip") feed the "bought often" suggestions.
    supabase
      .from("shopping_list_items")
      .select("name, unit, inventory_item_id, category_id")
      .eq("household_id", hid)
      .is("deleted_at", null)
      .not("cleared_at", "is", null)
      .gte("cleared_at", since)
      .limit(500),
  ]);

  const list = (items.data ?? []) as ShoppingListItem[];
  const stock = (inventory.data ?? []).map((i) => ({ ...i, quantity: Number(i.quantity), min_threshold: i.min_threshold == null ? null : Number(i.min_threshold) })) as {
    id: string;
    name: string;
    unit: string;
    quantity: number;
    min_threshold: number | null;
    category_id: string | null;
  }[];
  const signedUrls = await signPaths(supabase, list.map((i) => i.image_path));
  const memberNames = Object.fromEntries(ctx.members.map((m) => [m.user_id, m.profile?.display_name ?? ""]));

  return {
    householdId: hid,
    initialItems: list,
    categories: (categories.data ?? []) as ProductCategory[],
    inventory: stock.map(({ id, name, unit }) => ({ id, name, unit })),
    suggestions: smartSuggestions({ active: list, inventory: stock, history: (history.data ?? []) as Pick<ShoppingListItem, "name" | "unit" | "inventory_item_id" | "category_id">[] }),
    signedUrls,
    memberNames,
    currentUserId: ctx.user.id,
    renderedAt: Date.now(),
  };
}
