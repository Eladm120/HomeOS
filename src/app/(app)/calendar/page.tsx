import { CalendarView, type CalendarItem } from "@/components/calendar/calendar-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import { BILL_CATEGORY } from "@/lib/labels";
import { addDays, todayInZone } from "@/lib/format";
import type { HouseholdEvent } from "@/lib/types";
import { requireHousehold } from "@/server/context";
import { memberOptions } from "@/server/household-data";

export const metadata = { title: "יומן הבית" };

function localParts(iso: string, tz: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const tz = ctx.household.timezone;
  const today = todayInZone(new Date(), tz);
  const monthStart = month && /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : `${today.slice(0, 7)}-01`;
  const from = addDays(monthStart < today ? monthStart : today, -7);
  const to = addDays(monthStart > today ? monthStart : today, 70);
  const members = memberOptions(ctx);
  const name = (id: string | null) => (id ? members.find((m) => m.id === id)?.name ?? null : null);

  const [{ data: events }, { data: chores }, { data: bills }, { data: google }] = await Promise.all([
    supabase.from("household_events").select("*").eq("household_id", hid).gte("starts_at", `${from}T00:00:00Z`).lte("starts_at", `${to}T23:59:59Z`).order("starts_at"),
    supabase.from("chores").select("id, title, next_due_on, assignee_id").eq("household_id", hid).eq("status", "active").gte("next_due_on", from).lte("next_due_on", to),
    supabase.from("utility_bills").select("id, category, provider_name, due_on, amount").eq("household_id", hid).eq("payment_status", "unpaid").gte("due_on", from).lte("due_on", to),
    supabase.from("integration_connections").select("id").eq("household_id", hid).eq("provider", "google_calendar").eq("status", "connected").maybeSingle(),
  ]);

  const items: CalendarItem[] = [
    ...((events ?? []) as HouseholdEvent[]).map((e) => {
      const lp = localParts(e.starts_at, tz);
      return { id: e.id, kind: "event" as const, title: e.title, date: lp.date, time: e.all_day ? null : lp.time, category: e.category, href: null, location: e.location, assignee: name(e.assignee_id), event: e };
    }),
    ...(chores ?? []).map((c) => ({ id: c.id as string, kind: "chore" as const, title: c.title as string, date: c.next_due_on as string, time: null, category: "chore", href: `/chores/${c.id}`, assignee: name(c.assignee_id as string | null) ?? "משותף" })),
    ...(bills ?? []).map((b) => ({ id: b.id as string, kind: "bill" as const, title: `${b.provider_name ?? BILL_CATEGORY[b.category as string]?.label ?? "חשבון"} · ₪${Number(b.amount)}`, date: b.due_on as string, time: null, category: "bill", href: `/bills/${b.id}` })),
  ];
  return <CalendarView householdId={hid} items={items} members={members} monthStart={monthStart} googleConnected={!!google} />;
}
