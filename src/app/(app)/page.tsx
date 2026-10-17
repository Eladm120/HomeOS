import { Dashboard } from "@/components/dashboard/dashboard";
import { requireHousehold } from "@/server/context";
import { getSupabaseServer } from "@/lib/supabase/server";
import { signPaths } from "@/server/media";
import { buildDailyBrief } from "@/lib/daily-brief";
import { expiryState, stockLevel } from "@/lib/inventory-logic";
import {
  formatHebrewCalendarDate,
  formatLongDate,
  greetingFor,
  joinHebrewNames,
  todayInZone,
} from "@/lib/format";
import type { ActivityEvent, InventoryItem, ShoppingListItem } from "@/lib/types";

export const metadata = { title: "בית" };

export default async function HomePage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const now = new Date();
  const tz = ctx.household.timezone;

  const [groceryRes, inventoryRes, activityRes] = await Promise.all([
    supabase
      .from("shopping_list_items")
      .select("*")
      .eq("household_id", hid)
      .eq("status", "pending")
      .is("deleted_at", null)
      .is("cleared_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("inventory_items").select("*").eq("household_id", hid).is("archived_at", null),
    supabase.from("activity_events").select("*").eq("household_id", hid).order("created_at", { ascending: false }).limit(8),
  ]);

  const grocery = (groceryRes.data ?? []) as ShoppingListItem[];
  const inventory = (inventoryRes.data ?? []) as InventoryItem[];
  const activity = (activityRes.data ?? []) as ActivityEvent[];

  const onList = new Set(grocery.map((g) => g.inventory_item_id).filter(Boolean));
  const needs = inventory
    .filter((i) => stockLevel(i) === "out" || stockLevel(i) === "low")
    .sort((a, b) => Number(a.quantity) - Number(b.quantity));
  const expiring = inventory
    .map((i) => ({ item: i, exp: expiryState(i.expires_on, now) }))
    .filter((x): x is { item: InventoryItem; exp: NonNullable<typeof x.exp> } => !!x.exp && x.exp.state !== "ok")
    .sort((a, b) => a.exp.days - b.exp.days);

  const brief = buildDailyBrief({
    pendingGrocery: grocery.length,
    urgentGrocery: grocery.filter((g) => g.priority === "high").length,
    outOfStock: needs.filter((i) => stockLevel(i) === "out").map((i) => i.name),
    lowStock: needs.filter((i) => stockLevel(i) === "low").map((i) => i.name),
    expired: expiring.filter((x) => x.exp.state === "expired").map((x) => x.item.name),
    expiringSoon: expiring.filter((x) => x.exp.state === "soon").map((x) => ({ name: x.item.name, days: x.exp.days })),
  });

  const recentGrocery = grocery.slice(0, 5);
  const signedUrls = await signPaths(supabase, [
    ...recentGrocery.map((g) => g.image_path),
    ...needs.slice(0, 5).map((i) => i.image_path),
  ]);

  const names = ctx.members.map((m) => m.profile?.display_name ?? "").filter(Boolean);
  const memberNames = Object.fromEntries(ctx.members.map((m) => [m.user_id, m.profile?.display_name ?? ""]));

  return (
    <Dashboard
      greeting={`${greetingFor(now, tz)}${names.length ? `, ${joinHebrewNames(names)}` : ""}`}
      dateLine={`${formatLongDate(now, tz)} · ${formatHebrewCalendarDate(now, tz)}`}
      today={todayInZone(now, tz)}
      brief={brief}
      groceryCount={grocery.length}
      groceryPreview={grocery.slice(0, 6).map((g) => g.name)}
      recentGrocery={recentGrocery}
      needs={needs.slice(0, 6).map((i) => ({ ...i, onList: onList.has(i.id) }))}
      needsTotal={needs.length}
      expiring={expiring.slice(0, 5).map((x) => ({ id: x.item.id, name: x.item.name, days: x.exp.days }))}
      inventoryCount={inventory.length}
      activity={activity}
      memberNames={memberNames}
      currentUserId={ctx.user.id}
      isAlone={ctx.members.length < 2}
      isOwner={ctx.role === "owner"}
      signedUrls={signedUrls}
      householdId={hid}
    />
  );
}
