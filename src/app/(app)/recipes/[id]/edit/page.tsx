import { notFound } from "next/navigation";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Recipe, RecipeIngredient, RecipeStep } from "@/lib/types";
import { requireHousehold } from "@/server/context";
import { aiConfigured } from "@/server/ai/client";

export const metadata = { title: "עריכת מתכון" };

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const { data: recipe } = await supabase.from("recipes").select("*").eq("id", id).eq("household_id", hid).maybeSingle();
  if (!recipe) notFound();
  const [{ data: ingredients }, { data: steps }, { data: cats }] = await Promise.all([
    supabase.from("recipe_ingredients").select("*").eq("recipe_id", id).eq("household_id", hid).order("position"),
    supabase.from("recipe_steps").select("*").eq("recipe_id", id).eq("household_id", hid).order("position"),
    supabase.from("recipes").select("category").eq("household_id", hid).not("category", "is", null),
  ]);
  return (
    <RecipeEditor
      aiEnabled={aiConfigured()}
      householdId={hid}
      recipe={recipe as Recipe}
      ingredients={(ingredients ?? []) as RecipeIngredient[]}
      steps={(steps ?? []) as RecipeStep[]}
      categories={[...new Set((cats ?? []).map((r) => r.category as string))]}
    />
  );
}
