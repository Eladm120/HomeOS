import { HubView } from "@/components/household/hub-view";
import { requireHousehold } from "@/server/context";
import { getSupabaseServer } from "@/lib/supabase/server";
import { addDays, greetingFor, todayInZone } from "@/lib/format";
import { periodFromGreeting } from "@/components/dashboard/house-scene";
import { stockLevel } from "@/lib/inventory-logic";
import { loadAlerts } from "@/server/alerts-data";

export const metadata = { title: "משק הבית" };

async function count(q: PromiseLike<{ count: number | null }>): Promise<number> {
  const { count: n } = await q;
  return n ?? 0;
}

export default async function HouseholdHubPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const head = { count: "exact" as const, head: true };
  const today = todayInZone(new Date(), ctx.household.timezone);

  const [inventory, choresToday, choresTotal, meals, appliances, plants, bills, documents, devices, alerts, projects, purchases, grocery, mealsToday] = await Promise.all([
    supabase.from("inventory_items").select("quantity, min_threshold").eq("household_id", hid).is("archived_at", null),
    count(supabase.from("chores").select("id", head).eq("household_id", hid).eq("status", "active").lte("next_due_on", today)),
    count(supabase.from("chores").select("id", head).eq("household_id", hid).eq("status", "active")),
    count(supabase.from("meal_plan_entries").select("id", head).eq("household_id", hid).gte("plan_date", today).lte("plan_date", addDays(today, 6))),
    count(supabase.from("appliances").select("id", head).eq("household_id", hid)),
    count(supabase.from("plants").select("id", head).eq("household_id", hid)),
    count(supabase.from("utility_bills").select("id", head).eq("household_id", hid).eq("payment_status", "unpaid")),
    count(supabase.from("documents").select("id", head).eq("household_id", hid)),
    count(supabase.from("smart_home_devices").select("id", head).eq("household_id", hid).eq("pinned", true)),
    loadAlerts(ctx),
    count(supabase.from("projects").select("id", head).eq("household_id", hid).in("status", ["planned", "in_progress", "waiting"])),
    count(supabase.from("planned_purchases").select("id", head).eq("household_id", hid).in("status", ["idea", "researching", "considering", "ready"])),
    count(supabase.from("shopping_list_items").select("id", head).eq("household_id", hid).eq("status", "pending").is("deleted_at", null).is("cleared_at", null)),
    count(supabase.from("meal_plan_entries").select("id", head).eq("household_id", hid).eq("plan_date", today)),
  ]);
  const items = inventory.data ?? [];
  const low = items.filter((i) => {
    const l = stockLevel({ quantity: Number(i.quantity), min_threshold: i.min_threshold == null ? null : Number(i.min_threshold) });
    return l === "low" || l === "out";
  }).length;

  const me = ctx.members.find((m) => m.user_id === ctx.user.id)?.profile?.display_name ?? ctx.profile?.display_name ?? "";
  const cover = ctx.household.settings?.cover_path;
  return (
    <HubView
      counts={{ inventory: items.length, low, choresToday, choresTotal, meals, appliances, plants, bills, documents, devices, projects, purchases, grocery, mealsToday }}
      alerts={alerts.filter((a) => !a.handled).length}
      householdId={hid}
      householdName={ctx.household.name}
      userName={me}
      coverPath={typeof cover === "string" ? cover : null}
      period={periodFromGreeting(greetingFor(new Date(), ctx.household.timezone))}
    />
  );
}
