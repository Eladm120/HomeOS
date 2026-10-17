import { describe, expect, it } from "vitest";
import { daysUntil, formatQuantity, greetingFor, joinHebrewNames, relativeDays, todayInZone } from "@/lib/format";

describe("greetingFor", () => {
  // 2026-01-15 is winter time in Israel (UTC+2)
  it("says good morning at 08:00 Jerusalem time", () => {
    expect(greetingFor(new Date("2026-01-15T06:00:00Z"))).toBe("בוקר טוב");
  });
  it("says good evening at 19:00 Jerusalem time", () => {
    expect(greetingFor(new Date("2026-01-15T17:00:00Z"))).toBe("ערב טוב");
  });
  it("respects daylight saving (UTC+3 in summer)", () => {
    // 04:30 UTC in July = 07:30 in Jerusalem → morning
    expect(greetingFor(new Date("2026-07-15T04:30:00Z"))).toBe("בוקר טוב");
    // same UTC time in January = 06:30 → still morning; 02:30 UTC = 04:30 → night
    expect(greetingFor(new Date("2026-01-15T02:30:00Z"))).toBe("לילה טוב");
  });
});

describe("joinHebrewNames", () => {
  it("joins two names with ו", () => {
    expect(joinHebrewNames(["אלעד", "נעה"])).toBe("אלעד ונעה");
  });
  it("joins three names", () => {
    expect(joinHebrewNames(["א", "ב", "ג"])).toBe("א, ב וג");
  });
  it("handles one and empty names", () => {
    expect(joinHebrewNames(["נעה", " "])).toBe("נעה");
    expect(joinHebrewNames([])).toBe("");
  });
});

describe("dates", () => {
  it("computes today in the household timezone, not UTC", () => {
    // 23:30 UTC on Jan 14 is already Jan 15 in Jerusalem
    expect(todayInZone(new Date("2026-01-14T23:30:00Z"))).toBe("2026-01-15");
  });
  it("counts whole days until a date", () => {
    const now = new Date("2026-01-15T10:00:00Z");
    expect(daysUntil("2026-01-15", now)).toBe(0);
    expect(daysUntil("2026-01-18", now)).toBe(3);
    expect(daysUntil("2026-01-13", now)).toBe(-2);
  });
  it("renders relative days in Hebrew", () => {
    expect(relativeDays(0)).toBe("היום");
    expect(relativeDays(1)).toBe("מחר");
    expect(relativeDays(5)).toBe("בעוד 5 ימים");
    expect(relativeDays(-3)).toBe("לפני 3 ימים");
  });
});

describe("formatQuantity", () => {
  it("drops trailing zeros and keeps decimals", () => {
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity("1.500")).toBe("1.5");
    expect(formatQuantity(0.25)).toBe("0.25");
  });
});
