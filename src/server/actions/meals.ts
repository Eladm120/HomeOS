"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, MealPlanEntry } from "@/lib/types";
import { flattenZodError } from "@/lib/validation";
import { mealEntrySchema, type MealEntryInput } from "@/lib/schemas";
import { dbFail, fail, ok, withHousehold } from "@/server/action-utils";

const uuid = z.uuid();

export async function saveMealEntry(id: string | null, input: MealEntryInput): Promise<ActionResult<MealPlanEntry>> {
  if (id && !uuid.safeParse(id).success) return fail("מזהה לא תקין");
  const parsed = mealEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  return withHousehold(async (ctx, supabase) => {
    const q = id
      ? supabase.from("meal_plan_entries").update(parsed.data).eq("id", id).eq("household_id", ctx.household.id)
      : supabase.from("meal_plan_entries").insert({ ...parsed.data, household_id: ctx.household.id });
    const { data, error } = await q.select("*").single();
    if (error) return dbFail("meals.save", error);
    revalidatePath("/meals");
    revalidatePath("/");
    return ok(data as MealPlanEntry);
  });
}

export async function deleteMealEntry(id: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("meal_plan_entries").delete().eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("meals.delete", error);
    revalidatePath("/meals");
    return ok(null);
  });
}

/** Repeat a whole week (e.g. "same as last week") into the following week. */
export async function copyMealWeek(fromMonday: string, toMonday: string): Promise<ActionResult<{ copied: number }>> {
  const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  if (!d.safeParse(fromMonday).success || !d.safeParse(toMonday).success) return fail("תאריך לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const end = new Date(`${fromMonday}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    const { data: rows, error } = await supabase
      .from("meal_plan_entries")
      .select("*")
      .eq("household_id", ctx.household.id)
      .gte("plan_date", fromMonday)
      .lte("plan_date", end.toISOString().slice(0, 10));
    if (error) return dbFail("meals.copy.read", error);
    const shift = (Date.parse(`${toMonday}T00:00:00Z`) - Date.parse(`${fromMonday}T00:00:00Z`)) / 86_400_000;
    const copies = (rows ?? []).map((r) => {
      const date = new Date(`${r.plan_date}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + shift);
      return {
        household_id: ctx.household.id,
        plan_date: date.toISOString().slice(0, 10),
        slot: r.slot,
        recipe_id: r.recipe_id,
        title: r.title,
        servings: r.servings,
        notes: r.notes,
      };
    });
    if (copies.length) {
      const { error: ie } = await supabase.from("meal_plan_entries").insert(copies);
      if (ie) return dbFail("meals.copy.write", ie);
    }
    revalidatePath("/meals");
    return ok({ copied: copies.length });
  });
}
