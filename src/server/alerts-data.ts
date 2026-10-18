import "server-only";

import { getSupabaseServer } from "@/lib/supabase/server";
import { addDays, todayInZone } from "@/lib/format";
import { BILL_CATEGORY } from "@/lib/labels";
import { buildAlerts, COMPUTED_SUGGESTION_KINDS, type AlertItem } from "@/lib/alerts";
import type { HouseholdContext } from "@/server/context";

/**
 * The unified attention feed, read as the signed-in member (RLS applies).
 * Each source is independent: a module whose table is missing only drops out.
 */
export async function loadAlerts(ctx: HouseholdContext): Promise<AlertItem[]> {
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const now = new Date();
  const tz = ctx.household.timezone;
  const today = todayInZone(now, tz);
  const nameOf = (id: string | null) => (id ? (ctx.members.find((m) => m.user_id === id)?.profile?.display_name ?? null) : null);

  // Refresh the SQL-generated suggestions (warranty, unusual bills…) before reading them.
  await supabase.rpc("generate_suggestions", { p_household: hid });

  const [inventory, onList, chores, bills, charges, plants, suggestions] = await Promise.all([
    supabase.from("inventory_items").select("id, name, unit, quantity, min_threshold, expires_on").eq("household_id", hid).is("archived_at", null),
    supabase.from("shopping_list_items").select("inventory_item_id").eq("household_id", hid).eq("status", "pending").is("deleted_at", null).is("cleared_at", null).not("inventory_item_id", "is", null),
    supabase.from("chores").select("id, title, next_due_on, assignee_id").eq("household_id", hid).eq("status", "active").lte("next_due_on", today).order("next_due_on"),
    supabase.from("utility_bills").select("id, category, provider_name, amount, due_on").eq("household_id", hid).eq("payment_status", "unpaid").order("due_on"),
    supabase.from("recurring_charges").select("id, title, amount, next_due_on").eq("household_id", hid).eq("active", true).lte("next_due_on", addDays(today, 5)),
    supabase.from("plants").select("id, name, watering_interval_days, last_watered_on").eq("household_id", hid),
    supabase
      .from("ai_suggestions")
      .select("id, kind, title, body, href, priority")
      .eq("household_id", hid)
      .eq("status", "active")
      .not("kind", "in", `(${COMPUTED_SUGGESTION_KINDS.join(",")})`)
      .limit(10),
  ]);

  return buildAlerts({
    today,
    now,
    timeZone: tz,
    inventory: inventory.data ?? [],
    onListInventoryIds: new Set((onList.data ?? []).map((r) => r.inventory_item_id as string)),
    chores: (chores.data ?? []).map((c) => ({ id: c.id, title: c.title, next_due_on: c.next_due_on, assignee_name: nameOf(c.assignee_id) })),
    bills: (bills.data ?? []).map((b) => ({
      id: b.id,
      label: b.provider_name ?? BILL_CATEGORY[b.category as string]?.label ?? "חשבון",
      amount: b.amount,
      due_on: b.due_on,
    })),
    charges: charges.data ?? [],
    plants: plants.data ?? [],
    suggestions: suggestions.data ?? [],
  });
}
