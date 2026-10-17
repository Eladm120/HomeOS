"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, Chore } from "@/lib/types";
import { flattenZodError } from "@/lib/validation";
import { choreSchema, type ChoreInput } from "@/lib/schemas";
import { dbFail, fail, ok, withHousehold } from "@/server/action-utils";

const uuid = z.uuid();

function refresh(id?: string) {
  revalidatePath("/chores");
  revalidatePath("/");
  if (id) revalidatePath(`/chores/${id}`);
}

export async function saveChore(id: string | null, input: ChoreInput): Promise<ActionResult<Chore>> {
  if (id && !uuid.safeParse(id).success) return fail("מזהה לא תקין");
  const parsed = choreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  const v = { ...parsed.data, interval_days: parsed.data.frequency === "custom" ? parsed.data.interval_days : null };

  return withHousehold(async (ctx, supabase) => {
    const q = id
      ? supabase.from("chores").update(v).eq("id", id).eq("household_id", ctx.household.id)
      : supabase.from("chores").insert({ ...v, household_id: ctx.household.id });
    const { data, error } = await q.select("*").single();
    if (error) return dbFail("chores.save", error);
    refresh(data.id);
    return ok(data as Chore);
  });
}

/** Completes the current occurrence and schedules the next one (server-side, idempotent). */
export async function completeChore(id: string, note?: string): Promise<ActionResult<Chore>> {
  const parsed = z.object({ id: uuid, note: z.string().trim().max(500).optional() }).safeParse({ id, note });
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  return withHousehold(async (_ctx, supabase) => {
    const { data, error } = await supabase.rpc("complete_chore", { p_chore: id, p_note: parsed.data.note ?? null });
    if (error) return dbFail("chores.complete", error);
    refresh(id);
    return ok(data as Chore);
  });
}

export async function setChoreStatus(id: string, status: Chore["status"]): Promise<ActionResult<null>> {
  const parsed = z.object({ id: uuid, status: z.enum(["active", "paused", "archived"]) }).safeParse({ id, status });
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("chores").update({ status }).eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("chores.status", error);
    refresh(id);
    return ok(null);
  });
}

/** Push the next occurrence to another day without recording a completion. */
export async function rescheduleChore(id: string, date: string): Promise<ActionResult<null>> {
  const parsed = z.object({ id: uuid, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse({ id, date });
  if (!parsed.success) return fail("תאריך לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("chores").update({ next_due_on: date }).eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("chores.reschedule", error);
    refresh(id);
    return ok(null);
  });
}

export async function deleteChore(id: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("chores").delete().eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("chores.delete", error);
    refresh();
    return ok(null);
  });
}
