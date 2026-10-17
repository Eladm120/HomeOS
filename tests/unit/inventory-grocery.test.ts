import { describe, expect, it } from "vitest";
import { estimateDepletion, expiryState, stockLevel } from "@/lib/inventory-logic";
import { groupByCategory, matchInventory, splitByStatus } from "@/lib/grocery";
import { buildDailyBrief } from "@/lib/daily-brief";
import type { InventoryMovement, ShoppingListItem } from "@/lib/types";

describe("stockLevel", () => {
  it("classifies out / low / ok", () => {
    expect(stockLevel({ quantity: 0, min_threshold: null })).toBe("out");
    expect(stockLevel({ quantity: 1, min_threshold: 1 })).toBe("low");
    expect(stockLevel({ quantity: 3, min_threshold: 1 })).toBe("ok");
    expect(stockLevel({ quantity: 3, min_threshold: null })).toBe("ok");
  });
});

describe("expiryState", () => {
  const now = new Date("2026-03-10T09:00:00Z");
  it("detects expired, soon and ok", () => {
    expect(expiryState("2026-03-09", now)).toEqual({ days: -1, state: "expired" });
    expect(expiryState("2026-03-12", now)).toEqual({ days: 2, state: "soon" });
    expect(expiryState("2026-04-01", now)?.state).toBe("ok");
    expect(expiryState(null, now)).toBeNull();
  });
});

describe("estimateDepletion", () => {
  const now = new Date("2026-03-31T12:00:00Z");
  const mv = (daysAgo: number, qty: number, kind: InventoryMovement["kind"] = "consume") => ({
    kind,
    quantity_delta: -qty,
    created_at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  });

  it("returns null without enough history (never guesses)", () => {
    expect(estimateDepletion([], 5, now)).toBeNull();
    expect(estimateDepletion([mv(1, 1)], 5, now)).toBeNull();
    expect(estimateDepletion([mv(1, 1), mv(0.5, 1)], 5, now)).toBeNull(); // span < 3 days
  });

  it("estimates days left from the consumption rate", () => {
    // 10 units consumed over 10 days → 1/day; 4 left → 4 days
    const history = [mv(10, 2), mv(8, 2), mv(5, 2), mv(3, 2), mv(1, 2)];
    const e = estimateDepletion(history, 4, now)!;
    expect(e.dailyRate).toBeCloseTo(1, 5);
    expect(e.daysLeft).toBe(4);
    expect(e.confidence).toBe("medium");
  });

  it("ignores purchases and old events outside the window", () => {
    const history = [mv(200, 50), { kind: "purchase" as const, quantity_delta: 10, created_at: now.toISOString() }, mv(6, 3), mv(2, 3)];
    const e = estimateDepletion(history, 6, now)!;
    expect(e.basedOnEvents).toBe(2);
    expect(e.dailyRate).toBeCloseTo(1, 5);
  });
});

function gi(id: string, patch: Partial<ShoppingListItem>): ShoppingListItem {
  return {
    id, household_id: "h", list_id: "l", catalog_product_id: null, inventory_item_id: null, category_id: null,
    name: id, quantity: 1, unit: "יח׳", brand: null, variant: null, notes: null, priority: "normal", status: "pending",
    image_path: null, added_by: null, purchased_by: null, purchased_at: null, cleared_at: null, deleted_at: null,
    version: 1, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", ...patch,
  };
}

describe("grocery grouping", () => {
  const cats = [
    { id: "dairy", name: "מוצרי חלב", sort_order: 2 },
    { id: "veg", name: "ירקות", sort_order: 1 },
  ];
  it("groups in category order, uncategorized last, urgent first", () => {
    const groups = groupByCategory(
      [
        gi("milk", { category_id: "dairy", created_at: "2026-01-01T00:00:00Z" }),
        gi("cheese", { category_id: "dairy", priority: "high", created_at: "2026-01-02T00:00:00Z" }),
        gi("tomato", { category_id: "veg" }),
        gi("batteries", { category_id: null }),
        gi("ghost", { category_id: "deleted-category" }),
      ],
      cats,
    );
    expect(groups.map((g) => g.name)).toEqual(["ירקות", "מוצרי חלב", "ללא קטגוריה"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["cheese", "milk"]);
    expect(groups[2].items.map((i) => i.id)).toEqual(["batteries", "ghost"]);
  });

  it("splits pending from purchased", () => {
    const { pending, done } = splitByStatus([gi("a", {}), gi("b", { status: "purchased", purchased_at: "2026-01-02T00:00:00Z" })]);
    expect(pending.map((i) => i.id)).toEqual(["a"]);
    expect(done.map((i) => i.id)).toEqual(["b"]);
  });

  it("matches inventory by link first, then exact name", () => {
    const inv = [{ id: "1", name: "חלב" }, { id: "2", name: "לחם" }];
    expect(matchInventory({ name: "לחם", inventory_item_id: "1" }, inv)?.id).toBe("1");
    expect(matchInventory({ name: " חלב ", inventory_item_id: null }, inv)?.id).toBe("1");
    expect(matchInventory({ name: "חלב סויה", inventory_item_id: null }, inv)).toBeNull();
  });
});

describe("buildDailyBrief", () => {
  it("is empty when nothing needs attention", () => {
    expect(buildDailyBrief({ pendingGrocery: 0, urgentGrocery: 0, outOfStock: [], lowStock: [], expired: [], expiringSoon: [] })).toEqual([]);
  });
  it("reports only facts from data", () => {
    const lines = buildDailyBrief({
      pendingGrocery: 4,
      urgentGrocery: 1,
      outOfStock: ["חלב"],
      lowStock: [],
      expired: [],
      expiringSoon: [{ name: "יוגורט", days: 1 }],
    });
    expect(lines.every((l) => l.kind === "fact")).toBe(true);
    expect(lines.map((l) => l.text).join(" ")).toContain("חלב");
    expect(lines.map((l) => l.text).join(" ")).toContain("יוגורט מסתיים מחר");
    expect(lines.at(-1)?.text).toBe("ברשימת הקניות 4 מוצרים, מתוכם אחד דחוף.");
  });
});
