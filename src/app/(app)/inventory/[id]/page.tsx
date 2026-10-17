import { notFound } from "next/navigation";
import { InventoryDetail } from "@/components/inventory/inventory-detail";
import { requireHousehold } from "@/server/context";
import { getSupabaseServer } from "@/lib/supabase/server";
import { signPaths } from "@/server/media";
import type { InventoryItem, InventoryLocation, InventoryMovement, ProductCategory } from "@/lib/types";

export const metadata = { title: "פרטי מוצר" };

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;

  const [{ data: item }, movements, locations, categories, pendingOnList] = await Promise.all([
    supabase.from("inventory_items").select("*").eq("id", id).eq("household_id", hid).maybeSingle(),
    supabase.from("inventory_movements").select("*").eq("item_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("inventory_locations").select("*").eq("household_id", hid).order("sort_order"),
    supabase.from("product_categories").select("*").eq("household_id", hid).order("sort_order"),
    supabase
      .from("shopping_list_items")
      .select("id", { count: "exact", head: true })
      .eq("inventory_item_id", id)
      .eq("status", "pending")
      .is("deleted_at", null)
      .is("cleared_at", null),
  ]);
  if (!item) notFound();

  const signedUrls = await signPaths(supabase, [item.image_path as string | null]);
  const memberNames = Object.fromEntries(ctx.members.map((m) => [m.user_id, m.profile?.display_name ?? ""]));

  return (
    <InventoryDetail
      householdId={hid}
      item={item as InventoryItem}
      movements={(movements.data ?? []) as InventoryMovement[]}
      locations={(locations.data ?? []) as InventoryLocation[]}
      categories={(categories.data ?? []) as ProductCategory[]}
      signedUrls={signedUrls}
      memberNames={memberNames}
      onShoppingList={(pendingOnList.count ?? 0) > 0}
    />
  );
}
