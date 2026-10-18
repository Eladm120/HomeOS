import "server-only";

import { getSupabaseServer } from "@/lib/supabase/server";
import { addDays, daysUntil, formatHebrewCalendarDate, formatLongDate, greetingFor, joinHebrewNames, todayInZone } from "@/lib/format";
import { frequencyText, MEAL_SLOT } from "@/lib/labels";
import { categoryStyle, productEmoji } from "@/lib/category-style";
import type { Chore, ProductCategory, ShoppingListItem } from "@/lib/types";
import type { DashboardMeal, DashboardProps, DashboardTask } from "@/components/dashboard/dashboard";
import type { HouseholdContext } from "@/server/context";
import { signPaths } from "@/server/media";
import { loadAlerts } from "@/server/alerts-data";

/** Everything the home screen shows, read as the signed-in member (RLS applies). */
export async function loadDashboardData(ctx: HouseholdContext): Promise<DashboardProps> {
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const now = new Date();
  const tz = ctx.household.timezone;
  const today = todayInZone(now, tz);

  const [groceryRes, categoriesRes, choresRes, mealsRes, roomsRes, alerts, unread, setup] = await Promise.all([
    supabase
      .from("shopping_list_items")
      .select("id, name, status, priority, category_id, created_at")
      .eq("household_id", hid)
      .in("status", ["pending", "purchased"])
      .is("deleted_at", null)
      .is("cleared_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("product_categories").select("*").eq("household_id", hid).order("sort_order"),
    supabase
      .from("chores")
      .select("id, title, next_due_on, assignee_id, frequency, interval_days, room_id, priority")
      .eq("household_id", hid)
      .eq("status", "active")
      .lte("next_due_on", addDays(today, 1))
      .order("next_due_on")
      .limit(12),
    supabase.from("meal_plan_entries").select("id, slot, title, recipe_id, recipes(title, image_path, image_url)").eq("household_id", hid).eq("plan_date", today).order("slot"),
    supabase.from("rooms").select("id, name").eq("household_id", hid),
    loadAlerts(ctx),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id).is("read_at", null),
    loadSetupSteps(supabase, ctx),
  ]);

  const grocery = (groceryRes.data ?? []) as Pick<ShoppingListItem, "id" | "name" | "status" | "priority" | "category_id" | "created_at">[];
  const pending = grocery.filter((g) => g.status === "pending").sort((a, b) => (a.priority === "high" ? 0 : 1) - (b.priority === "high" ? 0 : 1));
  const categories = (categoriesRes.data ?? []) as ProductCategory[];
  const catById = new Map(categories.map((c) => [c.id, c]));
  const roomName = new Map((roomsRes.data ?? []).map((r) => [r.id as string, r.name as string]));
  const nameOf = (id: string | null) => (id ? (ctx.members.find((m) => m.user_id === id)?.profile?.display_name ?? null) : null);

  const tasks: DashboardTask[] = ((choresRes.data ?? []) as Pick<Chore, "id" | "title" | "next_due_on" | "assignee_id" | "frequency" | "interval_days" | "room_id">[]).map((c) => ({
    id: c.id,
    title: c.title,
    days: daysUntil(c.next_due_on, now, tz),
    assigneeId: c.assignee_id,
    assigneeName: nameOf(c.assignee_id),
    detail: [nameOf(c.assignee_id) ?? "משותף", c.room_id ? roomName.get(c.room_id) : null, frequencyText(c.frequency, c.interval_days)].filter(Boolean).join(" · "),
  }));

  type MealRow = { id: string; slot: keyof typeof MEAL_SLOT; title: string | null; recipe_id: string | null; recipes: { title: string; image_path: string | null; image_url: string | null } | null };
  const mealRows = mealsRes.error ? [] : ((mealsRes.data ?? []) as unknown as MealRow[]);
  const meals: DashboardMeal[] = mealRows.map((m) => ({
    id: m.id,
    title: m.recipes?.title ?? m.title ?? "",
    slot: MEAL_SLOT[m.slot],
    href: m.recipe_id ? `/recipes/${m.recipe_id}` : "/meals",
    image_path: m.recipes?.image_path ?? null,
    image_url: m.recipes?.image_url ?? null,
  }));
  const signedUrls = await signPaths(supabase, meals.map((m) => m.image_path));
  const names = ctx.members.map((m) => m.profile?.display_name ?? "").filter(Boolean);

  return {
    greeting: `${greetingFor(now, tz)}${names.length ? `, ${joinHebrewNames(names)}` : ""}`,
    dateLine: `${formatLongDate(now, tz)} · ${formatHebrewCalendarDate(now, tz)}`,
    householdId: hid,
    members: ctx.members.map((m) => ({ id: m.user_id, name: m.profile?.display_name ?? "" })),
    currentUserId: ctx.user.id,
    isAlone: ctx.members.length < 2,
    isOwner: ctx.role === "owner",
    alerts,
    tasks,
    grocery: {
      count: pending.length,
      urgent: pending.filter((g) => g.priority === "high").length,
      inCart: grocery.length - pending.length,
      items: pending.slice(0, 8).map((g) => {
        const cat = g.category_id ? (catById.get(g.category_id) ?? null) : null;
        return { id: g.id, name: g.name, emoji: cat ? productEmoji(g.name, cat) : categoryStyle(null).emoji };
      }),
    },
    meals,
    signedUrls,
    setup,
    unreadNotifications: unread.count ?? 0,
  };
}

type Supabase = Awaited<ReturnType<typeof getSupabaseServer>>;

/** Onboarding steps after household creation (spec: rooms, inventory, appliances, preferences, integrations). */
async function loadSetupSteps(supabase: Supabase, ctx: HouseholdContext) {
  const hid = ctx.household.id;
  const head = { count: "exact" as const, head: true };
  const [inventory, prefs, recipes, chores] = await Promise.all([
    supabase.from("inventory_items").select("id", head).eq("household_id", hid),
    supabase.from("household_preferences").select("id", head).eq("household_id", hid).eq("user_id", ctx.user.id),
    supabase.from("recipes").select("id", head).eq("household_id", hid),
    supabase.from("chores").select("id", head).eq("household_id", hid),
  ]);
  return [
    { key: "partner", label: "להזמין את בן/בת הזוג", href: "/household/settings", done: ctx.members.length > 1 },
    { key: "inventory", label: "להזין את המלאי בבית (עם מינימום לכל מוצר)", href: "/inventory/setup", done: (inventory.count ?? 0) > 0 },
    { key: "chores", label: "להוסיף משימות קבועות", href: "/chores?new=1", done: (chores.count ?? 0) > 0 },
    { key: "recipes", label: "לשמור מתכון ראשון", href: "/recipes/new", done: (recipes.count ?? 0) > 0 },
    { key: "prefs", label: "לבחור על מה לקבל התראות", href: "/settings/notifications", done: (prefs.count ?? 0) > 0 },
  ];
}
