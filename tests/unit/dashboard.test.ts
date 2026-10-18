import { describe, expect, it } from "vitest";
import type { AlertItem } from "@/lib/alerts";
import { buildBrief, DEFAULT_LAYOUT, householdStage, moveWidget, normalizeLayout, toggleWidget } from "@/lib/dashboard";

const alert = (p: Partial<AlertItem> & Pick<AlertItem, "key" | "group" | "urgency">): AlertItem => ({ emoji: "•", hue: 0, title: p.key, detail: "", href: "/", ...p });
const empty = { alerts: [], tasks: [], grocery: { count: 0, urgent: 0 }, meals: [], readyRecipe: null };

describe("layout", () => {
  it("drops unknown ids, de-duplicates and appends new widgets", () => {
    const l = normalizeLayout({ order: ["tasks", "nope", "tasks", "grocery"], hidden: ["meals", "x"] });
    expect(l.order.slice(0, 2)).toEqual(["tasks", "grocery"]);
    expect(l.order).toHaveLength(DEFAULT_LAYOUT.order.length);
    expect(l.hidden).toEqual(["meals"]);
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
  });

  it("moves within bounds and toggles visibility", () => {
    expect(moveWidget(DEFAULT_LAYOUT, "tasks", -1).order.slice(0, 2)).toEqual(["tasks", "grocery"]);
    expect(moveWidget(DEFAULT_LAYOUT, "grocery", -1)).toBe(DEFAULT_LAYOUT);
    expect(toggleWidget(toggleWidget(DEFAULT_LAYOUT, "meals"), "meals").hidden).toEqual([]);
  });
});

describe("householdStage", () => {
  it("classifies new / partial / active", () => {
    expect(householdStage({ inventory: 0, chores: 0, recipes: 0, groceryEver: 0 })).toBe("new");
    expect(householdStage({ inventory: 0, chores: 0, recipes: 2, groceryEver: 0 })).toBe("partial");
    expect(householdStage({ inventory: 10, chores: 3, recipes: 0, groceryEver: 0 })).toBe("active");
  });
});

describe("buildBrief", () => {
  it("says it is calm and invents nothing when there is no data", () => {
    const b = buildBrief(empty);
    expect(b.insights).toEqual([]);
    expect(b.calm).toBe(true);
    expect(b.headline).toBe("הכל רגוע בבית היום");
  });

  it("puts overdue tasks and urgent money first, and reports which alerts it used", () => {
    const b = buildBrief({
      ...empty,
      tasks: [{ id: "1", title: "ניקוי מזגן", days: -2 }],
      alerts: [
        alert({ key: "stock:1", group: "stock", urgency: "soon" }),
        alert({ key: "bill:1", group: "money", urgency: "now", action: { type: "bill_paid", id: "b", label: "שולם" } }),
        alert({ key: "chore:1", group: "chore", urgency: "now" }),
        alert({ key: "stock:2", group: "stock", urgency: "now", handled: "ברשימת הקניות" }),
      ],
    });
    expect(b.insights.map((x) => x.key)).toEqual(["tasks:overdue", "bill:1"]);
    expect(b.usedAlertKeys).toEqual(["bill:1"]);
    expect(b.headline).toBe("2 דברים מחכים לכם היום");
  });

  it("suggests a ready recipe only when nothing is planned", () => {
    const ready = { title: "שקשוקה", href: "/recipes/1" };
    expect(buildBrief({ ...empty, readyRecipe: ready }).insights[0].key).toBe("meal:ready");
    expect(buildBrief({ ...empty, readyRecipe: ready, meals: [{ title: "פסטה", slot: "ערב", href: "/" }] }).insights).toEqual([]);
  });
});
