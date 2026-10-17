import { describe, expect, it } from "vitest";
import { aggregateShortfalls, checkIngredients, convert, ingredientKey, nameScore, parseIngredientLine } from "@/lib/ingredients";

const stock = [
  { id: "flour", name: "קמח לבן", quantity: 1, unit: "ק״ג" },
  { id: "eggs", name: "ביצים", quantity: 4, unit: "יח׳" },
  { id: "milk", name: "חלב 3%", quantity: 0.5, unit: "ליטר" },
  { id: "oil", name: "שמן זית", quantity: 1, unit: "בקבוק" },
  { id: "salt", name: "מלח", quantity: 0, unit: "ק״ג" },
];

describe("units", () => {
  it("converts within a dimension only", () => {
    expect(convert(500, "גרם", "ק״ג")).toBe(0.5);
    expect(convert(2, "כוסות", "מ״ל")).toBe(480);
    expect(convert(1, "כוס", "גרם")).toBeNull();
    expect(convert(1, "בקבוק", "בקבוק")).toBe(1);
    expect(convert(1, "בקבוק", "מ״ל")).toBeNull();
  });
});

describe("names", () => {
  it("normalises Hebrew plurals, finals and descriptors", () => {
    expect(ingredientKey("עגבניות שרי טריות")).toBe(ingredientKey("עגבנייה שרי"));
    expect(nameScore("ביצה גדולה", "ביצים")).toBeGreaterThan(0);
    expect(nameScore("קמח", "קמח לבן")).toBe(1);
    expect(nameScore("שמן", "שמן זית")).toBeGreaterThan(0);
    expect(nameScore("סוכר", "קמח")).toBe(0);
  });
});

describe("checkIngredients", () => {
  it("classifies available, insufficient, missing and unclear", () => {
    const res = checkIngredients(
      [
        { name: "קמח", quantity: 500, unit: "גרם" },
        { name: "ביצים", quantity: 6, unit: null },
        { name: "חלב", quantity: 3, unit: "כוסות" },
        { name: "שמן זית", quantity: 3, unit: "כפות" },
        { name: "סוכר", quantity: 100, unit: "גרם" },
        { name: "מלח", quantity: 1, unit: "כפית" },
      ],
      stock,
    );
    const by = Object.fromEntries(res.map((r) => [r.ingredient.name, r]));
    expect(by["קמח"].status).toBe("available");
    expect(by["ביצים"].status).toBe("insufficient");
    expect(by["ביצים"].shortfall).toEqual({ quantity: 2, unit: "יח׳" });
    expect(by["חלב"].status).toBe("insufficient");
    expect(by["חלב"].shortfall).toEqual({ quantity: 0.22, unit: "ליטר" });
    expect(by["שמן זית"].status).toBe("unclear");
    expect(by["סוכר"].status).toBe("missing");
    expect(by["סוכר"].shortfall).toEqual({ quantity: 100, unit: "גרם" });
    expect(by["מלח"].status).toBe("missing");
  });

  it("scales by servings and respects learned mappings", () => {
    const [r] = checkIngredients([{ name: "קמח לעוגה", quantity: 400, unit: "גרם" }], stock, {
      servingsFactor: 3,
      mappings: { [ingredientKey("קמח לעוגה")]: "flour" },
    });
    expect(r.match?.id).toBe("flour");
    expect(r.status).toBe("insufficient");
    expect(r.shortfall).toEqual({ quantity: 0.2, unit: "ק״ג" });
  });

  it("aggregates a week of shortfalls without mixing incompatible units", () => {
    const a = checkIngredients([{ name: "סוכר", quantity: 100, unit: "גרם" }], stock);
    const b = checkIngredients([{ name: "סוכר", quantity: 0.2, unit: "ק״ג" }, { name: "סוכר", quantity: 1, unit: "כוס" }], stock);
    const merged = aggregateShortfalls([
      { source: "עוגה", checks: a },
      { source: "עוגיות", checks: b },
    ]);
    const grams = merged.find((m) => m.unit === "גרם");
    expect(grams?.quantity).toBe(300);
    expect(grams?.sources).toEqual(["עוגה", "עוגיות"]);
    expect(merged.find((m) => m.unit === "כוס")?.quantity).toBe(1);
  });
});

describe("parseIngredientLine", () => {
  it("reads quantity, unit and name", () => {
    expect(parseIngredientLine("2 כוסות קמח")).toEqual({ name: "קמח", quantity: 2, unit: "כוסות" });
    expect(parseIngredientLine("1/2 כפית מלח")).toEqual({ name: "מלח", quantity: 0.5, unit: "כפית" });
    expect(parseIngredientLine("• ביצה")).toEqual({ name: "ביצה", quantity: null, unit: null });
    expect(parseIngredientLine("קמח - 500 גרם")).toEqual({ name: "קמח", quantity: 500, unit: "גרם" });
    expect(parseIngredientLine("1 1/2 כוס חלב")).toEqual({ name: "חלב", quantity: 1.5, unit: "כוס" });
  });
});
