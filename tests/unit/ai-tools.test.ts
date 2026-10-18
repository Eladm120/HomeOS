// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { TOOLS, type ToolContext } from "@/server/ai/tools";

const HID = "11111111-1111-4111-8111-111111111111";
const ME = "22222222-2222-4222-8222-222222222222";

/** A Supabase stand-in that records every call; reads resolve to empty data. */
function recordingClient() {
  const chains: { table: string; calls: [string, unknown[]][] }[] = [];
  const rpcs: [string, unknown][] = [];
  function chain(table: string) {
    const rec = { table, calls: [] as [string, unknown[]][] };
    chains.push(rec);
    const proxy: unknown = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ data: [], error: null, count: 0 });
          return (...args: unknown[]) => {
            rec.calls.push([prop, args]);
            if (prop === "maybeSingle" || prop === "single") return Promise.resolve({ data: null, error: null });
            return proxy;
          };
        },
      },
    );
    return proxy;
  }
  const client = {
    from: (table: string) => chain(table),
    rpc: (name: string, args: unknown) => {
      rpcs.push([name, args]);
      return Promise.resolve({ data: [], error: null });
    },
  };
  return { client, chains, rpcs };
}

function toolContext(client: unknown): ToolContext {
  return {
    supabase: client as ToolContext["supabase"],
    ctx: {
      user: { id: ME },
      profile: { id: ME, display_name: "אלעד", avatar_path: null, locale: "he" },
      household: { id: HID, name: "בית", timezone: "Asia/Jerusalem", currency: "ILS", locale: "he", settings: {}, created_at: "" },
      role: "owner",
      members: [{ id: "m", household_id: HID, user_id: ME, role: "owner", created_at: "", profile: { id: ME, display_name: "אלעד", avatar_path: null } }],
    } as unknown as ToolContext["ctx"],
    actions: [],
    links: [],
  };
}

const SAMPLE_INPUT: Record<string, unknown> = {
  search_inventory: { query: "חלב", location: null, only_low: false },
  get_grocery_list: {},
  propose_grocery_items: { items: [{ name: "אבקת כביסה", quantity: 1, unit: "יח׳", note: null }] },
  search_recipes: { query: null, can_cook_now: false },
  compare_recipe_ingredients: { recipe_id: "33333333-3333-4333-8333-333333333333", servings: null },
  get_household_tasks: { days_ahead: 7, assignee: "everyone" },
  propose_task: { title: "להחליף מצעים", assignee_name: "נעה", due_date: "2026-10-23", frequency: "weekly" },
  get_projects: { query: null, kind: "any", include_closed: false },
  get_planned_purchases: { room: null, include_purchased: false },
  get_meal_plan: { from: "2026-10-18", to: "2026-10-24" },
  search_appliances: { query: "מקרר" },
  search_documents: { query: "ביטוח" },
  get_utility_bills: { category: null, months: 6 },
  get_calendar_events: { from: "2026-10-18", to: "2026-10-24" },
  get_smart_home_status: {},
};

const WRITE_METHODS = ["insert", "update", "upsert", "delete"];
const run = (t: (typeof TOOLS)[number], args: unknown, c: ToolContext) => (t.run as (a: unknown, c: ToolContext) => Promise<unknown>)(args, c);

describe("assistant tools", () => {
  it("has a sample input for every tool", () => {
    expect(Object.keys(SAMPLE_INPUT).sort()).toEqual(TOOLS.map((t) => t.definition.name).sort());
  });

  for (const t of TOOLS) {
    it(`${t.definition.name}: household-scoped and read-only`, async () => {
      const { client, chains, rpcs } = recordingClient();
      await run(t, t.schema.parse(SAMPLE_INPUT[t.definition.name]), toolContext(client));
      for (const c of chains) {
        expect(c.calls.map(([m]) => m).filter((m) => WRITE_METHODS.includes(m))).toEqual([]);
        const scoped = c.calls.some(([m, a]) => m === "eq" && a[0] === "household_id" && a[1] === HID);
        const byParent = c.calls.some(([m, a]) => m === "in" && a[0] === "project_id");
        expect(scoped || byParent, `${t.definition.name} → ${c.table} is not household-scoped`).toBe(true);
      }
      for (const [, a] of rpcs) expect((a as { p_household: string }).p_household).toBe(HID);
    });
  }

  it("proposal tools only queue a proposal for confirmation", async () => {
    const { client, chains } = recordingClient();
    const tc = toolContext(client);
    for (const name of ["propose_grocery_items", "propose_task"]) {
      const t = TOOLS.find((x) => x.definition.name === name)!;
      const out = (await run(t, t.schema.parse(SAMPLE_INPUT[name]), tc)) as { status: string };
      expect(out.status).toBe("waiting_for_user_confirmation");
    }
    expect(chains).toEqual([]);
    expect(tc.actions.map((a) => [a.type, a.status])).toEqual([
      ["add_grocery", "proposed"],
      ["create_chore", "proposed"],
    ]);
  });

  it("rejects a malformed id before any database access", async () => {
    const t = TOOLS.find((x) => x.definition.name === "compare_recipe_ingredients")!;
    const { client, chains } = recordingClient();
    await expect(run(t, t.schema.parse({ recipe_id: "'; drop table recipes; --", servings: null }), toolContext(client))).rejects.toThrow();
    expect(chains).toEqual([]);
  });

  it("exposes strict schemas without unsupported constraints", () => {
    for (const t of TOOLS) {
      expect(t.definition.strict).toBe(true);
      const json = JSON.stringify(t.definition.input_schema);
      expect(json).not.toMatch(/minItems|maxItems|minLength|maxLength|\$schema/);
      expect(json).toContain('"additionalProperties":false');
    }
  });
});
