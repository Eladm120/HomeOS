import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { addDays, daysUntil, todayInZone } from "@/lib/format";
import { checkIngredients, nameScore } from "@/lib/ingredients";
import { escapeLike, orFilterTerm } from "@/lib/utils";
import type { HouseholdContext } from "@/server/context";

/**
 * The assistant's tools. Every tool:
 * - runs with the signed-in member's Supabase client (RLS applies), and also
 *   filters by the active household id explicitly;
 * - validates its input with Zod before touching the database;
 * - returns compact JSON with only the fields the answer needs.
 * "propose_*" tools never write: they register a proposal that the member
 * confirms (or ignores) in the chat UI.
 */

export interface AssistantAction {
  id: string;
  type: "add_grocery" | "create_chore" | "smart_home";
  title: string;
  payload: Record<string, unknown>;
  status: "proposed" | "done" | "dismissed" | "failed";
}

export interface ToolContext {
  supabase: SupabaseClient;
  ctx: HouseholdContext;
  actions: AssistantAction[];
  links: { label: string; href: string }[];
}

interface ToolDef<S extends z.ZodType> {
  definition: Anthropic.Beta.BetaTool;
  schema: S;
  run: (input: z.infer<S>, t: ToolContext) => Promise<unknown>;
}

function tool<S extends z.ZodType>(name: string, description: string, schema: S, run: ToolDef<S>["run"]): ToolDef<S> {
  const json = stripUnsupported(z.toJSONSchema(schema, { target: "draft-7" })) as Anthropic.Beta.BetaTool["input_schema"];
  return { definition: { name, description, input_schema: json, strict: true }, schema, run };
}

/**
 * Strict tool schemas reject numeric/length/array-size constraints. They are
 * removed from what the model sees; the Zod schema still enforces them server-side.
 */
function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (["$schema", "minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "pattern"].includes(k)) continue;
    out[k] = stripUnsupported(v);
  }
  return out;
}

const nullableStr = z.string().nullable();
const hid = (t: ToolContext) => t.ctx.household.id;
const memberName = (t: ToolContext, id: string | null) => (id ? t.ctx.members.find((m) => m.user_id === id)?.profile?.display_name ?? null : null);
const link = (t: ToolContext, label: string, href: string) => {
  if (!t.links.some((l) => l.href === href)) t.links.push({ label, href });
};

/** Some modules ship in later migrations; a missing table means "not set up yet", not a failure. */
function missingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

// ---------------------------------------------------------------------------
export const TOOLS = [
  tool(
    "search_inventory",
    "Search the household's home inventory (what is in the fridge, freezer, pantry, cupboards). Returns quantity, unit, storage location, expiry and whether the stock figure is confirmed or estimated. Use an empty query to list everything; use location to answer 'what is in the freezer'.",
    z.object({
      query: nullableStr.describe("Product name or part of it, or null"),
      location: nullableStr.describe("Storage location name such as מקפיא or מקרר, or null"),
      only_low: z.boolean().describe("true to return only items that are out or below their minimum"),
    }),
    async (input, t) => {
      let q = t.supabase
        .from("inventory_items")
        .select("id, name, brand, quantity, unit, min_threshold, expires_on, stock_confidence, last_verified_at, location_id, inventory_locations(name)")
        .eq("household_id", hid(t))
        .is("archived_at", null)
        .order("name")
        .limit(80);
      if (input.query) q = q.ilike("name", `%${escapeLike(input.query)}%`);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        brand: i.brand,
        quantity: Number(i.quantity),
        unit: i.unit,
        location: (i.inventory_locations as unknown as { name: string } | null)?.name ?? null,
        min: i.min_threshold != null ? Number(i.min_threshold) : null,
        expires_on: i.expires_on,
        stock: i.stock_confidence,
        last_verified: i.last_verified_at?.slice(0, 10) ?? null,
      }));
      if (input.location) rows = rows.filter((r) => r.location && r.location.includes(input.location!));
      if (input.only_low) rows = rows.filter((r) => r.quantity <= 0 || (r.min != null && r.quantity < r.min));
      if (rows.length <= 6) rows.forEach((r) => link(t, r.name, `/inventory/${r.id}`));
      return { count: rows.length, items: rows };
    },
  ),

  tool("get_grocery_list", "Return the shared grocery shopping list (items still to buy and items already in the cart).", z.object({}), async (_input, t) => {
    const { data, error } = await t.supabase
      .from("shopping_list_items")
      .select("name, quantity, unit, brand, notes, priority, status, added_by")
      .eq("household_id", hid(t))
      .is("deleted_at", null)
      .is("cleared_at", null)
      .order("created_at");
    if (error) throw error;
    link(t, "רשימת הקניות", "/shopping");
    return {
      to_buy: (data ?? []).filter((i) => i.status === "pending").map((i) => ({ name: i.name, quantity: Number(i.quantity), unit: i.unit, brand: i.brand, notes: i.notes, urgent: i.priority === "high", added_by: memberName(t, i.added_by) })),
      in_cart: (data ?? []).filter((i) => i.status === "purchased").map((i) => i.name),
    };
  }),

  tool(
    "propose_grocery_items",
    "Propose adding items to the shared grocery list. Nothing is added until a household member taps confirm, so call this whenever the user asks to add groceries. Items already on the list are merged, not duplicated.",
    z.object({
      items: z
        .array(z.object({ name: z.string(), quantity: z.number(), unit: z.string().describe("יח׳ unless another unit is clear"), note: nullableStr }))
        .min(1)
        .max(40),
    }),
    async (input, t) => {
      const id = crypto.randomUUID();
      t.actions.push({
        id,
        type: "add_grocery",
        title: `הוספה לרשימת הקניות: ${input.items.map((i) => i.name).join(", ")}`.slice(0, 200),
        payload: { items: input.items.map((i) => ({ name: i.name.slice(0, 120), quantity: i.quantity > 0 ? i.quantity : 1, unit: (i.unit || "יח׳").slice(0, 20), note: i.note?.slice(0, 200) ?? null })) },
        status: "proposed",
      });
      return { proposal_id: id, status: "waiting_for_user_confirmation" };
    },
  ),

  tool(
    "search_recipes",
    "Search the household recipe book. Returns each recipe's id, title, times and how many ingredients are missing according to the inventory.",
    z.object({ query: nullableStr.describe("Words in the title, tags or ingredients, or null for all"), can_cook_now: z.boolean() }),
    async (input, t) => {
      const [{ data: recipes, error }, { data: ings }, { data: stock }] = await Promise.all([
        t.supabase.from("recipes").select("id, title, category, tags, prep_minutes, cook_minutes, is_favorite").eq("household_id", hid(t)).limit(200),
        t.supabase.from("recipe_ingredients").select("recipe_id, name, quantity, unit, optional").eq("household_id", hid(t)),
        t.supabase.from("inventory_items").select("id, name, quantity, unit").eq("household_id", hid(t)).is("archived_at", null),
      ]);
      if (error) throw error;
      const stockItems = (stock ?? []).map((s) => ({ ...s, quantity: Number(s.quantity) }));
      const q = input.query?.trim().toLowerCase();
      const out = (recipes ?? [])
        .map((r) => {
          const own = (ings ?? []).filter((i) => i.recipe_id === r.id);
          const checks = checkIngredients(own.map((i) => ({ name: i.name, quantity: i.quantity != null ? Number(i.quantity) : null, unit: i.unit, optional: i.optional })), stockItems);
          const missing = checks.filter((c) => !c.ingredient.optional && (c.status === "missing" || c.status === "insufficient")).map((c) => c.ingredient.name);
          return { id: r.id, title: r.title, category: r.category, minutes: (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0) || null, favorite: r.is_favorite, missing, ingredients: own.map((i) => i.name) };
        })
        .filter((r) => !q || r.title.toLowerCase().includes(q) || r.ingredients.some((i) => i.includes(q)) || (r.category ?? "").includes(q))
        .filter((r) => !input.can_cook_now || r.missing.length === 0)
        .slice(0, 15);
      out.slice(0, 5).forEach((r) => link(t, r.title, `/recipes/${r.id}`));
      return { recipes: out.map(({ ingredients: _i, ...r }) => r) };
    },
  ),

  tool(
    "compare_recipe_ingredients",
    "Check one recipe's ingredients against the inventory: which are available, missing, insufficient or unclear, and how much to buy.",
    z.object({ recipe_id: z.string().describe("Recipe id from search_recipes"), servings: z.number().nullable() }),
    async (input, t) => {
      const id = z.uuid().parse(input.recipe_id);
      const [{ data: recipe }, { data: ings }, { data: stock }, { data: maps }] = await Promise.all([
        t.supabase.from("recipes").select("id, title, servings").eq("id", id).eq("household_id", hid(t)).maybeSingle(),
        t.supabase.from("recipe_ingredients").select("name, quantity, unit, optional, inventory_item_id").eq("recipe_id", id).eq("household_id", hid(t)).order("position"),
        t.supabase.from("inventory_items").select("id, name, quantity, unit, stock_confidence").eq("household_id", hid(t)).is("archived_at", null),
        t.supabase.from("ingredient_product_mappings").select("ingredient_key, inventory_item_id").eq("household_id", hid(t)),
      ]);
      if (!recipe) return { error: "recipe not found" };
      const factor = input.servings && recipe.servings ? input.servings / Number(recipe.servings) : 1;
      const checks = checkIngredients(
        (ings ?? []).map((i) => ({ name: i.name, quantity: i.quantity != null ? Number(i.quantity) : null, unit: i.unit, optional: i.optional, inventory_item_id: i.inventory_item_id })),
        (stock ?? []).map((s) => ({ ...s, quantity: Number(s.quantity) })) as never,
        { servingsFactor: factor, mappings: Object.fromEntries((maps ?? []).map((m) => [m.ingredient_key, m.inventory_item_id])) },
      );
      link(t, recipe.title, `/recipes/${recipe.id}`);
      return {
        recipe: recipe.title,
        ingredients: checks.map((c) => ({ name: c.ingredient.name, status: c.status, in_stock_as: c.match?.name ?? null, to_buy: c.shortfall, note: c.reason, optional: !!c.ingredient.optional })),
      };
    },
  ),

  tool(
    "get_household_tasks",
    "List household chores and open project tasks due within a number of days (overdue ones included), with who is assigned.",
    z.object({ days_ahead: z.number().describe("How many days ahead to include, e.g. 7 for 'this week'"), assignee: z.enum(["me", "others", "everyone"]) }),
    async (input, t) => {
      const today = todayInZone(new Date(), t.ctx.household.timezone);
      const until = addDays(today, Math.max(0, Math.min(366, Math.round(input.days_ahead))));
      const [{ data: chores, error }, { data: tasks }] = await Promise.all([
        t.supabase.from("chores").select("id, title, next_due_on, assignee_id, frequency, last_completed_at").eq("household_id", hid(t)).eq("status", "active").lte("next_due_on", until).order("next_due_on"),
        t.supabase.from("project_tasks").select("title, due_on, assignee_id, done, project_id, home_projects(title)").eq("household_id", hid(t)).eq("done", false).limit(50),
      ]);
      if (error) throw error;
      const keep = (assignee: string | null) =>
        input.assignee === "everyone" ? true : input.assignee === "me" ? assignee === t.ctx.user.id || assignee === null : assignee !== t.ctx.user.id;
      link(t, "משימות בית", "/chores");
      return {
        today,
        chores: (chores ?? [])
          .filter((c) => keep(c.assignee_id))
          .map((c) => ({ title: c.title, due: c.next_due_on, overdue_days: Math.max(0, -daysUntil(c.next_due_on, new Date(), t.ctx.household.timezone)), assignee: memberName(t, c.assignee_id) ?? "משותף", frequency: c.frequency })),
        project_tasks: (tasks ?? [])
          .filter((x) => keep(x.assignee_id))
          .map((x) => ({ title: x.title, project: (x.home_projects as unknown as { title: string } | null)?.title, due: x.due_on, assignee: memberName(t, x.assignee_id) })),
      };
    },
  ),

  tool(
    "propose_task",
    "Propose creating a household chore or reminder (optionally recurring). It is created only after a member confirms. Use assignee_name with a member's first name, or null for shared.",
    z.object({
      title: z.string(),
      assignee_name: nullableStr,
      due_date: z.string().describe("YYYY-MM-DD in the household timezone"),
      frequency: z.enum(["once", "daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"]),
    }),
    async (input, t) => {
      const due = /^\d{4}-\d{2}-\d{2}$/.test(input.due_date) ? input.due_date : todayInZone(new Date(), t.ctx.household.timezone);
      const member = input.assignee_name ? t.ctx.members.find((m) => m.profile?.display_name && nameScore(m.profile.display_name, input.assignee_name!) > 0) : null;
      const id = crypto.randomUUID();
      t.actions.push({
        id,
        type: "create_chore",
        title: `משימה: ${input.title}${member ? ` · ${member.profile?.display_name}` : ""} · ${due}`.slice(0, 200),
        payload: { title: input.title.slice(0, 160), assignee_id: member?.user_id ?? null, next_due_on: due, frequency: input.frequency },
        status: "proposed",
      });
      return { proposal_id: id, status: "waiting_for_user_confirmation", assignee_found: !!member || !input.assignee_name };
    },
  ),

  tool(
    "get_projects",
    "Home projects and repairs with their status, owner, costs and full history (troubleshooting attempts, technician visits, quotes). Use this to answer 'what is the status of the AC repair'.",
    z.object({ query: nullableStr, kind: z.enum(["project", "repair", "any"]), include_closed: z.boolean() }),
    async (input, t) => {
      let q = t.supabase
        .from("home_projects")
        .select("id, kind, title, status, priority, owner_id, due_on, estimated_cost, actual_cost, symptoms, first_reported_on, warranty_notes, resolution, provider_id, service_providers(name, trade, phone)")
        .eq("household_id", hid(t))
        .order("updated_at", { ascending: false })
        .limit(20);
      if (input.kind !== "any") q = q.eq("kind", input.kind);
      if (!input.include_closed) q = q.not("status", "in", "(completed,canceled)");
      if (input.query) q = q.or(`title.ilike.%${orFilterTerm(input.query)}%,symptoms.ilike.%${orFilterTerm(input.query)}%`);
      const { data, error } = await q;
      if (error) throw error;
      const ids = (data ?? []).map((p) => p.id);
      const { data: acts } = ids.length
        ? await t.supabase.from("project_activities").select("project_id, kind, body, occurred_on, amount").in("project_id", ids).order("occurred_on")
        : { data: [] };
      (data ?? []).slice(0, 4).forEach((p) => link(t, p.title, `/projects/${p.id}`));
      return {
        projects: (data ?? []).map((p) => ({
          title: p.title,
          kind: p.kind,
          status: p.status,
          urgent: p.priority === "high",
          owner: memberName(t, p.owner_id),
          due: p.due_on,
          estimated_cost: p.estimated_cost,
          actual_cost: p.actual_cost,
          symptoms: p.symptoms,
          first_reported: p.first_reported_on,
          warranty: p.warranty_notes,
          resolution: p.resolution,
          provider: p.service_providers,
          history: (acts ?? []).filter((a) => a.project_id === p.id).map((a) => ({ kind: a.kind, date: a.occurred_on, text: a.body, amount: a.amount })),
        })),
      };
    },
  ),

  tool(
    "get_planned_purchases",
    "Planned purchases for the home (furniture and items by room) with status, price, store and link. Use for 'what do we still need for the office'.",
    z.object({ room: nullableStr, include_purchased: z.boolean() }),
    async (input, t) => {
      let q = t.supabase.from("planned_purchases").select("id, name, status, price, quantity, store, url, room_id, rooms(name)").eq("household_id", hid(t)).limit(80);
      if (!input.include_purchased) q = q.not("status", "in", "(purchased,canceled)");
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? [])
        .map((p) => ({ id: p.id, name: p.name, status: p.status, price: p.price, quantity: p.quantity, store: p.store, url: p.url, room: (p.rooms as unknown as { name: string } | null)?.name ?? null }))
        .filter((p) => !input.room || (p.room ?? "").includes(input.room));
      link(t, "תכנון רכישות", "/planner");
      return { items: rows.map(({ id: _id, ...r }) => r) };
    },
  ),

  tool("get_meal_plan", "The meal plan between two dates (inclusive).", z.object({ from: z.string(), to: z.string() }), async (input, t) => {
    const { data, error } = await t.supabase
      .from("meal_plan_entries")
      .select("plan_date, slot, title, servings, recipes(title)")
      .eq("household_id", hid(t))
      .gte("plan_date", input.from)
      .lte("plan_date", input.to)
      .order("plan_date");
    if (error) throw error;
    link(t, "תכנון ארוחות", "/meals");
    return { meals: (data ?? []).map((m) => ({ date: m.plan_date, slot: m.slot, meal: (m.recipes as unknown as { title: string } | null)?.title ?? m.title, servings: m.servings })) };
  }),

  tool(
    "search_appliances",
    "Find household appliances (fridge, washing machine, AC…) with model, purchase date, warranty end, store and whether an invoice or manual is stored. Never guess warranty details that are not returned.",
    z.object({ query: nullableStr }),
    async (input, t) => {
      let q = t.supabase.from("appliances").select("id, name, brand, model, room_id, purchased_on, store, warranty_until, invoice_document_id, manual_document_id, notes").eq("household_id", hid(t)).limit(30);
      if (input.query) q = q.or(`name.ilike.%${orFilterTerm(input.query)}%,brand.ilike.%${orFilterTerm(input.query)}%,model.ilike.%${orFilterTerm(input.query)}%`);
      const { data, error } = await q;
      if (missingTable(error)) return { not_set_up: true };
      if (error) throw error;
      (data ?? []).slice(0, 4).forEach((a) => link(t, a.name, `/appliances/${a.id}`));
      return { appliances: (data ?? []).map(({ invoice_document_id, manual_document_id, ...a }) => ({ ...a, has_invoice: !!invoice_document_id, has_manual: !!manual_document_id })) };
    },
  ),

  tool(
    "search_documents",
    "Search the household document vault (insurance, contracts, warranties, invoices) by title, category, tags and extracted text. Returns expiry dates. If nothing matches, say so instead of guessing.",
    z.object({ query: z.string() }),
    async (input, t) => {
      const { data, error } = await t.supabase.rpc("search_documents", { p_household: hid(t), p_query: input.query.slice(0, 200) });
      if (missingTable(error) || error?.code === "PGRST202") return { not_set_up: true };
      if (error) throw error;
      const rows = (data ?? []) as { id: string; title: string; category: string | null; expires_on: string | null; snippet: string | null }[];
      rows.slice(0, 4).forEach((d) => link(t, d.title, `/documents/${d.id}`));
      return { documents: rows.map(({ id: _id, ...d }) => d) };
    },
  ),

  tool(
    "get_utility_bills",
    "Utility and household bills (electricity, water, arnona, gas, internet…) with amounts, billing periods, consumption and payment status, newest first.",
    z.object({ category: nullableStr.describe("electricity, water, arnona, gas, internet, building, insurance, other or null"), months: z.number() }),
    async (input, t) => {
      const since = addDays(todayInZone(new Date(), t.ctx.household.timezone), -Math.round(Math.max(1, Math.min(36, input.months)) * 31));
      let q = t.supabase
        .from("utility_bills")
        .select("id, category, provider_name, period_start, period_end, amount, currency, due_on, paid_on, consumption, consumption_unit, verified")
        .eq("household_id", hid(t))
        .gte("period_end", since)
        .order("period_end", { ascending: false })
        .limit(60);
      if (input.category) q = q.eq("category", input.category);
      const { data, error } = await q;
      if (missingTable(error)) return { not_set_up: true };
      if (error) throw error;
      link(t, "חשבונות", "/bills");
      return { bills: (data ?? []).map(({ id: _id, ...b }) => b) };
    },
  ),

  tool(
    "get_calendar_events",
    "Shared household calendar events (technicians, deliveries, guests, payments) between two dates.",
    z.object({ from: z.string(), to: z.string() }),
    async (input, t) => {
      const { data, error } = await t.supabase
        .from("household_events")
        .select("title, starts_at, ends_at, all_day, category, location, assignee_id")
        .eq("household_id", hid(t))
        .gte("starts_at", `${input.from}T00:00:00`)
        .lte("starts_at", `${input.to}T23:59:59`)
        .order("starts_at");
      if (missingTable(error)) return { not_set_up: true };
      if (error) throw error;
      link(t, "יומן", "/calendar");
      return { events: (data ?? []).map((e) => ({ ...e, assignee: memberName(t, e.assignee_id) })) };
    },
  ),

  tool(
    "get_smart_home_status",
    "Current state of connected smart-home devices (AC, water boiler, lights, sensors) as last reported by Home Assistant, with the time of the last update.",
    z.object({}),
    async (_input, t) => {
      const { data, error } = await t.supabase.from("smart_home_devices").select("name, kind, room_id, online, state, attributes, state_updated_at").eq("household_id", hid(t)).order("name");
      if (missingTable(error)) return { not_set_up: true };
      if (error) throw error;
      link(t, "בית חכם", "/smart-home");
      return { connected: (data ?? []).length > 0, devices: data ?? [] };
    },
  ),

  tool(
    "propose_smart_home_action",
    "Propose a smart-home command (power on/off, AC temperature or mode). It runs only after a household member confirms in the app; the app then reports the device's real state. Use device names from get_smart_home_status.",
    z.object({
      device_name: z.string(),
      action: z.enum(["turn_on", "turn_off", "set_temperature", "set_mode"]),
      value: z.string().nullable().describe("Temperature number or mode (cool, heat, auto, dry, fan_only) when needed"),
    }),
    async (input, t) => {
      const { data, error } = await t.supabase.from("smart_home_devices").select("id, name, kind, capabilities").eq("household_id", hid(t));
      if (missingTable(error)) return { not_set_up: true };
      if (error) throw error;
      const device = (data ?? []).find((d) => nameScore(d.name, input.device_name) > 0) ?? (data ?? []).find((d) => d.name.includes(input.device_name));
      if (!device) return { error: "device not found", available: (data ?? []).map((d) => d.name).slice(0, 30) };
      const command =
        input.action === "turn_on" ? { type: "power", on: true }
        : input.action === "turn_off" ? { type: "power", on: false }
        : input.action === "set_temperature" ? { type: "set_temperature", value: Number(input.value) }
        : { type: "set_hvac_mode", value: String(input.value ?? "") };
      if (command.type === "set_temperature" && !Number.isFinite(command.value)) return { error: "temperature value required" };
      const id = crypto.randomUUID();
      const verb =
        input.action === "turn_on" ? "הדלקה" : input.action === "turn_off" ? "כיבוי" : input.action === "set_temperature" ? `כיוון ל-${input.value}°` : `מצב ${input.value}`;
      t.actions.push({ id, type: "smart_home", title: `${device.name}: ${verb}`.slice(0, 200), payload: { device_id: device.id, command }, status: "proposed" });
      link(t, "בית חכם", "/smart-home");
      return { proposal_id: id, status: "waiting_for_user_confirmation" };
    },
  ),
];

export type AnyTool = (typeof TOOLS)[number];
export const TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = TOOLS.map((t) => t.definition);
export const TOOL_BY_NAME = new Map<string, AnyTool>(TOOLS.map((t) => [t.definition.name, t]));
