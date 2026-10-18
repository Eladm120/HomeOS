import { describe, expect, it } from "vitest";
import { buildAlerts, type AlertInputs } from "@/lib/alerts";

const now = new Date("2026-10-18T09:00:00Z");
const base: AlertInputs = {
  today: "2026-10-18",
  now,
  inventory: [],
  onListInventoryIds: new Set(),
  chores: [],
  bills: [],
  charges: [],
  plants: [],
  suggestions: [],
};
const ID = "00000000-0000-4000-8000-000000000001";

describe("buildAlerts", () => {
  it("flags milk at its minimum with an add-to-list button", () => {
    const [a] = buildAlerts({ ...base, inventory: [{ id: ID, name: "חלב", unit: "ליטר", quantity: 3, min_threshold: 3, expires_on: null }] });
    expect(a.group).toBe("stock");
    expect(a.action).toMatchObject({ type: "add_to_list", id: ID });
  });

  it("shows an item already on the list as handled, without a button", () => {
    const [a] = buildAlerts({ ...base, onListInventoryIds: new Set([ID]), inventory: [{ id: ID, name: "חלב", unit: "ליטר", quantity: 0, min_threshold: 3, expires_on: null }] });
    expect(a.handled).toBe("ברשימת הקניות");
    expect(a.action).toBeUndefined();
  });

  it("ignores stock above the minimum and items without one", () => {
    const list = buildAlerts({
      ...base,
      inventory: [
        { id: ID, name: "חלב", unit: "ליטר", quantity: 4, min_threshold: 3, expires_on: null },
        { id: "x", name: "קפה", unit: "חבילה", quantity: 0, min_threshold: null, expires_on: null },
      ],
    });
    expect(list).toHaveLength(0);
  });

  it("reminds about rent a day before, and not two weeks ahead", () => {
    const soon = buildAlerts({ ...base, charges: [{ id: ID, title: "שכר דירה", amount: 5800, next_due_on: "2026-10-19" }] });
    expect(soon[0]).toMatchObject({ group: "money", urgency: "now", action: { type: "charge_paid" } });
    expect(buildAlerts({ ...base, charges: [{ id: ID, title: "שכר דירה", amount: 5800, next_due_on: "2026-11-01" }] })).toHaveLength(0);
  });

  it("puts urgent, actionable alerts before handled ones", () => {
    const list = buildAlerts({
      ...base,
      onListInventoryIds: new Set(["a"]),
      inventory: [{ id: "a", name: "ביצים", unit: "יח׳", quantity: 0, min_threshold: 6, expires_on: null }],
      chores: [{ id: ID, title: "מחזור", next_due_on: "2026-10-17", assignee_name: null }],
    });
    expect(list.map((a) => a.group)).toEqual(["chore", "stock"]);
  });
});
