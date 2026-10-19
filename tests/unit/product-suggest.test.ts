import { describe, expect, it } from "vitest";
import { normalizeProductName, suggestProducts } from "@/lib/grocery";

const names = (xs: { name: string }[]) => xs.map((x) => x.name);
const inv = ["שוקו חלב", "חלב שקדים", "חלב", "אבטיח", "חלב סויה", "גבינה", "חלבה"].map((name, i) => ({ id: String(i), name }));

describe("suggestProducts", () => {
  it("returns everything that contains the text, exact match first", () => {
    expect(names(suggestProducts("חלב", inv))).toEqual(["חלב", "חלבה", "חלב סויה", "חלב שקדים", "שוקו חלב"]);
  });

  it("ignores niqqud, case and extra spaces, and drops duplicates", () => {
    expect(normalizeProductName("  חָלָב   סויה ")).toBe("חלב סויה");
    expect(names(suggestProducts("MILK", [{ name: "Milk" }, { name: "milk" }, { name: "Oat milk" }]))).toEqual(["Milk", "Oat milk"]);
  });

  it("returns nothing for empty input and respects the limit", () => {
    expect(suggestProducts("  ", inv)).toEqual([]);
    expect(suggestProducts("ח", inv, 2)).toHaveLength(2);
  });
});
