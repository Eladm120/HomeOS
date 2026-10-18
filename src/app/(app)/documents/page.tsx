import { DocumentsView } from "@/components/documents/documents-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { HouseholdDocument } from "@/lib/types";
import { aiConfigured } from "@/server/ai/client";
import { requireHousehold } from "@/server/context";

export const metadata = { title: "מסמכים" };

export default async function DocumentsPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("documents").select("*").eq("household_id", ctx.household.id).order("updated_at", { ascending: false }).limit(500);
  return <DocumentsView householdId={ctx.household.id} documents={(data ?? []) as HouseholdDocument[]} aiEnabled={aiConfigured()} />;
}
