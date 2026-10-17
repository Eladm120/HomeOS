"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import type { ActionResult } from "@/lib/types";
import { flattenZodError, householdNameSchema, inviteSchema, nameSchema } from "@/lib/validation";
import { ACTIVE_HOUSEHOLD_COOKIE, getUser } from "@/server/context";
import { dbFail, fail, ok, withHousehold } from "@/server/action-utils";
import { log } from "@/server/log";

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };

export async function createHousehold(input: { name: string; rooms: string[] }): Promise<ActionResult<{ id: string }>> {
  const user = await getUser();
  if (!user) return fail("יש להתחבר");
  const parsed = householdNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.rpc("create_household", {
    p_name: parsed.data.name,
    p_rooms: parsed.data.rooms.length ? parsed.data.rooms : null,
  });
  if (error) return dbFail("household.create", error);

  (await cookies()).set(ACTIVE_HOUSEHOLD_COOKIE, data as string, COOKIE_OPTS);
  log.info("household.created", { household_id: data });
  revalidatePath("/", "layout");
  return ok({ id: data as string });
}

export async function switchHousehold(householdId: string): Promise<void> {
  if (!z.uuid().safeParse(householdId).success) return;
  (await cookies()).set(ACTIVE_HOUSEHOLD_COOKIE, householdId, COOKIE_OPTS);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function createInvitation(input: { email?: string }): Promise<ActionResult<{ url: string; expiresAt: string }>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };

  return withHousehold(async (ctx, supabase) => {
    if (ctx.role !== "owner") return fail("רק בעלי משק הבית יכולים להזמין");
    const { data, error } = await supabase.rpc("create_household_invitation", {
      p_household: ctx.household.id,
      p_email: parsed.data.email,
    });
    if (error) return dbFail("invitation.create", error);
    const row = (data as { token: string; expires_at: string }[])[0];
    revalidatePath("/household/settings");
    return ok({ url: `${await requestOrigin()}/invite/${row.token}`, expiresAt: row.expires_at });
  });
}

export async function revokeInvitation(id: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase
      .from("household_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("household_id", ctx.household.id);
    if (error) return dbFail("invitation.revoke", error);
    revalidatePath("/household/settings");
    return ok(null);
  });
}

export async function acceptInvitation(token: string): Promise<ActionResult<{ householdId: string }>> {
  if (!/^[0-9a-f]{48}$/.test(token)) return fail("קישור ההזמנה אינו תקין");
  const user = await getUser();
  if (!user) return fail("יש להתחבר כדי להצטרף");
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.rpc("accept_household_invitation", { p_token: token });
  if (error) {
    if (error.message.includes("different email")) return fail("ההזמנה נשלחה לכתובת מייל אחרת");
    if (error.message.includes("already used")) return fail("ההזמנה כבר נוצלה");
    if (error.message.includes("invalid or expired")) return fail("ההזמנה פגה או בוטלה");
    return dbFail("invitation.accept", error);
  }
  (await cookies()).set(ACTIVE_HOUSEHOLD_COOKIE, data as string, COOKIE_OPTS);
  revalidatePath("/", "layout");
  return ok({ householdId: data as string });
}

export async function renameHousehold(input: { name: string }): Promise<ActionResult<null>> {
  const parsed = z.object({ name: z.string().trim().min(1, "יש להזין שם").max(80) }).safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  return withHousehold(async (ctx, supabase) => {
    if (ctx.role !== "owner") return fail("רק בעלי משק הבית יכולים לשנות את השם");
    const { error } = await supabase.from("households").update({ name: parsed.data.name }).eq("id", ctx.household.id);
    if (error) return dbFail("household.rename", error);
    revalidatePath("/", "layout");
    return ok(null);
  });
}

export async function updateDisplayName(input: { name: string }): Promise<ActionResult<null>> {
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  const user = await getUser();
  if (!user) return fail("יש להתחבר");
  const supabase = await getSupabaseServer();
  const { error } = await supabase.from("profiles").update({ display_name: parsed.data.name }).eq("id", user.id);
  if (error) return dbFail("profile.update", error);
  revalidatePath("/", "layout");
  return ok(null);
}

export async function removeMember(userId: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(userId).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const isSelf = userId === ctx.user.id;
    if (!isSelf && ctx.role !== "owner") return fail("אין לך הרשאה להסיר חברים");
    const owners = ctx.members.filter((m) => m.role === "owner");
    if (isSelf && ctx.role === "owner" && owners.length === 1) {
      return fail("לא ניתן לעזוב — את/ה הבעלים היחידים של משק הבית");
    }
    const { error } = await supabase
      .from("household_memberships")
      .delete()
      .eq("household_id", ctx.household.id)
      .eq("user_id", userId);
    if (error) return dbFail("membership.remove", error);
    if (isSelf) (await cookies()).delete(ACTIVE_HOUSEHOLD_COOKIE);
    revalidatePath("/", "layout");
    return ok(null);
  });
}

// --- Rooms -------------------------------------------------------------------

export async function addRoom(input: { name: string }): Promise<ActionResult<null>> {
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase
      .from("rooms")
      .insert({ household_id: ctx.household.id, name: parsed.data.name, sort_order: 100 });
    if (error) return dbFail("room.add", error);
    revalidatePath("/household/settings");
    return ok(null);
  });
}

export async function deleteRoom(id: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("rooms").delete().eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("room.delete", error);
    revalidatePath("/household/settings");
    return ok(null);
  });
}

// --- Categories & locations ---------------------------------------------------

export async function addCategory(input: { name: string }): Promise<ActionResult<{ id: string }>> {
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  return withHousehold(async (ctx, supabase) => {
    const { data, error } = await supabase
      .from("product_categories")
      .insert({ household_id: ctx.household.id, name: parsed.data.name, sort_order: 50 })
      .select("id")
      .single();
    if (error) return dbFail("category.add", error);
    revalidatePath("/", "layout");
    return ok({ id: data.id as string });
  });
}

export async function deleteCategory(id: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("product_categories").delete().eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("category.delete", error);
    revalidatePath("/", "layout");
    return ok(null);
  });
}

export async function addLocation(input: { name: string }): Promise<ActionResult<null>> {
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase
      .from("inventory_locations")
      .insert({ household_id: ctx.household.id, name: parsed.data.name, sort_order: 50 });
    if (error) return dbFail("location.add", error);
    revalidatePath("/", "layout");
    return ok(null);
  });
}

export async function deleteLocation(id: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("inventory_locations").delete().eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("location.delete", error);
    revalidatePath("/", "layout");
    return ok(null);
  });
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  (await cookies()).delete(ACTIVE_HOUSEHOLD_COOKIE);
  redirect("/sign-in");
}

/** Origin of the current request (works on localhost, previews and production). */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return publicEnv.siteUrl;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
