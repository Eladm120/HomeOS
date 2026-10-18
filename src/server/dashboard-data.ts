import "server-only";

import { getSupabaseServer } from "@/lib/supabase/server";
import { buildDailyBrief } from "@/lib/daily-brief";
import { expiryState, stockLevel } from "@/lib/inventory-logic";
import { addDays, daysUntil, formatHebrewCalendarDate, formatLongDate, greetingFor, joinHebrewNames, relativeDays, todayInZone } from "@/lib/format";
import { BILL_CATEGORY, EVENT_CATEGORY, MEAL_SLOT, PROJECT_STATUS } from "@/lib/labels";
import type { ActivityEvent, InventoryItem, ProductCategory, ShoppingListItem } from "@/lib/types";
import type { DashboardModuleCard, DashboardProps } from "@/components/dashboard/dashboard";
import type { HouseholdContext } from "@/server/context";
import { signPaths } from "@/server/media";
import { aiConfigured } from "@/server/ai/client";
import type { SuggestionView } from "@/components/intelligence/suggestions-view";

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

  // Refresh proactive suggestions (cheap, deduplicated SQL) before reading them.
  await supabase.rpc("generate_suggestions", { p_household: hid });
  await supabase.rpc("notify_from_suggestions", { p_household: hid });
  const [modules, { data: suggestions }, { count: unread }] = await Promise.all([
    loadModuleCards(supabase, ctx, now),
    supabase
      .from("ai_suggestions")
      .select("id, kind, title, body, priority, href, action, confidence, created_at")
      .eq("household_id", hid)
      .eq("status", "active")
      .not("kind", "in", "(low_stock,expiring)")
      .order("priority")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id).is("read_at", null),
  ]);
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
    modules,
    setup: await loadSetupSteps(supabase, ctx, inventory.length),
    suggestions: (suggestions ?? []) as SuggestionView[],
    unreadNotifications: unread ?? 0,
    aiEnabled: aiConfigured(),
  };
}

type Supabase = Awaited<ReturnType<typeof getSupabaseServer>>;

/**
 * Cards contributed by the other modules. Each query is independent and a
 * failure (e.g. a module whose migration has not run yet) only hides its card.
 */
async function loadModuleCards(supabase: Supabase, ctx: HouseholdContext, now: Date): Promise<DashboardModuleCard[]> {
  const hid = ctx.household.id;
  const tz = ctx.household.timezone;
  const today = todayInZone(now, tz);
  const soon = addDays(today, 3);
  const nameOf = (id: string | null) => (id ? ctx.members.find((m) => m.user_id === id)?.profile?.display_name : null);

  const [chores, repairs, meals] = await Promise.all([
    supabase.from("chores").select("id, title, next_due_on, assignee_id, priority").eq("household_id", hid).eq("status", "active").lte("next_due_on", soon).order("next_due_on").limit(6),
    supabase
      .from("home_projects")
      .select("id, title, kind, status, priority, due_on")
      .eq("household_id", hid)
      .not("status", "in", "(completed,canceled,idea)")
      .order("priority")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase.from("meal_plan_entries").select("id, slot, title, recipe_id, recipes(title)").eq("household_id", hid).eq("plan_date", today).order("slot"),
  ]);

  const [events, bills] = await Promise.all([
    supabase
      .from("household_events")
      .select("id, title, starts_at, all_day, category")
      .eq("household_id", hid)
      .gte("starts_at", new Date(now.getTime() - 3600_000).toISOString())
      .lte("starts_at", `${addDays(today, 3)}T23:59:59Z`)
      .order("starts_at")
      .limit(5),
    supabase.from("utility_bills").select("id, category, provider_name, amount, due_on").eq("household_id", hid).eq("payment_status", "unpaid").lte("due_on", addDays(today, 7)).order("due_on").limit(4),
  ]);

  const cards: DashboardModuleCard[] = [];
  if (!events.error && events.data?.length) {
    const fmt = new Intl.DateTimeFormat("he-IL", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: tz });
    const fmtDay = new Intl.DateTimeFormat("he-IL", { weekday: "short", day: "numeric", month: "numeric", timeZone: tz });
    cards.push({
      key: "events",
      title: "ביומן בימים הקרובים",
      href: "/calendar",
      tint: "text-foreground",
      rows: events.data.map((e) => ({ id: e.id as string, title: `${EVENT_CATEGORY[e.category as string]?.emoji ?? "📌"} ${e.title}`, detail: (e.all_day ? fmtDay : fmt).format(new Date(e.starts_at as string)), href: "/calendar" })),
    });
  }
  if (!bills.error && bills.data?.length) {
    cards.push({
      key: "bills",
      title: "חשבונות לתשלום",
      href: "/bills",
      tint: "text-foreground",
      rows: bills.data.map((b) => {
        const d = b.due_on ? daysUntil(b.due_on as string, now, tz) : null;
        return {
          id: b.id as string,
          title: `${BILL_CATEGORY[b.category as string]?.emoji ?? "🧾"} ${b.provider_name ?? BILL_CATEGORY[b.category as string]?.label ?? "חשבון"} · ₪${Number(b.amount)}`,
          href: `/bills/${b.id}`,
          badge: d == null ? undefined : { text: d < 0 ? "באיחור" : relativeDays(d), tone: d < 0 ? ("danger" as const) : d <= 2 ? ("amber" as const) : ("neutral" as const) },
        };
      }),
    });
  }
  if (!chores.error) {
    cards.push({
      key: "chores",
      title: "משימות קרובות",
      href: "/chores",
      tint: "text-foreground",
      rows: (chores.data ?? []).map((c) => {
        const d = daysUntil(c.next_due_on as string, now, tz);
        return {
          id: c.id as string,
          title: c.title as string,
          detail: nameOf(c.assignee_id as string | null) ?? "משותף",
          href: `/chores/${c.id}`,
          badge: { text: d < 0 ? "באיחור" : d === 0 ? "היום" : relativeDays(d), tone: d < 0 ? "danger" : d === 0 ? "amber" : "neutral" },
        };
      }),
    });
  }
  if (!meals.error && meals.data?.length) {
    cards.push({
      key: "meals",
      title: "מה אוכלים היום",
      href: "/meals",
      tint: "text-foreground",
      rows: meals.data.map((m) => ({
        id: m.id as string,
        title: (m.recipes as unknown as { title: string } | null)?.title ?? (m.title as string) ?? "",
        detail: MEAL_SLOT[m.slot as keyof typeof MEAL_SLOT],
        href: m.recipe_id ? `/recipes/${m.recipe_id}` : "/meals",
      })),
    });
  }
  if (!repairs.error) {
    cards.push({
      key: "repairs",
      title: "תיקונים ופרויקטים פתוחים",
      href: "/projects",
      tint: "text-foreground",
      rows: (repairs.data ?? []).map((p) => ({
        id: p.id as string,
        title: `${p.kind === "repair" ? "🔧" : "🛠️"} ${p.title}`,
        detail: PROJECT_STATUS[p.status as keyof typeof PROJECT_STATUS].label,
        href: `/projects/${p.id}`,
        badge: p.priority === "high" ? { text: "דחוף", tone: "danger" as const } : undefined,
      })),
    });
  }
  return cards;
}

/** Onboarding steps after household creation (spec: rooms, inventory, appliances, preferences, integrations). */
async function loadSetupSteps(supabase: Supabase, ctx: HouseholdContext, inventoryCount: number) {
  const hid = ctx.household.id;
  const head = { count: "exact" as const, head: true };
  const [appliances, prefs, conns, recipes] = await Promise.all([
    supabase.from("appliances").select("id", head).eq("household_id", hid),
    supabase.from("household_preferences").select("id", head).eq("household_id", hid).eq("user_id", ctx.user.id),
    supabase.from("integration_connections").select("id", head).eq("household_id", hid),
    supabase.from("recipes").select("id", head).eq("household_id", hid),
  ]);
  return [
    { key: "partner", label: "להזמין את בן/בת הזוג", href: "/household/settings", done: ctx.members.length > 1 },
    { key: "inventory", label: "להזין את המלאי בבית", href: "/inventory/setup", done: inventoryCount > 0 },
    { key: "appliances", label: "לרשום מכשירי חשמל ואחריות (לא חובה)", href: "/appliances?new=1", done: (appliances.count ?? 0) > 0 },
    { key: "recipes", label: "לשמור מתכון ראשון", href: "/recipes/new", done: (recipes.count ?? 0) > 0 },
    { key: "prefs", label: "לבחור על מה לקבל התראות", href: "/settings/notifications", done: (prefs.count ?? 0) > 0 },
    { key: "integrations", label: "לחבר שירותים (לא חובה)", href: "/settings/integrations", done: (conns.count ?? 0) > 0 },
  ];
}
