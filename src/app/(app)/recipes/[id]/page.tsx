import { notFound } from "next/navigation";
import { RecipeDetail } from "@/components/recipes/recipe-detail";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Recipe, RecipeIngredient, RecipeStep } from "@/lib/types";
import { memberName, requireHousehold } from "@/server/context";
import { signPaths } from "@/server/media";
import { loadMappings, loadStock } from "@/server/recipes-data";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const { data: recipe } = await supabase.from("recipes").select("*").eq("id", id).eq("household_id", hid).maybeSingle();
  if (!recipe) notFound();
  const [{ data: ingredients }, { data: steps }, stock, mappings] = await Promise.all([
    supabase.from("recipe_ingredients").select("*").eq("recipe_id", id).eq("household_id", hid).order("position"),
    supabase.from("recipe_steps").select("*").eq("recipe_id", id).eq("household_id", hid).order("position"),
    loadStock(supabase, hid),
    loadMappings(supabase, hid),
  ]);
  const r = recipe as Recipe;
  const signedUrls = await signPaths(supabase, [r.image_path]);
  return (
    <RecipeDetail
      recipe={r}
      ingredients={(ingredients ?? []) as RecipeIngredient[]}
      steps={(steps ?? []) as RecipeStep[]}
      stock={stock}
      mappings={mappings}
      createdBy={memberName(ctx.members, r.created_by) || null}
      signedUrls={signedUrls}
    />
  );
}
