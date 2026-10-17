import "server-only";

import { getSupabaseServer } from "@/lib/supabase/server";
import { buildDailyBrief } from "@/lib/daily-brief";
import { expiryState, stockLevel } from "@/lib/inventory-logic";
import { formatHebrewCalendarDate, formatLongDate, greetingFor, joinHebrewNames, todayInZone } from "@/lib/format";
import type { ActivityEvent, InventoryItem, ProductCategory, ShoppingListItem } from "@/lib/types";
import type { DashboardProps } from "@/components/dashboard/dashboard";
import type { HouseholdContext } from "@/server/context";
import { signPaths } from "@/server/media";

/** Everything the home screen shows, read as the signed-in member (RLS applies). */
export async function loadDashboardData(ctx: HouseholdContext): Promise<Omit<DashboardProps, "quickActions">> {
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const now = new Date();
  const tz = ctx.household.timezone;

  const [groceryRes, inventoryRes, activityRes, categoriesRes] = await Promise.all([
    supabase
      .from("shopping_list_items")
      .select("*")
      .eq("household_id", hid)
      .eq("status", "pending")
      .is("deleted_at", null)
      .is("cleared_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("inventory_items").select("*").eq("household_id", hid).is("archived_at", null),
    supabase.from("activity_events").select("*").eq("household_id", hid).order("created_at", { ascending: false }).limit(12),
    supabase.from("product_categories").select("*").eq("household_id", hid).order("sort_order"),
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

  const shownNeeds = needs.slice(0, 8);
  const signedUrls = await signPaths(supabase, shownNeeds.map((i) => i.image_path));
  const names = ctx.members.map((m) => m.profile?.display_name ?? "").filter(Boolean);

  return {
    greeting: `${greetingFor(now, tz)}${names.length ? `, ${joinHebrewNames(names)}` : ""}`,
    dateLine: `${formatLongDate(now, tz)} · ${formatHebrewCalendarDate(now, tz)}`,
    today: todayInZone(now, tz),
    brief,
    groceryCount: grocery.length,
    urgentCount: grocery.filter((g) => g.priority === "high").length,
    pendingGrocery: grocery,
    categories: (categoriesRes.data ?? []) as ProductCategory[],
    needs: shownNeeds.map((i) => ({ ...i, onList: onList.has(i.id) })),
    needsTotal: needs.length,
    expiring: expiring.slice(0, 5).map((x) => ({ id: x.item.id, name: x.item.name, days: x.exp.days })),
    inventoryCount: inventory.length,
    activity,
    memberNames: Object.fromEntries(ctx.members.map((m) => [m.user_id, m.profile?.display_name ?? ""])),
    members: ctx.members.map((m) => ({ id: m.user_id, name: m.profile?.display_name ?? "" })),
    currentUserId: ctx.user.id,
    isAlone: ctx.members.length < 2,
    isOwner: ctx.role === "owner",
    signedUrls,
    householdId: hid,
    modules: [],
  };
}
