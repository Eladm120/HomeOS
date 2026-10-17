"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, PlannedPurchase, PurchaseAlternative } from "@/lib/types";
import { flattenZodError } from "@/lib/validation";
import { plannedPurchaseSchema, purchaseAlternativeSchema, type PlannedPurchaseInput, type PurchaseAlternativeInput } from "@/lib/schemas";
import { assertOwnPath, dbFail, fail, ok, withHousehold } from "@/server/action-utils";

function refresh(id?: string) {
  revalidatePath("/planner");
  if (id) revalidatePath(`/planner/${id}`);
}

export async function savePlannedPurchase(id: string | null, input: PlannedPurchaseInput): Promise<ActionResult<PlannedPurchase>> {
  if (id && !z.uuid().safeParse(id).success) return fail("מזהה לא תקין");
  const parsed = plannedPurchaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  const v = parsed.data;

  return withHousehold(async (ctx, supabase) => {
    if (!assertOwnPath(ctx.household.id, v.image_path)) return fail("קובץ לא מורשה");
    const row = { ...v, household_id: ctx.household.id };
    const q = id
      ? supabase.from("planned_purchases").update(v).eq("id", id).eq("household_id", ctx.household.id)
      : supabase.from("planned_purchases").insert(row);
    const { data, error } = await q.select("*").single();
    if (error) return dbFail("planner.save", error);
    refresh(data.id);
    return ok(data as PlannedPurchase);
  });
}

export async function setPlannedPurchaseStatus(id: string, status: PlannedPurchase["status"]): Promise<ActionResult<PlannedPurchase>> {
  const parsed = z.object({ id: z.uuid(), status: plannedPurchaseSchema.shape.status }).safeParse({ id, status });
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  return withHousehold(async (ctx, supabase) => {
    const { data, error } = await supabase
      .from("planned_purchases")
      .update({ status: parsed.data.status })
      .eq("id", id)
      .eq("household_id", ctx.household.id)
      .select("*")
      .single();
    if (error) return dbFail("planner.status", error);
    refresh(id);
    return ok(data as PlannedPurchase);
  });
}

export async function deletePlannedPurchase(id: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("planned_purchases").delete().eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("planner.delete", error);
    refresh();
    return ok(null);
  });
}

export async function saveAlternative(
  purchaseId: string,
  id: string | null,
  input: PurchaseAlternativeInput,
): Promise<ActionResult<PurchaseAlternative>> {
  if (!z.uuid().safeParse(purchaseId).success || (id && !z.uuid().safeParse(id).success)) return fail("מזהה לא תקין");
  const parsed = purchaseAlternativeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  const v = parsed.data;
  return withHousehold(async (ctx, supabase) => {
    if (!assertOwnPath(ctx.household.id, v.image_path)) return fail("קובץ לא מורשה");
    const q = id
      ? supabase.from("purchase_alternatives").update(v).eq("id", id).eq("household_id", ctx.household.id)
      : supabase.from("purchase_alternatives").insert({ ...v, purchase_id: purchaseId, household_id: ctx.household.id });
    const { data, error } = await q.select("*").single();
    if (error) return dbFail("planner.alt.save", error);
    refresh(purchaseId);
    return ok(data as PurchaseAlternative);
  });
}

export async function deleteAlternative(purchaseId: string, id: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("purchase_alternatives").delete().eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("planner.alt.delete", error);
    refresh(purchaseId);
    return ok(null);
  });
}

/**
 * "Go with this one": the alternative becomes the main option and the previous
 * main option is kept as an alternative, so nothing is lost.
 */
export async function chooseAlternative(purchaseId: string, alternativeId: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(purchaseId).success || !z.uuid().safeParse(alternativeId).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const hid = ctx.household.id;
    const [{ data: main }, { data: alt }] = await Promise.all([
      supabase.from("planned_purchases").select("*").eq("id", purchaseId).eq("household_id", hid).maybeSingle(),
      supabase.from("purchase_alternatives").select("*").eq("id", alternativeId).eq("purchase_id", purchaseId).eq("household_id", hid).maybeSingle(),
    ]);
    if (!main || !alt) return fail("לא נמצא");
    const fields = ["name", "store", "url", "price", "currency", "dimensions", "color", "material", "image_path"] as const;
    const pick = (o: Record<string, unknown>) => Object.fromEntries(fields.map((f) => [f, o[f] ?? null]));

    const { error: e1 } = await supabase
      .from("purchase_alternatives")
      .update({ ...pick(main), notes: main.notes ? String(main.notes).slice(0, 2000) : null })
      .eq("id", alternativeId)
      .eq("household_id", hid);
    if (e1) return dbFail("planner.choose.swap", e1);
    const { error: e2 } = await supabase
      .from("planned_purchases")
      .update({ ...pick(alt), currency: alt.currency ?? "ILS" })
      .eq("id", purchaseId)
      .eq("household_id", hid);
    if (e2) return dbFail("planner.choose.main", e2);
    refresh(purchaseId);
    return ok(null);
  });
}
