import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import type { ActionResult } from "@/lib/types";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getHouseholdContext, type HouseholdContext } from "@/server/context";
import { log } from "@/server/log";

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Translate DB errors to safe Hebrew messages; details go to the server log only. */
export function dbFail(scope: string, error: PostgrestError | Error | null): ActionResult<never> {
  log.error(scope, { message: error?.message, code: (error as PostgrestError | null)?.code });
  const code = (error as PostgrestError | null)?.code;
  if (code === "42501") return fail("אין לך הרשאה לפעולה הזו");
  if (code === "23505") return fail("פריט כזה כבר קיים");
  if (code === "22023") return fail(error?.message ?? "קלט לא תקין");
  return fail("משהו השתבש. נסו שוב בעוד רגע.");
}

/** Every mutating action starts here: authenticated user + active household. */
export async function withHousehold<T>(
  fn: (ctx: HouseholdContext, supabase: Awaited<ReturnType<typeof getSupabaseServer>>) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const ctx = await getHouseholdContext();
  if (!ctx) return fail("יש להתחבר ולבחור משק בית");
  const supabase = await getSupabaseServer();
  try {
    return await fn(ctx, supabase);
  } catch (e) {
    return dbFail("action.unhandled", e as Error);
  }
}

/** A storage path is only accepted if it lives under this household's folder. */
export function assertOwnPath(householdId: string, path: string | null): boolean {
  return path === null || path.startsWith(`${householdId}/`);
}
