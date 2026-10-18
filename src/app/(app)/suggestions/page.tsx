import { SuggestionsView, type SuggestionView } from "@/components/intelligence/suggestions-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireHousehold } from "@/server/context";

export const metadata = { title: "הצעות" };

export default async function SuggestionsPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  await supabase.rpc("generate_suggestions", { p_household: ctx.household.id });
  const { data } = await supabase
    .from("ai_suggestions")
    .select("id, kind, title, body, priority, href, action, confidence, created_at")
    .eq("household_id", ctx.household.id)
    .eq("status", "active")
    .order("priority")
    .order("created_at", { ascending: false })
    .limit(100);
  return <SuggestionsView suggestions={(data ?? []) as SuggestionView[]} />;
}
