"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, Recipe } from "@/lib/types";
import { flattenZodError } from "@/lib/validation";
import { recipeSchema, type RecipeInput } from "@/lib/schemas";
import { ingredientKey } from "@/lib/ingredients";
import { detectPlatform, draftFromCaption, parseRecipeHtml, type RecipeDraft } from "@/lib/recipe-parse";
import { assertOwnPath, dbFail, fail, ok, withHousehold } from "@/server/action-utils";
import { addItemsToDefaultList, type NewListItem } from "@/server/grocery-bulk";
import { safeFetchText } from "@/server/safe-fetch";
import { log } from "@/server/log";

const uuid = z.uuid();

function refresh(id?: string) {
  revalidatePath("/recipes");
  if (id) revalidatePath(`/recipes/${id}`);
}

/** Create or replace a recipe with its ingredients and steps. */
export async function saveRecipe(id: string | null, input: RecipeInput): Promise<ActionResult<Recipe>> {
  if (id && !uuid.safeParse(id).success) return fail("מזהה לא תקין");
  const parsed = recipeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  const { ingredients, steps, ...v } = parsed.data;

  return withHousehold(async (ctx, supabase) => {
    const hid = ctx.household.id;
    if (!assertOwnPath(hid, v.image_path)) return fail("קובץ לא מורשה");
    const q = id
      ? supabase.from("recipes").update(v).eq("id", id).eq("household_id", hid)
      : supabase.from("recipes").insert({ ...v, household_id: hid });
    const { data: recipe, error } = await q.select("*").single();
    if (error) return dbFail("recipes.save", error);

    if (id) {
      await Promise.all([
        supabase.from("recipe_ingredients").delete().eq("recipe_id", id).eq("household_id", hid),
        supabase.from("recipe_steps").delete().eq("recipe_id", id).eq("household_id", hid),
      ]);
    }
    if (ingredients.length) {
      const { error: ie } = await supabase
        .from("recipe_ingredients")
        .insert(ingredients.map((ing, i) => ({ ...ing, position: i, recipe_id: recipe.id, household_id: hid })));
      if (ie) return dbFail("recipes.ingredients", ie);
    }
    if (steps.length) {
      const { error: se } = await supabase
        .from("recipe_steps")
        .insert(steps.map((body, i) => ({ body, position: i, recipe_id: recipe.id, household_id: hid })));
      if (se) return dbFail("recipes.steps", se);
    }
    refresh(recipe.id);
    return ok(recipe as Recipe);
  });
}

export async function deleteRecipe(id: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("recipes").delete().eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("recipes.delete", error);
    refresh();
    return ok(null);
  });
}

export async function setRecipeFavorite(id: string, favorite: boolean): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("recipes").update({ is_favorite: favorite }).eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("recipes.favorite", error);
    refresh(id);
    return ok(null);
  });
}

export async function markRecipeCooked(id: string): Promise<ActionResult<Recipe>> {
  if (!uuid.safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (_ctx, supabase) => {
    const { data, error } = await supabase.rpc("mark_recipe_cooked", { p_recipe: id });
    if (error) return dbFail("recipes.cooked", error);
    refresh(id);
    return ok(data as Recipe);
  });
}

/** Remember that an ingredient name means a specific inventory product (for every recipe). */
export async function linkIngredient(ingredientName: string, inventoryItemId: string): Promise<ActionResult<null>> {
  const parsed = z.object({ name: z.string().trim().min(1).max(160), item: uuid }).safeParse({ name: ingredientName, item: inventoryItemId });
  if (!parsed.success) return fail("קלט לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase
      .from("ingredient_product_mappings")
      .upsert(
        { household_id: ctx.household.id, ingredient_key: ingredientKey(parsed.data.name), inventory_item_id: parsed.data.item },
        { onConflict: "household_id,ingredient_key" },
      );
    if (error) return dbFail("recipes.link", error);
    revalidatePath("/recipes");
    return ok(null);
  });
}

const addMissingSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        quantity: z.coerce.number().positive().max(1_000_000),
        unit: z.string().trim().max(20).default("יח׳"),
        inventory_item_id: z.uuid().nullable().optional(),
        note: z.string().trim().max(200).nullable().optional(),
      }),
    )
    .min(1)
    .max(100),
});

/** After the user confirms, put the missing ingredients on the shared list (merging duplicates). */
export async function addIngredientsToList(input: z.input<typeof addMissingSchema>): Promise<ActionResult<{ added: number; merged: number }>> {
  const parsed = addMissingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  return withHousehold(async (ctx, supabase) => {
    const items: NewListItem[] = parsed.data.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      inventory_item_id: i.inventory_item_id ?? null,
      notes: i.note ?? null,
    }));
    const res = await addItemsToDefaultList(supabase, ctx.household.id, items);
    if (!res.ok) return res;
    revalidatePath("/shopping");
    revalidatePath("/");
    return res;
  });
}

// ---- Import --------------------------------------------------------------------------
async function fetchOEmbed(endpoint: string): Promise<{ title?: string; thumbnail_url?: string; author_name?: string } | null> {
  try {
    const { text } = await safeFetchText(endpoint, "application/json");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Turn a pasted link into a recipe draft for review. Never saves by itself.
 * Websites: schema.org Recipe / Open Graph. TikTok & YouTube: public oEmbed
 * (title/caption + thumbnail). Instagram & Facebook expose no public recipe
 * data, so only the link is kept — we never try to get around a login wall.
 */
export async function importRecipeFromUrl(url: string): Promise<ActionResult<RecipeDraft>> {
  const parsed = z.string().trim().url().max(2000).safeParse(url);
  if (!parsed.success) return fail("קישור לא תקין");
  return withHousehold(async () => {
    const source = parsed.data;
    const platform = detectPlatform(source);
    try {
      if (platform === "tiktok") {
        const o = await fetchOEmbed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(source)}`);
        return ok(draftFromCaption(o?.title ?? "", source, o?.author_name ? `מתכון של ${o.author_name}` : null, o?.thumbnail_url ?? null));
      }
      if (platform === "youtube") {
        const o = await fetchOEmbed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(source)}`);
        return ok(draftFromCaption("", source, o?.title ?? null, o?.thumbnail_url ?? null));
      }
      if (platform === "instagram" || platform === "facebook") {
        return ok({
          title: platform === "instagram" ? "מתכון מאינסטגרם" : "מתכון מפייסבוק",
          description: null,
          image_url: null,
          source_url: source,
          source_platform: platform,
          prep_minutes: null,
          cook_minutes: null,
          servings: null,
          ingredients: [],
          steps: [],
          completeness: "link-only",
          notice: "הפלטפורמה לא מאפשרת לקרוא את הפוסט. שמרנו את הקישור — הדביקו את תיאור הפוסט או הוסיפו מצרכים בעצמכם.",
        });
      }
      const page = await safeFetchText(source);
      return ok(parseRecipeHtml(page.text, page.url));
    } catch (e) {
      log.warn("recipes.import_failed", { platform, message: (e as Error).message });
      return ok({
        title: "מתכון מקישור",
        description: null,
        image_url: null,
        source_url: source,
        source_platform: platform,
        prep_minutes: null,
        cook_minutes: null,
        servings: null,
        ingredients: [],
        steps: [],
        completeness: "link-only",
        notice: `לא הצלחנו לקרוא את העמוד (${(e as Error).message}). אפשר לשמור את הקישור ולהשלים ידנית.`,
      });
    }
  });
}

/** Parse pasted caption / recipe text (e.g. copied from an Instagram post). */
export async function draftFromText(text: string, sourceUrl: string | null): Promise<ActionResult<RecipeDraft>> {
  const parsed = z.string().trim().min(1).max(20000).safeParse(text);
  if (!parsed.success) return fail("אין טקסט לניתוח");
  return withHousehold(async () => ok(draftFromCaption(parsed.data, sourceUrl ?? "https://homeos.local/manual", null, null)));
}
