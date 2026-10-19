import { describe, expect, it } from "vitest";
import { buildCatalog, sortCatalog, type HistoryRow } from "@/lib/catalog";

const h = (name: string, extra: Partial<HistoryRow> = {}): HistoryRow => ({
  name,
  brand: null,
  unit: "יח׳",
  quantity: 1,
  category_id: null,
  image_path: null,
  catalog_product_id: null,
  status: "purchased",
  cleared_at: "2026-10-01T00:00:00Z",
  created_at: "2026-10-01T00:00:00Z",
  ...extra,
});

describe("buildCatalog", () => {
  it("merges catalog rows with history by id or by name, and counts purchases", () => {
    const entries = buildCatalog({
      catalog: [{ id: "c1", name: "חלב", brand: null, default_unit: "ליטר", category_id: "dairy", image_path: null, created_at: "2026-01-01" }],
      history: [
        h("חלב", { catalog_product_id: "c1" }),
        h("חָלָב", { created_at: "2026-10-05T00:00:00Z" }),
        h("לחם"),
        h("חלב", { status: "pending", cleared_at: null, quantity: 2, created_at: "2026-10-10T00:00:00Z" }),
      ],
      lowNames: ["לחם"],
    });
    const milk = entries.find((e) => e.catalogId === "c1")!;
    expect(milk.timesBought).toBe(2);
    expect(milk.onList).toBe(2);
    expect(milk.lastAt).toBe("2026-10-05T00:00:00Z");
    const bread = entries.find((e) => e.name === "לחם")!;
    expect(bread.catalogId).toBeNull();
    expect(bread.low).toBe(true);
    expect(entries).toHaveLength(2);
  });

  it("keeps products with different brands apart", () => {
    const entries = buildCatalog({ catalog: [], history: [h("קפה", { brand: "עלית" }), h("קפה", { brand: "לנדוור" })] });
    expect(entries).toHaveLength(2);
  });

  it("sorts by popularity, recency, or shows only what is running out", () => {
    const entries = buildCatalog({
      catalog: [],
      history: [h("א", { created_at: "2026-10-01" }), h("ב", { created_at: "2026-10-09" }), h("א", { created_at: "2026-10-02" })],
      lowNames: ["ב"],
    });
    expect(sortCatalog(entries, "popular").map((e) => e.name)).toEqual(["א", "ב"]);
    expect(sortCatalog(entries, "recent").map((e) => e.name)).toEqual(["ב", "א"]);
    expect(sortCatalog(entries, "missing").map((e) => e.name)).toEqual(["ב"]);
  });
});
