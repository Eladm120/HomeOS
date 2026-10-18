import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { compareBill, explainComparison } from "@/lib/bills";
import { BILL_CATEGORY } from "@/lib/labels";
import { todayInZone } from "@/lib/format";
import type { UtilityBill } from "@/lib/types";

export function lastMonths(today: string, n: number): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

/** Bills plus the derived figures for the bills screen and the expense overview. */
export async function loadBillsOverview(supabase: SupabaseClient, householdId: string, tz: string) {
  const { data } = await supabase.from("utility_bills").select("*").eq("household_id", householdId).order("period_end", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(500);
  const bills = (data ?? []) as UtilityBill[];
  const today = todayInZone(new Date(), tz);
  const months = lastMonths(today, 12);
  // A bill counts in the month its period ends (or it was issued/created).
  const monthOf = (b: UtilityBill) => (b.period_end ?? b.issue_date ?? b.created_at).slice(0, 7);
  const monthly = months.map((month) => ({ month, total: bills.filter((b) => monthOf(b) === month).reduce((s, b) => s + Number(b.amount), 0) }));
  const year = today.slice(0, 4);
  const ytdBills = bills.filter((b) => monthOf(b).startsWith(year));
  const byCat = new Map<string, number>();
  for (const b of ytdBills) byCat.set(b.category, (byCat.get(b.category) ?? 0) + Number(b.amount));
  const insights = [...new Set(bills.map((b) => b.category))]
    .map((category) => {
      const latest = bills.find((b) => b.category === category && b.period_end);
      if (!latest) return null;
      const c = compareBill({ ...latest, amount: Number(latest.amount), consumption: latest.consumption != null ? Number(latest.consumption) : null, fixed_charges: latest.fixed_charges != null ? Number(latest.fixed_charges) : null }, bills.map((b) => ({ ...b, amount: Number(b.amount), consumption: b.consumption != null ? Number(b.consumption) : null, fixed_charges: b.fixed_charges != null ? Number(b.fixed_charges) : null })));
      return c ? { billId: latest.id, category, verdict: c.verdict, text: explainComparison(c, BILL_CATEGORY[category]?.label ?? "") } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  return {
    bills,
    monthly,
    thisMonth: monthly[monthly.length - 1].total,
    ytd: ytdBills.reduce((s, b) => s + Number(b.amount), 0),
    byCategory: [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([key, total]) => ({ key, total, label: BILL_CATEGORY[key]?.label ?? key, emoji: BILL_CATEGORY[key]?.emoji ?? "🧾" })),
    insights,
  };
}
