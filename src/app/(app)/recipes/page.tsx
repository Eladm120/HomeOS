import { RecipesView, type RecipeCardData } from "@/components/recipes/recipes-view";
import { addDays, todayInZone } from "@/lib/format";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Recipe, RecipeIngredient } from "@/lib/types";
import { requireHousehold } from "@/server/context";
import { signPaths } from "@/server/media";
import { checkRecipe, loadMappings, loadStock, readiness } from "@/server/recipes-data";

export const metadata = { title: "מתכונים" };

export default async function RecipesPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const today = todayInZone(new Date(), ctx.household.timezone);
  const [{ data: recipes }, { data: ingredients }, stock, mappings, { data: planned }] = await Promise.all([
    supabase.from("recipes").select("*").eq("household_id", hid).order("is_favorite", { ascending: false }).order("updated_at", { ascending: false }),
    supabase.from("recipe_ingredients").select("*").eq("household_id", hid),
    loadStock(supabase, hid),
    loadMappings(supabase, hid),
    supabase.from("meal_plan_entries").select("plan_date").eq("household_id", hid).gte("plan_date", today).lte("plan_date", addDays(today, 6)),
  ]);
  const byRecipe = new Map<string, RecipeIngredient[]>();
  for (const i of (ingredients ?? []) as RecipeIngredient[]) byRecipe.set(i.recipe_id, [...(byRecipe.get(i.recipe_id) ?? []), i]);
  const list: RecipeCardData[] = ((recipes ?? []) as Recipe[]).map((r) => ({ ...r, readiness: readiness(checkRecipe(byRecipe.get(r.id) ?? [], stock, mappings)) }));
  const signedUrls = await signPaths(supabase, list.map((r) => r.image_path));
  return <RecipesView recipes={list} signedUrls={signedUrls} week={weekStrip(today, (planned ?? []).map((p) => p.plan_date as string))} />;
}

const DAY = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

/** The next seven days, with how many meals are planned on each. */
function weekStrip(today: string, plannedDates: string[]) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    return { date, label: DAY[new Date(`${date}T12:00:00Z`).getUTCDay()], planned: plannedDates.filter((d) => d === date).length, isToday: i === 0 };
  });
}
