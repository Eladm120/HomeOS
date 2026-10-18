import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { HubView } from "@/components/household/hub-view";
import { requireHousehold } from "@/server/context";
import { getSupabaseServer } from "@/lib/supabase/server";
import { addDays, todayInZone } from "@/lib/format";
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

  const [inventory, choresToday, choresTotal, meals, appliances, plants, bills, documents, devices, alerts] = await Promise.all([
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
  ]);
  const items = inventory.data ?? [];
  const low = items.filter((i) => {
    const l = stockLevel({ quantity: Number(i.quantity), min_threshold: i.min_threshold == null ? null : Number(i.min_threshold) });
    return l === "low" || l === "out";
  }).length;

  return (
    <>
      <PageHeader
        title="משק הבית"
        subtitle={ctx.household.name}
        actions={
          <Link href="/search" className="pressable grid size-10 place-items-center rounded-full bg-surface shadow-[var(--card-shadow)]" aria-label="חיפוש">
            <Search className="size-[19px]" />
          </Link>
        }
      />
      <HubView
        counts={{ inventory: items.length, low, choresToday, choresTotal, meals, appliances, plants, bills, documents, devices }}
        alerts={alerts.filter((a) => !a.handled).length}
      />
    </>
  );
}
