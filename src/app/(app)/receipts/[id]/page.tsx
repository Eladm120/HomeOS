import { notFound } from "next/navigation";
import { ReceiptReview, type ReceiptLineView, type ReceiptView } from "@/components/receipts/receipt-review";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireHousehold } from "@/server/context";

export const metadata = { title: "בדיקת קבלה" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const { data: receipt } = await supabase.from("receipt_imports").select("*").eq("id", id).eq("household_id", hid).maybeSingle();
  if (!receipt) notFound();
  const [{ data: lines }, { data: inventory }, { data: shopping }] = await Promise.all([
    supabase.from("receipt_import_lines").select("*").eq("import_id", id).eq("household_id", hid).order("position"),
    supabase.from("inventory_items").select("id, name, unit").eq("household_id", hid).is("archived_at", null).order("name"),
    supabase.from("shopping_list_items").select("id, name").eq("household_id", hid).is("deleted_at", null),
  ]);
  return (
    <ReceiptReview
      receipt={receipt as ReceiptView}
      lines={(lines ?? []) as ReceiptLineView[]}
      inventory={inventory ?? []}
      shoppingNames={Object.fromEntries((shopping ?? []).map((s) => [s.id, s.name]))}
    />
  );
}
