import { describe, expect, it } from "vitest";
import { smartSuggestions } from "@/lib/grocery";

const inv = (id: string, name: string, quantity: number, min: number | null) => ({ id, name, unit: "יח׳", quantity, min_threshold: min });
const hist = (name: string) => ({ name, unit: "יח׳", inventory_item_id: null, category_id: null });

describe("smartSuggestions", () => {
  it("puts running-out stock first, then frequent purchases", () => {
    const s = smartSuggestions({
      active: [],
      inventory: [inv("a", "חלב", 1, 2), inv("b", "אורז", 5, 1), inv("c", "ביצים", 0, null)],
      history: [hist("לחם"), hist("לחם"), hist("לחם"), hist("עגבניות"), hist("עגבניות"), hist("במבה")],
    });
    expect(s.map((x) => [x.name, x.reason])).toEqual([
      ["חלב", "low"],
      ["ביצים", "low"],
      ["לחם", "frequent"],
      ["עגבניות", "frequent"],
    ]);
  });

  it("skips what is already on the list, by link or by name, and de-duplicates", () => {
    const s = smartSuggestions({
      active: [{ name: "חָלָב", inventory_item_id: null }, { name: "משהו", inventory_item_id: "c" }],
      inventory: [inv("a", "חלב", 0, 1), inv("c", "ביצים", 0, null), inv("d", "לחם", 0, null)],
      history: [hist("לחם"), hist("לחם")],
    });
    expect(s.map((x) => x.key)).toEqual(["low:d"]);
  });

  it("respects the limit", () => {
    const s = smartSuggestions({ active: [], inventory: [inv("a", "א", 0, null), inv("b", "ב", 0, null), inv("c", "ג", 0, null)], history: [], limit: 2 });
    expect(s).toHaveLength(2);
  });
});
