import { describe, expect, it } from "vitest";
import { categoryKind, guessCategoryId, guessProduct, productEmoji } from "@/lib/category-style";

const categories = [
  { id: "produce", name: "פירות וירקות", icon: "apple" },
  { id: "dairy", name: "מוצרי חלב", icon: "milk" },
  { id: "meat", name: "בשר ודגים", icon: "beef" },
  { id: "pantry", name: "מזווה", icon: "wheat" },
  { id: "bakery", name: "מאפים ולחם", icon: "croissant" },
  { id: "cleaning", name: "ניקיון", icon: "spray-can" },
];

describe("category style", () => {
  it("maps default and custom category names to a kind", () => {
    expect(categoryKind({ name: "מוצרי חלב", icon: "milk" })).toBe("dairy");
    expect(categoryKind({ name: "ירקות אורגניים" })).toBe("produce");
    expect(categoryKind({ name: "משהו אחר" })).toBe("other");
    expect(categoryKind(null)).toBe("other");
  });

  it("guesses a category for typed products", () => {
    expect(guessCategoryId("2 עגבניות", categories)).toBe("produce");
    expect(guessCategoryId("חלב 3%", categories)).toBe("dairy");
    expect(guessCategoryId("חזה עוף", categories)).toBe("meat");
    expect(guessCategoryId("אבקת כביסה", categories)).toBe("cleaning");
    expect(guessCategoryId("פיתות", categories)).toBe("bakery");
    expect(guessCategoryId("משהו לא מוכר", categories)).toBeNull();
  });

  it("does not confuse look-alike words", () => {
    expect(guessProduct("דגני בוקר")?.kind).toBe("pantry");
    expect(guessProduct("תפוחי אדמה")?.emoji).toBe("🥔");
    expect(guessProduct("שמנת מתוקה")?.kind).toBe("dairy");
  });

  it("falls back to the category picture", () => {
    expect(productEmoji("משהו", { name: "קפואים", icon: "snowflake" })).toBe("🧊");
    expect(productEmoji("בננות", null)).toBe("🍌");
  });
});
