"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { LAYOUT_PREF_KEY, normalizeLayout, WIDGET_IDS, type DashboardLayout } from "@/lib/dashboard";
import { dbFail, fail, ok, withHousehold } from "@/server/action-utils";

const layoutSchema = z.object({
  order: z.array(z.enum(WIDGET_IDS as [string, ...string[]])).max(20),
  hidden: z.array(z.enum(WIDGET_IDS as [string, ...string[]])).max(20),
});

/** Each member keeps their own dashboard order and hidden widgets (a personal preference row). */
export async function saveDashboardLayout(input: DashboardLayout): Promise<ActionResult<DashboardLayout>> {
  const parsed = layoutSchema.safeParse(input);
  if (!parsed.success) return fail("פריסה לא תקינה");
  const layout = normalizeLayout(parsed.data);
  return withHousehold<DashboardLayout>(async (ctx, supabase) => {
    const { data: row } = await supabase
      .from("household_preferences")
      .select("id")
      .eq("household_id", ctx.household.id)
      .eq("user_id", ctx.user.id)
      .eq("key", LAYOUT_PREF_KEY)
      .maybeSingle();
    const { error } = row
      ? await supabase.from("household_preferences").update({ value: layout }).eq("id", row.id)
      : await supabase.from("household_preferences").insert({ household_id: ctx.household.id, user_id: ctx.user.id, key: LAYOUT_PREF_KEY, value: layout });
    if (error) return dbFail("dashboard.layout", error);
    revalidatePath("/");
    return ok(layout);
  });
}
