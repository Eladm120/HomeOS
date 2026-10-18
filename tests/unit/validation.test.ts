import { describe, expect, it } from "vitest";
import { movementSchema, parseBulkLine, parseBulkText, shoppingItemSchema } from "@/lib/validation";
import { escapeLike, safeNextPath } from "@/lib/utils";

describe("parseBulkLine", () => {
  it.each([
    ["חלב 2 ליטר", { name: "חלב", quantity: 2, unit: "ליטר" }],
    ["3 עגבניות", { name: "עגבניות", quantity: 3, unit: "יח׳" }],
    ["ביצים x12", { name: "ביצים", quantity: 12, unit: "יח׳" }],
    ["אורז, 2, ק\"ג", { name: "אורז", quantity: 2, unit: "ק״ג" }],
    ["גבינה צהובה", { name: "גבינה צהובה", quantity: 1, unit: "יח׳" }],
    ["- נייר טואלט 2 חבילות", { name: "נייר טואלט", quantity: 2, unit: "חבילה" }],
    ["1. קמח 1 קילו", { name: "קמח", quantity: 1, unit: "ק״ג" }],
    ["שמן זית 0.5 ליטר", { name: "שמן זית", quantity: 0.5, unit: "ליטר" }],
  ])("parses %s", (input, expected) => {
    expect(parseBulkLine(input)).toEqual(expected);
  });

  it("ignores blank lines", () => {
    expect(parseBulkText("חלב\n\n  \nלחם")).toHaveLength(2);
  });
});

describe("shoppingItemSchema", () => {
  it("applies defaults and normalizes empty optionals to null", () => {
    const r = shoppingItemSchema.parse({ name: "  חלב  ", brand: "", category_id: "" });
    expect(r).toMatchObject({ name: "חלב", quantity: 1, unit: "יח׳", brand: null, category_id: null, priority: "normal" });
  });
  it("rejects empty names and non-positive quantities", () => {
    expect(shoppingItemSchema.safeParse({ name: " " }).success).toBe(false);
    expect(shoppingItemSchema.safeParse({ name: "חלב", quantity: 0 }).success).toBe(false);
  });
  it("rejects storage paths outside the household folder pattern", () => {
    expect(shoppingItemSchema.safeParse({ name: "x", image_path: "../../etc/passwd" }).success).toBe(false);
    expect(
      shoppingItemSchema.safeParse({ name: "x", image_path: "0b6c1d0e-3d2a-4b9e-9a1a-2b3c4d5e6f70/grocery/a.webp" }).success,
    ).toBe(true);
  });
});

describe("movementSchema", () => {
  const id = "0b6c1d0e-3d2a-4b9e-9a1a-2b3c4d5e6f70";
  it("requires a target location for transfers", () => {
    expect(movementSchema.safeParse({ item_id: id, kind: "transfer" }).success).toBe(false);
  });
  it("requires a positive quantity for consume", () => {
    expect(movementSchema.safeParse({ item_id: id, kind: "consume", quantity: 0 }).success).toBe(false);
    expect(movementSchema.safeParse({ item_id: id, kind: "consume", quantity: 1 }).success).toBe(true);
  });
  it("allows a zero count for corrections (item is used up)", () => {
    expect(movementSchema.safeParse({ item_id: id, kind: "correct", quantity: 0 }).success).toBe(true);
  });
});

describe("security helpers", () => {
  it("only allows same-origin relative redirects", () => {
    expect(safeNextPath("/shopping")).toBe("/shopping");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
  it("escapes LIKE wildcards", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("orFilterTerm", () => {
  it("removes PostgREST filter syntax and escapes wildcards", async () => {
    const { orFilterTerm } = await import("@/lib/utils");
    expect(orFilterTerm("חלב,id.eq.1)")).toBe("חלב id.eq.1");
    expect(orFilterTerm("50%_off")).toBe(escapeLike("50%_off"));
    expect(orFilterTerm("50%_off")).not.toContain("%_");
  });
});
