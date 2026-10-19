import "server-only";

import { getSupabaseServer } from "@/lib/supabase/server";
import { addDays, daysUntil, formatHebrewCalendarDate, formatLongDate, greetingFor, todayInZone, zonedToIso } from "@/lib/format";
import { frequencyText, MEAL_SLOT } from "@/lib/labels";
import { categoryStyle, productEmoji } from "@/lib/category-style";
import { householdStage, LAYOUT_PREF_KEY, normalizeLayout, type WidgetId } from "@/lib/dashboard";
import type { Chore, ProductCategory, Recipe, RecipeIngredient, ShoppingListItem } from "@/lib/types";
import type { DashboardMeal, DashboardProps, DashboardTask, DashDevice, DashProject, DashPurchase, ReadyRecipe, SetupStep } from "@/components/dashboard/types";
import type { HouseholdContext } from "@/server/context";
import { signPaths } from "@/server/media";
import { loadAlerts } from "@/server/alerts-data";
import { checkRecipe, loadMappings, loadStock, readiness } from "@/server/recipes-data";

type Supabase = Awaited<ReturnType<typeof getSupabaseServer>>;
const head = { count: "exact" as const, head: true };

/**
 * Everything the home screen shows, read as the signed-in member (RLS applies).
 * Sources load in parallel and independently: one failing source only marks
 * its widget as unavailable instead of breaking the page.
 */
export async function loadDashboardData(ctx: HouseholdContext): Promise<DashboardProps> {
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const now = new Date();
  const tz = ctx.household.timezone;
  const today = todayInZone(now, tz);
  const failed = new Set<WidgetId>();

  const [groceryRes, categoriesRes, inventoryRes, choresRes, doneTodayRes, mealsRes, roomsRes, alerts, unread, layoutRes, smart, work, recipesBlock, counts] = await Promise.all([
    supabase
      .from("shopping_list_items")
      .select("id, name, status, priority, quantity, unit, category_id, image_path, created_at")
      .eq("household_id", hid)
      .in("status", ["pending", "purchased"])
      .is("deleted_at", null)
      .is("cleared_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("product_categories").select("*").eq("household_id", hid).order("sort_order"),
    supabase.from("inventory_items").select("id, name, unit").eq("household_id", hid).is("archived_at", null).order("name"),
    supabase
      .from("chores")
      .select("id, title, next_due_on, assignee_id, frequency, interval_days, room_id")
      .eq("household_id", hid)
      .eq("status", "active")
      .lte("next_due_on", addDays(today, 1))
      .order("next_due_on")
      .limit(12),
    supabase.from("chore_completions").select("id", head).eq("household_id", hid).gte("completed_at", zonedToIso(`${today}T00:00`, tz)),
    supabase.from("meal_plan_entries").select("id, slot, title, recipe_id, recipes(title, image_path, image_url)").eq("household_id", hid).eq("plan_date", today).order("slot"),
    supabase.from("rooms").select("id, name").eq("household_id", hid),
    loadAlerts(ctx).catch(() => {
      failed.add("attention");
      return [];
    }),
    supabase.from("notifications").select("id", head).eq("user_id", ctx.user.id).is("read_at", null),
    supabase.from("household_preferences").select("value").eq("household_id", hid).eq("user_id", ctx.user.id).eq("key", LAYOUT_PREF_KEY).maybeSingle(),
    loadSmartHome(supabase, hid),
    loadWork(supabase, hid),
    loadReadyRecipes(supabase, hid),
    loadCounts(supabase, hid),
  ]);

  if (groceryRes.error) failed.add("grocery");
  if (choresRes.error) failed.add("tasks");
  if (mealsRes.error || recipesBlock.error) failed.add("meals");
  if (smart.error) failed.add("smarthome");
  if (work.error) failed.add("projects");

  const categories = (categoriesRes.data ?? []) as ProductCategory[];
  const catById = new Map(categories.map((c) => [c.id, c]));
  const roomName = new Map((roomsRes.data ?? []).map((r) => [r.id as string, r.name as string]));
  const nameOf = (id: string | null) => (id ? (ctx.members.find((m) => m.user_id === id)?.profile?.display_name ?? null) : null);

  // Shopping: urgent first, then in the order they were added.
  type GroceryRow = Pick<ShoppingListItem, "id" | "name" | "status" | "priority" | "quantity" | "unit" | "category_id" | "image_path" | "created_at">;
  const grocery = (groceryRes.data ?? []) as GroceryRow[];
  const pending = grocery.filter((g) => g.status === "pending").sort((a, b) => (a.priority === "high" ? 0 : 1) - (b.priority === "high" ? 0 : 1));

  const tasks: DashboardTask[] = ((choresRes.data ?? []) as Pick<Chore, "id" | "title" | "next_due_on" | "assignee_id" | "frequency" | "interval_days" | "room_id">[]).map((c) => ({
    id: c.id,
    title: c.title,
    days: daysUntil(c.next_due_on, now, tz),
    assigneeId: c.assignee_id,
    assigneeName: nameOf(c.assignee_id),
    detail: [nameOf(c.assignee_id) ?? "משותף", c.room_id ? roomName.get(c.room_id) : null, frequencyText(c.frequency, c.interval_days)].filter(Boolean).join(" · "),
  }));

  type MealRow = { id: string; slot: keyof typeof MEAL_SLOT; title: string | null; recipe_id: string | null; recipes: { title: string; image_path: string | null; image_url: string | null } | null };
  const meals: DashboardMeal[] = ((mealsRes.data ?? []) as unknown as MealRow[]).map((m) => ({
    id: m.id,
    title: m.recipes?.title ?? m.title ?? "",
    slot: MEAL_SLOT[m.slot],
    href: m.recipe_id ? `/recipes/${m.recipe_id}` : "/meals",
    image_path: m.recipes?.image_path ?? null,
    image_url: m.recipes?.image_url ?? null,
  }));

  const items = pending.slice(0, 5).map((g) => {
    const cat = g.category_id ? (catById.get(g.category_id) ?? null) : null;
    return { id: g.id, name: g.name, quantity: Number(g.quantity), unit: g.unit, emoji: cat ? productEmoji(g.name, cat) : categoryStyle(null).emoji, image_path: g.image_path, urgent: g.priority === "high" };
  });

  const signedUrls = await signPaths(supabase, [
    ...meals.map((m) => m.image_path),
    ...items.map((i) => i.image_path),
    ...recipesBlock.ready.map((r) => r.image_path),
  ]);

  const me = ctx.members.find((m) => m.user_id === ctx.user.id)?.profile?.display_name ?? ctx.profile?.display_name ?? "";
  const stage = householdStage({ inventory: counts.inventory, chores: counts.chores, recipes: counts.recipes, groceryEver: counts.groceryEver });

  return {
    householdId: hid,
    householdName: ctx.household.name,
    greeting: greetingFor(now, tz),
    userName: me,
    dateLine: `${formatLongDate(now, tz)} · ${formatHebrewCalendarDate(now, tz)}`,
    members: ctx.members.map((m) => ({ id: m.user_id, name: m.profile?.display_name ?? "" })),
    currentUserId: ctx.user.id,
    isOwner: ctx.role === "owner",
    stage,
    layout: normalizeLayout(layoutRes.data?.value),
    unreadNotifications: unread.count ?? 0,
    alerts,
    grocery: { count: pending.length, urgent: pending.filter((g) => g.priority === "high").length, inCart: grocery.length - pending.length, items },
    categories,
    inventory: (inventoryRes.data ?? []) as { id: string; name: string; unit: string }[],
    tasks,
    tasksDoneToday: doneTodayRes.count ?? 0,
    meals,
    readyRecipes: recipesBlock.ready,
    hasStock: recipesBlock.hasStock,
    smartHome: { connected: smart.connected, devices: smart.devices },
    projects: work.projects,
    purchases: work.purchases,
    setup: setupSteps(ctx, counts),
    signedUrls,
    failed: [...failed],
  };
}

async function loadCounts(supabase: Supabase, hid: string) {
  const [inventory, chores, recipes, groceryEver, notifyPrefs] = await Promise.all([
    supabase.from("inventory_items").select("id", head).eq("household_id", hid),
    supabase.from("chores").select("id", head).eq("household_id", hid),
    supabase.from("recipes").select("id", head).eq("household_id", hid),
    supabase.from("shopping_list_items").select("id", head).eq("household_id", hid),
    supabase.from("household_preferences").select("id", head).eq("household_id", hid).like("key", "notify.%"),
  ]);
  return {
    inventory: inventory.count ?? 0,
    chores: chores.count ?? 0,
    recipes: recipes.count ?? 0,
    groceryEver: groceryEver.count ?? 0,
    notifyPrefs: notifyPrefs.count ?? 0,
  };
}

/** First-week steps; the card hides once they are done or dismissed. */
function setupSteps(ctx: HouseholdContext, c: Awaited<ReturnType<typeof loadCounts>>): SetupStep[] {
  return [
    { key: "inventory", label: "להזין את המלאי בבית", href: "/inventory/setup", done: c.inventory > 0 },
    { key: "grocery", label: "להוסיף מוצר ראשון לרשימת הקניות", href: "/shopping", done: c.groceryEver > 0 },
    { key: "chores", label: "להוסיף משימות קבועות", href: "/chores?new=1", done: c.chores > 0 },
    { key: "recipes", label: "לשמור מתכון ראשון", href: "/recipes/new", done: c.recipes > 0 },
    { key: "partner", label: "להזמין את בן/בת הזוג", href: "/household/settings", done: ctx.members.length > 1 },
    { key: "prefs", label: "לבחור על מה לקבל התראות", href: "/settings/notifications", done: c.notifyPrefs > 0 },
  ];
}

async function loadSmartHome(supabase: Supabase, hid: string): Promise<{ connected: boolean; devices: DashDevice[]; error: boolean }> {
  const [conn, devices, rooms] = await Promise.all([
    supabase.from("integration_connections").select("status").eq("household_id", hid).eq("provider", "home_assistant").maybeSingle(),
    supabase.from("smart_home_devices").select("id, name, kind, online, state, attributes, capabilities, pinned, room_id").eq("household_id", hid).order("name"),
    supabase.from("rooms").select("id, name").eq("household_id", hid),
  ]);
  const connected = !!conn.data && conn.data.status !== "disconnected";
  if (!connected) return { connected: false, devices: [], error: !!conn.error };
  const roomName = new Map((rooms.data ?? []).map((r) => [r.id as string, r.name as string]));
  type Row = DashDevice & { pinned: boolean; room_id: string | null };
  const all = ((devices.data ?? []) as Row[]).filter((d) => d.kind !== "binary_sensor");
  const pinned = all.filter((d) => d.pinned);
  return {
    connected,
    devices: (pinned.length ? pinned : all).slice(0, 6).map(({ pinned: _p, room_id, ...d }) => ({ ...d, room: room_id ? (roomName.get(room_id) ?? null) : null })),
    error: !!devices.error,
  };
}

async function loadWork(supabase: Supabase, hid: string): Promise<{ projects: DashProject[]; purchases: DashPurchase[]; error: boolean }> {
  const [projects, purchases] = await Promise.all([
    supabase
      .from("home_projects")
      .select("id, title, kind, status")
      .eq("household_id", hid)
      .in("status", ["planned", "in_progress", "waiting"])
      .order("updated_at", { ascending: false })
      .limit(3),
    supabase
      .from("planned_purchases")
      .select("id, name, status")
      .eq("household_id", hid)
      .in("status", ["researching", "considering", "ready"])
      .order("updated_at", { ascending: false })
      .limit(3),
  ]);
  type P = { id: string; title: string; kind: "project" | "repair"; status: DashProject["status"] };
  const list = (projects.data ?? []) as P[];
  const { data: tasks, error: tasksError } = list.length
    ? await supabase.from("project_tasks").select("project_id, done").eq("household_id", hid).in("project_id", list.map((p) => p.id))
    : { data: [], error: null };
  const of = (id: string) => (tasks ?? []).filter((t) => t.project_id === id);
  return {
    projects: list.map((p) => ({ ...p, done: of(p.id).filter((t) => t.done).length, total: of(p.id).length })),
    purchases: (purchases.data ?? []) as DashPurchase[],
    error: !!projects.error || !!purchases.error || !!tasksError,
  };
}

/** Recipes that can be cooked from what is at home — only when the inventory actually has data. */
async function loadReadyRecipes(supabase: Supabase, hid: string): Promise<{ ready: ReadyRecipe[]; hasStock: boolean; error: boolean }> {
  const [recipes, ingredients, stock, mappings] = await Promise.all([
    supabase.from("recipes").select("id, title, image_path, image_url, prep_minutes, cook_minutes, is_favorite").eq("household_id", hid).order("is_favorite", { ascending: false }).order("updated_at", { ascending: false }).limit(40),
    supabase.from("recipe_ingredients").select("*").eq("household_id", hid),
    loadStock(supabase, hid),
    loadMappings(supabase, hid),
  ]);
  if (!stock.length) return { ready: [], hasStock: false, error: !!recipes.error };
  const byRecipe = new Map<string, RecipeIngredient[]>();
  for (const i of (ingredients.data ?? []) as RecipeIngredient[]) byRecipe.set(i.recipe_id, [...(byRecipe.get(i.recipe_id) ?? []), i]);
  const ready = ((recipes.data ?? []) as Pick<Recipe, "id" | "title" | "image_path" | "image_url" | "prep_minutes" | "cook_minutes">[])
    .filter((r) => {
      const x = readiness(checkRecipe(byRecipe.get(r.id) ?? [], stock, mappings));
      return x.total > 0 && x.missing === 0 && x.unclear === 0;
    })
    .slice(0, 6)
    .map((r) => ({ id: r.id, title: r.title, image_path: r.image_path, image_url: r.image_url, minutes: (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0) || null }));
  return { ready, hasStock: true, error: !!recipes.error || !!ingredients.error };
}
