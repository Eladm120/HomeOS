import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireHousehold } from "@/server/context";
import { aiConfigured } from "@/server/ai/client";

export const metadata = { title: "מתכון חדש" };

/** Links arrive from the system share sheet as ?url= or inside ?text= (Instagram puts it in the text). */
function sharedLink(sp: Record<string, string | string[] | undefined>): string | null {
  for (const key of ["url", "text", "title"]) {
    const v = sp[key];
    const link = (Array.isArray(v) ? v[0] : v)?.match(/https:\/\/\S+/)?.[0];
    if (link) return link.slice(0, 2000);
  }
  return null;
}

export default async function NewRecipePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("recipes").select("category").eq("household_id", ctx.household.id).not("category", "is", null);
  const categories = [...new Set((data ?? []).map((r) => r.category as string))];
  return <RecipeEditor aiEnabled={aiConfigured()} householdId={ctx.household.id} recipe={null} categories={categories} sharedUrl={sharedLink(await searchParams)} />;
}
