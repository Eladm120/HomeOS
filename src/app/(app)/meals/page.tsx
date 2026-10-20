import { MealsView, type MealSuggestion } from "@/components/recipes/meals-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import { aggregateShortfalls, nameScore } from "@/lib/ingredients";
import { expiryState } from "@/lib/inventory-logic";
import { addDays, todayInZone } from "@/lib/format";
import type { MealPlanEntry, Recipe, RecipeIngredient } from "@/lib/types";
import { requireHousehold } from "@/server/context";
import { signPaths } from "@/server/media";
import { checkRecipe, loadMappings, loadStock, readiness } from "@/server/recipes-data";

export const metadata = { title: "תכנון ארוחות" };

/** Sunday of the week containing `iso` (Israeli weeks start on Sunday). */
function weekStartOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return addDays(iso, -d.getUTCDay());
}

export default async function MealsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const today = todayInZone(new Date(), ctx.household.timezone);
  const start = weekStartOf(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today);
  const end = addDays(start, 6);

  const [{ data: entries }, { data: recipes }, { data: ingredients }, stock, mappings, { data: expiringInv }] = await Promise.all([
    supabase.from("meal_plan_entries").select("*").eq("household_id", hid).gte("plan_date", start).lte("plan_date", end).order("sort_order"),
    supabase.from("recipes").select("*").eq("household_id", hid).order("title"),
    supabase.from("recipe_ingredients").select("*").eq("household_id", hid),
    loadStock(supabase, hid),
    loadMappings(supabase, hid),
    supabase.from("inventory_items").select("id, name, expires_on").eq("household_id", hid).is("archived_at", null).not("expires_on", "is", null),
  ]);

  const recipeList = (recipes ?? []) as Recipe[];
  const byId = new Map(recipeList.map((r) => [r.id, r]));
  const ingByRecipe = new Map<string, RecipeIngredient[]>();
  for (const i of (ingredients ?? []) as RecipeIngredient[]) ingByRecipe.set(i.recipe_id, [...(ingByRecipe.get(i.recipe_id) ?? []), i]);

  // Shortfall for the rest of the week: each planned recipe scaled to its planned servings.
  const planned = ((entries ?? []) as MealPlanEntry[]).filter((e) => e.recipe_id && e.plan_date >= today && byId.has(e.recipe_id));
  const shortfalls = aggregateShortfalls(
    planned.map((e) => {
      const r = byId.get(e.recipe_id!)!;
      const factor = e.servings && r.servings ? Number(e.servings) / Number(r.servings) : 1;
      return { source: r.title, checks: checkRecipe(ingByRecipe.get(r.id) ?? [], stock, mappings, factor) };
    }),
  );

  // Suggestions: recipes that use something expiring soon first, then ones you can make now.
  const expiringNames = (expiringInv ?? [])
    .map((i) => ({ name: i.name as string, exp: expiryState(i.expires_on as string) }))
    .filter((x) => x.exp && x.exp.state === "soon")
    .map((x) => x.name);
  const plannedIds = new Set(planned.map((e) => e.recipe_id));
  const usesExpiring: MealSuggestion[] = [];
  const readyNow: MealSuggestion[] = [];
  for (const r of recipeList) {
    if (plannedIds.has(r.id)) continue;
    const ings = ingByRecipe.get(r.id) ?? [];
    const uses = expiringNames.find((n) => ings.some((i) => nameScore(i.name, n) > 0));
    const ready = readiness(checkRecipe(ings, stock, mappings));
    const img = { image_path: r.image_path, image_url: r.image_url };
    if (uses) usesExpiring.push({ ...img, recipeId: r.id, title: r.title, reason: `משתמש ב${uses} שתוקפו קרוב${ready.missing ? ` · חסרים ${ready.missing}` : ""}` });
    else if (ready.total && ready.missing === 0 && ready.unclear === 0) readyNow.push({ ...img, recipeId: r.id, title: r.title, reason: "יש בבית את כל המצרכים" });
  }

  const planEntries = (entries ?? []) as MealPlanEntry[];
  const suggestions = [...usesExpiring, ...readyNow].slice(0, 6);
  const signedUrls = await signPaths(supabase, [
    ...planEntries.map((e) => (e.recipe_id ? byId.get(e.recipe_id)?.image_path : null)),
    ...suggestions.map((sg) => sg.image_path),
  ]);

  return (
    <MealsView
      householdId={hid}
      weekStart={start}
      entries={planEntries.map((e) => {
        const r = e.recipe_id ? byId.get(e.recipe_id) : undefined;
        return {
          ...e,
          recipe_title: r?.title ?? null,
          recipe_image_path: r?.image_path ?? null,
          recipe_image_url: r?.image_url ?? null,
          recipe_minutes: r ? (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0) || null : null,
        };
      })}
      recipes={recipeList.map((r) => ({ id: r.id, title: r.title, servings: r.servings }))}
      shortfalls={shortfalls}
      suggestions={suggestions}
      signedUrls={signedUrls}
      hasStock={stock.length > 0}
    />
  );
}
