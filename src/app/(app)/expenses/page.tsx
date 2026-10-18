import { ExpensesView } from "@/components/bills/expenses-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import { BILL_CATEGORY, EXPENSE_CATEGORIES } from "@/lib/labels";
import { addDays, todayInZone } from "@/lib/format";
import type { HouseholdExpense, RecurringCharge } from "@/lib/types";
import { lastMonths, loadBillsOverview } from "@/server/bills-data";
import { requireHousehold } from "@/server/context";

export const metadata = { title: "הוצאות הבית" };

export default async function ExpensesPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const today = todayInZone(new Date(), ctx.household.timezone);
  const months = lastMonths(today, 12);
  const [bills, { data: expenses }, { data: recurring }] = await Promise.all([
    loadBillsOverview(supabase, hid, ctx.household.timezone),
    supabase.from("household_expenses").select("*").eq("household_id", hid).gte("spent_on", `${months[0]}-01`).order("spent_on", { ascending: false }),
    supabase.from("recurring_charges").select("*").eq("household_id", hid).order("title"),
  ]);
  const ex = (expenses ?? []) as HouseholdExpense[];
  const rc = (recurring ?? []) as RecurringCharge[];

  const monthly = bills.monthly.map((m) => ({ month: m.month, total: m.total + ex.filter((e) => e.spent_on.startsWith(m.month)).reduce((s, e) => s + Number(e.amount), 0) }));
  const year = today.slice(0, 4);
  const cats = new Map<string, number>();
  for (const b of bills.byCategory) cats.set(`bill:${b.key}`, b.total);
  for (const e of ex.filter((e) => e.spent_on.startsWith(year))) cats.set(e.category, (cats.get(e.category) ?? 0) + Number(e.amount));
  const byCategory = [...cats.entries()]
    .map(([key, total]) => {
      const bill = key.startsWith("bill:") ? BILL_CATEGORY[key.slice(5)] : null;
      const c = bill ?? EXPENSE_CATEGORIES[key] ?? EXPENSE_CATEGORIES.other;
      return { key, total, label: c.label, emoji: c.emoji };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const horizon = addDays(today, 30);
  const upcoming = [
    ...rc.filter((r) => r.active && r.next_due_on && r.next_due_on <= horizon).map((r) => ({ id: r.id, title: r.title, amount: Number(r.amount), due: r.next_due_on!, href: "/expenses" })),
    ...bills.bills.filter((b) => b.payment_status === "unpaid" && b.due_on && b.due_on <= horizon).map((b) => ({ id: b.id, title: b.provider_name ?? BILL_CATEGORY[b.category].label, amount: Number(b.amount), due: b.due_on!, href: `/bills/${b.id}` })),
  ].sort((a, b) => a.due.localeCompare(b.due));

  return (
    <ExpensesView
      monthly={monthly}
      thisMonth={monthly[monthly.length - 1].total}
      lastMonth={monthly[monthly.length - 2]?.total ?? 0}
      byCategory={byCategory}
      expenses={ex.slice(0, 30)}
      recurring={rc}
      upcoming={upcoming}
    />
  );
}
