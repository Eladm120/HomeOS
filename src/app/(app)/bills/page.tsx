import { BillsView } from "@/components/bills/bills-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import { aiConfigured } from "@/server/ai/client";
import { loadBillsOverview } from "@/server/bills-data";
import { requireHousehold } from "@/server/context";

export const metadata = { title: "חשבונות" };

export default async function BillsPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const o = await loadBillsOverview(supabase, ctx.household.id, ctx.household.timezone);
  return <BillsView householdId={ctx.household.id} {...o} aiEnabled={aiConfigured()} />;
}
