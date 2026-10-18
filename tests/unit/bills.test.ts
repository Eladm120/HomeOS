import { describe, expect, it } from "vitest";
import { compareBill, explainComparison, periodDays } from "@/lib/bills";

const bill = (id: string, start: string, end: string, amount: number, consumption: number | null = null, fixed: number | null = null) => ({
  id,
  category: "electricity",
  period_start: start,
  period_end: end,
  amount,
  consumption,
  fixed_charges: fixed,
});

describe("bill comparison", () => {
  it("compares per day so longer periods are not penalised", () => {
    expect(periodDays(bill("a", "2026-01-01", "2026-01-31", 0))).toBe(31);
    const prev = bill("p", "2026-03-01", "2026-04-29", 600); // 60 days, 10/day
    const cur = bill("c", "2026-05-01", "2026-07-09", 700); // 70 days, 10/day
    const c = compareBill(cur, [prev])!;
    expect(c.verdict).toBe("similar");
    expect(explainComparison(c, "חשמל")).toContain("דומה");
  });

  it("attributes a rise to usage when consumption per day went up", () => {
    const prev = bill("p", "2026-03-01", "2026-04-29", 600, 1000, 50);
    const cur = bill("c", "2026-05-01", "2026-06-29", 900, 1500, 50);
    const c = compareBill(cur, [prev])!;
    expect(c.verdict).toBe("higher");
    expect(c.driver).toBe("usage");
    expect(explainComparison(c, "חשמל")).toContain("צריכת החשמל ליום עלתה ב-50%");
  });

  it("attributes a rise to unit price when usage is flat", () => {
    const prev = bill("p", "2026-03-01", "2026-04-29", 600, 1000, 0);
    const cur = bill("c", "2026-05-01", "2026-06-29", 720, 1000, 0);
    const c = compareBill(cur, [prev])!;
    expect(c.driver).toBe("price");
    expect(explainComparison(c, "חשמל")).toContain("המחיר ליחידה עלה ב-20%");
  });

  it("prefers the same season last year over the previous bill", () => {
    const lastSummer = bill("y", "2025-07-01", "2025-08-29", 800);
    const spring = bill("s", "2026-05-01", "2026-06-29", 400);
    const summer = bill("c", "2026-07-01", "2026-08-29", 820);
    const c = compareBill(summer, [lastSummer, spring])!;
    expect(c.basis).toBe("last_year");
    expect(c.verdict).toBe("similar");
  });

  it("says when the cause is unknown", () => {
    const c = compareBill(bill("c", "2026-05-01", "2026-06-29", 900), [bill("p", "2026-03-01", "2026-04-29", 600)])!;
    expect(c.driver).toBe("unknown");
    expect(explainComparison(c, "מים")).toContain("אין בחשבון נתוני צריכה");
  });

  it("returns null without a comparable bill", () => {
    expect(compareBill(bill("c", "2026-05-01", "2026-06-29", 900), [])).toBeNull();
  });
});
