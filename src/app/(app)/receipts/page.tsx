import { ReceiptList } from "@/components/receipts/receipt-list";
import { getSupabaseServer } from "@/lib/supabase/server";
import { aiConfigured } from "@/server/ai/client";
import { requireHousehold } from "@/server/context";

export const metadata = { title: "קבלות" };

export default async function ReceiptsPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const { data } = await supabase
    .from("receipt_imports")
    .select("id, store, purchased_on, total, currency, status, created_at")
    .eq("household_id", ctx.household.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return <ReceiptList householdId={ctx.household.id} configured={aiConfigured()} receipts={data ?? []} />;
}
