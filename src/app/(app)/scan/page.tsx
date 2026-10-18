import { BarcodeScanner } from "@/components/inventory/barcode-scanner";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { InventoryLocation } from "@/lib/types";
import { aiConfigured } from "@/server/ai/client";
import { requireHousehold } from "@/server/context";

export const metadata = { title: "סריקת מוצר" };

export default async function ScanPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("inventory_locations").select("*").eq("household_id", ctx.household.id).order("sort_order");
  return <BarcodeScanner householdId={ctx.household.id} locations={(data ?? []) as InventoryLocation[]} aiConfigured={aiConfigured()} />;
}
