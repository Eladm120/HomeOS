import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireHousehold } from "@/server/context";
import { aiConfigured } from "@/server/ai/client";

export const metadata = { title: "מתכון חדש" };

export default async function NewRecipePage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("recipes").select("category").eq("household_id", ctx.household.id).not("category", "is", null);
  const categories = [...new Set((data ?? []).map((r) => r.category as string))];
  return <RecipeEditor
      aiEnabled={aiConfigured()} householdId={ctx.household.id} recipe={null} categories={categories} />;
}
