/**
 * Utility bill analysis. Deterministic, so the numbers on screen are exactly
 * reproducible from the bills themselves:
 * - Compare per day, never raw totals, so a 70-day period is not "more
 *   expensive" than a 56-day one just because it is longer.
 * - Prefer the same period last year (seasonality); fall back to the previous bill.
 * - Split a change into consumption (usage per day), unit price and fixed
 *   charges when those figures exist; otherwise say the reason is unknown.
 */

export interface BillLike {
  id: string;
  category: string;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  consumption: number | null;
  fixed_charges: number | null;
  verified?: boolean;
}

export function periodDays(b: Pick<BillLike, "period_start" | "period_end">): number | null {
  if (!b.period_start || !b.period_end) return null;
  return Math.round((Date.parse(`${b.period_end}T00:00:00Z`) - Date.parse(`${b.period_start}T00:00:00Z`)) / 86_400_000) + 1;
}

export interface BillComparison {
  against: BillLike;
  basis: "last_year" | "previous";
  /** Relative change in cost per day (0.2 = +20%). */
  costPerDayChange: number;
  /** Relative change in consumption per day, when both have consumption. */
  usagePerDayChange: number | null;
  /** Relative change in the variable unit price (amount − fixed) / consumption. */
  unitPriceChange: number | null;
  fixedChargesDelta: number | null;
  periodDays: { current: number; other: number };
  verdict: "higher" | "lower" | "similar";
  /** Main driver of the change, when it can be determined. */
  driver: "usage" | "price" | "fixed" | "unknown" | null;
}

const rel = (a: number, b: number) => (b === 0 ? 0 : (a - b) / b);

export function compareBill(current: BillLike, history: BillLike[]): BillComparison | null {
  const days = periodDays(current);
  if (!days) return null;
  const peers = history
    .filter((b) => b.id !== current.id && b.category === current.category && periodDays(b) && b.period_end! < current.period_end!)
    .sort((a, b) => b.period_end!.localeCompare(a.period_end!));
  if (!peers.length) return null;

  // Same season last year: a bill whose midpoint is 300–430 days earlier.
  const mid = (b: BillLike) => (Date.parse(b.period_start!) + Date.parse(b.period_end!)) / 2;
  const lastYear = peers.find((b) => {
    const gap = (mid(current) - mid(b)) / 86_400_000;
    return gap >= 300 && gap <= 430;
  });
  const other = lastYear ?? peers[0];
  const otherDays = periodDays(other)!;

  const costPerDayChange = rel(current.amount / days, other.amount / otherDays);
  const usagePerDayChange =
    current.consumption != null && other.consumption != null && other.consumption > 0 ? rel(current.consumption / days, other.consumption / otherDays) : null;
  const variable = (b: BillLike) => b.amount - (b.fixed_charges ?? 0);
  const unitPriceChange =
    current.consumption && other.consumption && current.consumption > 0 && other.consumption > 0
      ? rel(variable(current) / current.consumption, variable(other) / other.consumption)
      : null;
  const fixedChargesDelta = current.fixed_charges != null && other.fixed_charges != null ? current.fixed_charges - other.fixed_charges : null;

  const verdict = costPerDayChange > 0.1 ? "higher" : costPerDayChange < -0.1 ? "lower" : "similar";
  let driver: BillComparison["driver"] = null;
  if (verdict !== "similar") {
    const candidates: [BillComparison["driver"], number][] = [];
    if (usagePerDayChange != null) candidates.push(["usage", Math.abs(usagePerDayChange)]);
    if (unitPriceChange != null) candidates.push(["price", Math.abs(unitPriceChange)]);
    if (fixedChargesDelta != null && current.amount > 0) candidates.push(["fixed", Math.abs(fixedChargesDelta) / current.amount]);
    driver = candidates.length ? candidates.sort((a, b) => b[1] - a[1])[0][0] : "unknown";
  }
  return {
    against: other,
    basis: lastYear ? "last_year" : "previous",
    costPerDayChange,
    usagePerDayChange,
    unitPriceChange,
    fixedChargesDelta,
    periodDays: { current: days, other: otherDays },
    verdict,
    driver,
  };
}

const pct = (n: number) => `${Math.round(Math.abs(n) * 100)}%`;

/** Plain Hebrew explanation of a comparison (no advice, just what changed). */
export function explainComparison(c: BillComparison, categoryLabel: string): string {
  const basis = c.basis === "last_year" ? "לאותה תקופה בשנה שעברה" : "לחשבון הקודם";
  if (c.verdict === "similar") return `העלות ליום דומה ${basis}.`;
  const dir = c.verdict === "higher" ? "גבוהה" : "נמוכה";
  const parts = [`העלות ליום ${dir} ב-${pct(c.costPerDayChange)} ביחס ${basis}.`];
  if (c.periodDays.current !== c.periodDays.other) parts.push(`ההשוואה לפי יום, כי התקופות באורך שונה (${c.periodDays.current} מול ${c.periodDays.other} ימים).`);
  if (c.driver === "usage" && c.usagePerDayChange != null)
    parts.push(`הסיבה העיקרית: צריכת ה${categoryLabel} ליום ${c.usagePerDayChange > 0 ? "עלתה" : "ירדה"} ב-${pct(c.usagePerDayChange)}.`);
  else if (c.driver === "price" && c.unitPriceChange != null)
    parts.push(`הסיבה העיקרית: המחיר ליחידה ${c.unitPriceChange > 0 ? "עלה" : "ירד"} ב-${pct(c.unitPriceChange)}, לא הצריכה.`);
  else if (c.driver === "fixed" && c.fixedChargesDelta != null)
    parts.push(`הסיבה העיקרית: חיובים קבועים או חד פעמיים (${c.fixedChargesDelta > 0 ? "+" : "−"}₪${Math.abs(Math.round(c.fixedChargesDelta))}).`);
  else parts.push("אין בחשבון נתוני צריכה, ולכן אי אפשר לדעת אם השינוי נובע מצריכה או ממחיר.");
  return parts.join(" ");
}

/** Monthly totals (by period end month) for charts and year-to-date sums. */
export function monthlyTotals(bills: Pick<BillLike, "period_end" | "amount" | "category">[], months: string[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const m of months) out[m] = {};
  for (const b of bills) {
    if (!b.period_end) continue;
    const m = b.period_end.slice(0, 7);
    if (!out[m]) continue;
    out[m][b.category] = (out[m][b.category] ?? 0) + Number(b.amount);
  }
  return out;
}
