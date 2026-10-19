import "server-only";

import { getSupabaseServer } from "@/lib/supabase/server";
import { buildCatalog, type CatalogRow, type HistoryRow } from "@/lib/catalog";
import type { ProductCategory } from "@/lib/types";
import type { HouseholdContext } from "@/server/context";
import { signPaths } from "@/server/media";

/** Everything the supermarket catalog needs: every product ever bought, categories, what's low at home. */
export async function loadCatalogData(ctx: HouseholdContext) {
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const [catalog, history, categories, inventory] = await Promise.all([
    supabase.from("product_catalog").select("id, name, brand, default_unit, category_id, image_path, created_at").eq("household_id", hid).limit(2000),
    supabase
      .from("shopping_list_items")
      .select("name, brand, unit, quantity, category_id, image_path, catalog_product_id, status, cleared_at, created_at")
      .eq("household_id", hid)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(3000),
    supabase.from("product_categories").select("*").eq("household_id", hid).order("sort_order"),
    supabase.from("inventory_items").select("name, quantity, min_threshold").eq("household_id", hid).is("archived_at", null),
  ]);

  const lowNames = (inventory.data ?? [])
    .filter((i) => Number(i.quantity) <= 0 || (i.min_threshold != null && Number(i.quantity) <= Number(i.min_threshold)))
    .map((i) => i.name as string);
  const entries = buildCatalog({ catalog: (catalog.data ?? []) as CatalogRow[], history: (history.data ?? []) as HistoryRow[], lowNames });
  const signedUrls = await signPaths(supabase, entries.map((e) => e.imagePath));

  return {
    householdName: ctx.household.name,
    entries,
    categories: (categories.data ?? []) as ProductCategory[],
    signedUrls,
  };
}
