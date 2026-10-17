import { InventoryView } from "@/components/inventory/inventory-view";
import { requireHousehold } from "@/server/context";
import { getSupabaseServer } from "@/lib/supabase/server";
import { signPaths } from "@/server/media";
import type { InventoryItem, InventoryLocation, ProductCategory } from "@/lib/types";

export const metadata = { title: "מלאי הבית" };

export default async function InventoryPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const [items, locations, categories] = await Promise.all([
    supabase.from("inventory_items").select("*").eq("household_id", hid).is("archived_at", null).order("name"),
    supabase.from("inventory_locations").select("*").eq("household_id", hid).order("sort_order"),
    supabase.from("product_categories").select("*").eq("household_id", hid).order("sort_order"),
  ]);
  const list = (items.data ?? []) as InventoryItem[];
  const signedUrls = await signPaths(supabase, list.map((i) => i.image_path));

  return (
    <InventoryView
      householdId={hid}
      items={list}
      locations={(locations.data ?? []) as InventoryLocation[]}
      categories={(categories.data ?? []) as ProductCategory[]}
      signedUrls={signedUrls}
    />
  );
}
