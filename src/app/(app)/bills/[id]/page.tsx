import { notFound } from "next/navigation";
import { BillDetail } from "@/components/bills/bill-detail";
import { getSupabaseServer } from "@/lib/supabase/server";
import { compareBill, explainComparison } from "@/lib/bills";
import { BILL_CATEGORY } from "@/lib/labels";
import type { UtilityBill } from "@/lib/types";
import { requireHousehold } from "@/server/context";

const num = (b: UtilityBill) => ({ ...b, amount: Number(b.amount), consumption: b.consumption != null ? Number(b.consumption) : null, fixed_charges: b.fixed_charges != null ? Number(b.fixed_charges) : null });

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("utility_bills").select("*").eq("id", id).eq("household_id", ctx.household.id).maybeSingle();
  if (!data) notFound();
  const bill = data as UtilityBill;
  const { data: peers } = await supabase.from("utility_bills").select("*").eq("household_id", ctx.household.id).eq("category", bill.category).order("period_end", { ascending: false, nullsFirst: false }).limit(24);
  const history = (peers ?? []) as UtilityBill[];
  const c = compareBill(num(bill), history.map(num));
  return <BillDetail bill={bill} comparison={c ? explainComparison(c, BILL_CATEGORY[bill.category]?.label ?? "") : null} history={history} />;
}
