"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import type { BriefLine } from "@/lib/daily-brief";
import { todayInZone } from "@/lib/format";
import { aiConfigured, aiErrorMessage } from "@/server/ai/client";
import { extractStructured } from "@/server/ai/extract";
import { dbFail, fail, ok, withHousehold } from "@/server/action-utils";
import { addInventoryItemToList } from "@/server/actions/grocery";
import { completeChore } from "@/server/actions/chores";
import { waterPlant } from "@/server/actions/admin";

// ---- Daily brief ---------------------------------------------------------------

const briefOut = z.object({
  text: z.string().describe("2-3 short Hebrew sentences for the morning brief"),
});

/**
 * A warm, written version of today's facts, generated at most once per
 * household per day and cached. Facts come from the deterministic brief; the
 * model only rephrases them and must keep estimates marked as estimates.
 */
export async function getWrittenBrief(lines: BriefLine[]): Promise<ActionResult<{ text: string | null; cached: boolean }>> {
  const parsed = z.array(z.object({ kind: z.enum(["fact", "estimate"]), text: z.string().max(400) })).max(12).safeParse(lines);
  if (!parsed.success) return fail("קלט לא תקין");
  return withHousehold<{ text: string | null; cached: boolean }>(async (ctx, supabase) => {
    const today = todayInZone(new Date(), ctx.household.timezone);
    const { data: cached } = await supabase.from("daily_briefs").select("content").eq("household_id", ctx.household.id).eq("brief_date", today).maybeSingle();
    if (cached) return ok({ text: (cached.content as { text?: string }).text ?? null, cached: true });
    if (!aiConfigured() || parsed.data.length === 0) return ok({ text: null, cached: false });

    const names = ctx.members.map((m) => m.profile?.display_name).filter(Boolean).join(" ו");
    try {
      const out = await extractStructured({
        supabase,
        householdId: ctx.household.id,
        feature: "brief",
        schema: briefOut,
        effort: "low",
        system:
          "You write the morning brief of a shared household app in Hebrew. Rephrase the given facts into 2-3 short, warm, practical sentences addressed to the household. Use only the given facts, add nothing new. Lines marked estimate must stay clearly worded as estimates (כנראה, בערך). No greeting line, no emojis.",
        content: [
          {
            type: "text",
            text: `Household: ${names || "the household"}\nFacts:\n${parsed.data.map((l) => `- [${l.kind}] ${l.text}`).join("\n")}`,
          },
        ],
      });
      await supabase.from("daily_briefs").upsert({ household_id: ctx.household.id, brief_date: today, content: { text: out.text, lines: parsed.data }, model: "claude-opus-5-5" });
      return ok({ text: out.text, cached: false });
    } catch {
      return ok({ text: null, cached: false });
    }
  });
}

// ---- Suggestions ---------------------------------------------------------------

/** Refresh suggestions + notifications for the active household (cheap SQL, safe to call on page load). */
export async function refreshSuggestions(): Promise<ActionResult<{ count: number }>> {
  return withHousehold(async (ctx, supabase) => {
    const { data, error } = await supabase.rpc("generate_suggestions", { p_household: ctx.household.id });
    if (error) return dbFail("suggestions.generate", error);
    await supabase.rpc("notify_from_suggestions", { p_household: ctx.household.id });
    return ok({ count: Number(data ?? 0) });
  });
}

export async function dismissSuggestion(id: string, mode: "snooze" | "mute"): Promise<ActionResult<null>> {
  const parsed = z.object({ id: z.uuid(), mode: z.enum(["snooze", "mute"]) }).safeParse({ id, mode });
  if (!parsed.success) return fail("קלט לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const days = mode === "mute" ? 3650 : 3;
    const { data, error } = await supabase
      .from("ai_suggestions")
      .update({ status: "dismissed", dismissed_at: new Date().toISOString(), dismissed_by: ctx.user.id, snooze_until: new Date(Date.now() + days * 86_400_000).toISOString() })
      .eq("id", id)
      .eq("household_id", ctx.household.id)
      .select("kind")
      .single();
    if (error) return dbFail("suggestions.dismiss", error);
    revalidatePath("/suggestions");
    revalidatePath("/");
    return ok(null);
  });
}

/** Run a suggestion's own action (add to list, complete chore) and mark it done. */
export async function actOnSuggestion(id: string): Promise<ActionResult<{ message: string }>> {
  if (!z.uuid().safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { data: s } = await supabase.from("ai_suggestions").select("id, action, title").eq("id", id).eq("household_id", ctx.household.id).maybeSingle();
    if (!s?.action) return fail("אין פעולה להצעה הזו");
    const action = s.action as { type: string; inventory_item_id?: string; chore_id?: string; plant_id?: string };
    let message = "בוצע";
    if (action.type === "add_inventory_to_list" && action.inventory_item_id) {
      const res = await addInventoryItemToList(action.inventory_item_id);
      if (!res.ok) return res;
      message = res.data.created ? "נוסף לרשימת הקניות" : "כבר היה ברשימה";
    } else if (action.type === "complete_chore" && action.chore_id) {
      const res = await completeChore(action.chore_id);
      if (!res.ok) return res;
      message = "סומן כבוצע";
    } else if (action.type === "water_plant" && action.plant_id) {
      const res = await waterPlant(action.plant_id);
      if (!res.ok) return res;
      message = "נרשמה השקיה";
    } else return fail("פעולה לא נתמכת");
    await supabase.from("ai_suggestions").update({ status: "done", acted_at: new Date().toISOString(), snooze_until: new Date(Date.now() + 86_400_000).toISOString() }).eq("id", id);
    revalidatePath("/suggestions");
    revalidatePath("/");
    return ok({ message });
  });
}

// ---- Notifications ----------------------------------------------------------------

export async function markNotificationsRead(ids: string[] | "all"): Promise<ActionResult<null>> {
  if (ids !== "all" && !z.array(z.uuid()).max(200).safeParse(ids).success) return fail("קלט לא תקין");
  return withHousehold(async (ctx, supabase) => {
    let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", ctx.user.id).is("read_at", null);
    if (ids !== "all") q = q.in("id", ids);
    const { error } = await q;
    if (error) return dbFail("notifications.read", error);
    revalidatePath("/notifications");
    return ok(null);
  });
}

// ---- Preferences ------------------------------------------------------------------

const prefSchema = z.object({
  key: z.string().regex(/^[a-z0-9_.]{1,80}$/),
  value: z.union([z.boolean(), z.string().max(200), z.number(), z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))]),
  personal: z.boolean(),
});

export async function setPreference(input: z.input<typeof prefSchema>): Promise<ActionResult<null>> {
  const parsed = prefSchema.safeParse(input);
  if (!parsed.success) return fail("הגדרה לא תקינה");
  return withHousehold(async (ctx, supabase) => {
    const userId = parsed.data.personal ? ctx.user.id : null;
    let existing = supabase.from("household_preferences").select("id").eq("household_id", ctx.household.id).eq("key", parsed.data.key);
    existing = userId ? existing.eq("user_id", userId) : existing.is("user_id", null);
    const { data: row } = await existing.maybeSingle();
    const { error } = row
      ? await supabase.from("household_preferences").update({ value: parsed.data.value }).eq("id", row.id)
      : await supabase.from("household_preferences").insert({ household_id: ctx.household.id, user_id: userId, key: parsed.data.key, value: parsed.data.value });
    if (error) return dbFail("preferences.set", error);
    revalidatePath("/settings/notifications");
    return ok(null);
  });
}

export async function aiStatus(): Promise<{ configured: boolean }> {
  return { configured: aiConfigured() };
}

export async function friendlyAiError(e: unknown): Promise<string> {
  return aiErrorMessage(e);
}
