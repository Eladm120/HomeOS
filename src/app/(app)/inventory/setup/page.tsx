import { PageHeader } from "@/components/layout/page-header";
import { BulkSetup } from "@/components/inventory/bulk-setup";
import { requireHousehold } from "@/server/context";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { InventoryLocation, ProductCategory } from "@/lib/types";

export const metadata = { title: "הזנת מלאי" };

export default async function InventorySetupPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const [locations, categories, count] = await Promise.all([
    supabase.from("inventory_locations").select("*").eq("household_id", hid).order("sort_order"),
    supabase.from("product_categories").select("*").eq("household_id", hid).order("sort_order"),
    supabase.from("inventory_items").select("id", { count: "exact", head: true }).eq("household_id", hid).is("archived_at", null),
  ]);

  return (
    <>
      <PageHeader title="הזנת מלאי מרוכזת" subtitle="מוסיפים את מה שיש בבית — בקצב שלכם" back={{ href: "/inventory", label: "מלאי" }} />
      <BulkSetup
        householdId={hid}
        locations={(locations.data ?? []) as InventoryLocation[]}
        categories={(categories.data ?? []) as ProductCategory[]}
        existingCount={count.count ?? 0}
      />
    </>
  );
}
