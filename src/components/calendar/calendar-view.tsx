"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { toast } from "sonner";
import { deleteEvent, saveEvent } from "@/server/actions/admin";
import type { EventCategory, HouseholdEvent } from "@/lib/types";
import { EVENT_CATEGORY } from "@/lib/labels";
import { addDays, todayInZone } from "@/lib/format";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Segmented, Select, Textarea } from "@/components/ui/field";
import { AddButton, Panel } from "@/components/ui/panel";

export interface CalendarItem {
  id: string;
  kind: "event" | "chore" | "bill";
  title: string;
  date: string; // YYYY-MM-DD (household timezone)
  time: string | null; // HH:MM
  category: string;
  href: string | null;
  location?: string | null;
  assignee?: string | null;
  event?: HouseholdEvent;
}

const TZ = "Asia/Jerusalem";
const DAY = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const dayName = (iso: string) => new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export function CalendarView({ householdId, items, members, monthStart, googleConnected }: { householdId: string; items: CalendarItem[]; members: { id: string; name: string }[]; monthStart: string; googleConnected: boolean }) {
  useRealtimeRefresh("household_events", householdId);
  const today = todayInZone(new Date(), TZ);
  const [view, setView] = useState<"agenda" | "week" | "month">("agenda");
  const [sheet, setSheet] = useState<{ event: HouseholdEvent | null; date: string } | null>(null);
  useOpenFromQuery(() => setSheet({ event: null, date: today }));

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const i of items) m.set(i.date, [...(m.get(i.date) ?? []), i]);
    for (const list of m.values()) list.sort((a, b) => (a.time ?? "00").localeCompare(b.time ?? "00"));
    return m;
  }, [items]);

  const agendaDays = [...byDate.keys()].filter((d) => d >= today).sort().slice(0, 30);
  const weekStart = addDays(today, -new Date(`${today}T00:00:00Z`).getUTCDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const first = new Date(`${monthStart}T00:00:00Z`);
  const gridStart = addDays(monthStart, -first.getUTCDay());
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const monthLabel = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const shiftMonth = (n: number) => {
    const d = new Date(first);
    d.setUTCMonth(d.getUTCMonth() + n);
    return d.toISOString().slice(0, 7);
  };

  function Item({ i }: { i: CalendarItem }) {
    const c = EVENT_CATEGORY[i.category] ?? (i.kind === "chore" ? { emoji: "🧹", hue: 185, label: "משימה" } : i.kind === "bill" ? { emoji: "🧾", hue: 300, label: "חשבון" } : EVENT_CATEGORY.other);
    const body = (
      <>
        <span aria-hidden className="cat-tint grid size-10 shrink-0 place-items-center rounded-[12px] text-[19px]" style={{ "--h": c.hue } as React.CSSProperties}>
          {c.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{i.title}</span>
          <span className="footnote flex flex-wrap gap-x-2 text-muted">
            <span>{i.time ?? "כל היום"}</span>
            {i.assignee && <span>· {i.assignee}</span>}
            {i.location && (
              <span className="flex items-center gap-0.5">
                · <MapPin className="size-3" /> {i.location}
              </span>
            )}
          </span>
        </span>
        {i.kind !== "event" && <Badge>{i.kind === "chore" ? "משימה" : "תשלום"}</Badge>}
      </>
    );
    if (i.kind === "event")
      return (
        <button type="button" onClick={() => setSheet({ event: i.event!, date: i.date })} className="flex w-full items-center gap-3 px-4 py-3 text-start active:bg-fill">
          {body}
        </button>
      );
    return (
      <Link href={i.href ?? "#"} className="flex items-center gap-3 px-4 py-3 active:bg-fill">
        {body}
      </Link>
    );
  }

  return (
    <>
      <PageHeader title="יומן הבית" back={{ href: "/household", label: "משק הבית" }} subtitle={googleConnected ? "מסונכרן עם Google Calendar" : "טכנאים, משלוחים, אורחים ותשלומים"} actions={<AddButton onClick={() => setSheet({ event: null, date: today })} label="אירוע" />} />
      <Segmented
        className="mb-4"
        label="תצוגה"
        value={view}
        onChange={setView}
        options={[
          { value: "agenda", label: "רשימה" },
          { value: "week", label: "שבוע" },
          { value: "month", label: "חודש" },
        ]}
      />

      {view === "agenda" &&
        (agendaDays.length ? (
          <div className="space-y-4">
            {agendaDays.map((d) => (
              <section key={d}>
                <h2 className={cn("mb-1.5 px-1 text-[14px] font-semibold", d === today ? "text-primary" : "text-muted")}>{d === today ? `היום · ${dayName(d)}` : dayName(d)}</h2>
                <Panel>
                  {byDate.get(d)!.map((i) => (
                    <Item key={`${i.kind}:${i.id}`} i={i} />
                  ))}
                </Panel>
              </section>
            ))}
          </div>
        ) : (
          <p className="rounded-[var(--radius)] border border-dashed border-border p-6 text-center text-[15px] text-muted">אין אירועים קרובים. הוסיפו טכנאי, משלוח או אורחים.</p>
        ))}

      {view === "week" && (
        <div className="space-y-3">
          {weekDays.map((d, idx) => (
            <section key={d} className={cn("overflow-hidden rounded-[var(--radius)] border bg-surface", d === today ? "border-primary" : "border-border")}>
              <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2">
                <span className="text-[15px] font-semibold">
                  יום {DAY[idx]} <span className="num font-normal text-muted">{d.slice(8)}/{d.slice(5, 7)}</span>
                </span>
                <button type="button" onClick={() => setSheet({ event: null, date: d })} className="text-[20px] leading-none text-primary" aria-label="הוספת אירוע">
                  +
                </button>
              </div>
              <div className="[&>*+*]:border-t [&>*+*]:border-border">{(byDate.get(d) ?? []).map((i) => <Item key={`${i.kind}:${i.id}`} i={i} />)}</div>
              {!byDate.get(d)?.length && <p className="px-4 py-2.5 text-[13px] text-muted">פנוי</p>}
            </section>
          ))}
        </div>
      )}

      {view === "month" && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <Link href={`/calendar?month=${shiftMonth(-1)}`} className="grid size-9 place-items-center rounded-full bg-fill" aria-label="חודש קודם">
              <ChevronRight className="size-5" />
            </Link>
            <span className="headline">{monthLabel}</span>
            <Link href={`/calendar?month=${shiftMonth(1)}`} className="grid size-9 place-items-center rounded-full bg-fill" aria-label="חודש הבא">
              <ChevronLeft className="size-5" />
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[12px] text-muted">
            {DAY.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthDays.map((d) => {
              const list = byDate.get(d) ?? [];
              const inMonth = d.slice(0, 7) === monthStart.slice(0, 7);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSheet({ event: null, date: d })}
                  className={cn("flex aspect-square flex-col items-center justify-start rounded-xl border p-1 text-[13px]", d === today ? "border-primary bg-primary-soft" : "border-border bg-surface", !inMonth && "opacity-40")}
                  aria-label={`${d}${list.length ? `, ${list.length} פריטים` : ""}`}
                >
                  <span className="num">{Number(d.slice(8))}</span>
                  <span className="mt-auto flex flex-wrap justify-center gap-0.5">
                    {list.slice(0, 3).map((i) => (
                      <span key={`${i.kind}:${i.id}`} className={cn("size-1.5 rounded-full", i.kind === "event" ? "bg-primary" : "bg-muted-2")} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="footnote mt-2 text-center text-muted">נקודה ירוקה: אירוע · אפורה: משימה או תשלום. לחיצה על יום מוסיפה אירוע.</p>
        </section>
      )}

      <EventSheet state={sheet} onClose={() => setSheet(null)} members={members} />
    </>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** Interpret a wall-clock time as Israel time, regardless of the device timezone (handles DST). */
function israelToIso(local: string): string {
  const guess = new Date(`${local}:00Z`);
  const shown = new Date(toLocalInput(guess.toISOString()) + ":00Z");
  return new Date(guess.getTime() - (shown.getTime() - guess.getTime())).toISOString();
}

function EventSheet({ state, onClose, members }: { state: { event: HouseholdEvent | null; date: string } | null; onClose: () => void; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const ev = state?.event ?? null;
  const [seen, setSeen] = useState<typeof state>(null);
  const [f, setF] = useState({ title: "", category: "other" as EventCategory, start: "", end: "", allDay: false, location: "", assignee: "", remind: "60", description: "" });
  if (state !== seen) {
    setSeen(state);
    if (state)
      setF(
        ev
          ? { title: ev.title, category: ev.category, start: toLocalInput(ev.starts_at), end: ev.ends_at ? toLocalInput(ev.ends_at) : "", allDay: ev.all_day, location: ev.location ?? "", assignee: ev.assignee_id ?? "", remind: ev.remind_minutes != null ? String(ev.remind_minutes) : "", description: ev.description ?? "" }
          : { title: "", category: "other", start: `${state.date}T10:00`, end: "", allDay: false, location: "", assignee: "", remind: "60", description: "" },
      );
  }
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const startLocal = f.allDay ? `${f.start.slice(0, 10)}T00:00` : f.start;
    const res = await saveEvent(ev?.id ?? null, {
      title: f.title,
      category: f.category,
      starts_at: israelToIso(startLocal),
      ends_at: f.end && !f.allDay ? israelToIso(f.end) : null,
      all_day: f.allDay,
      location: f.location,
      assignee_id: f.assignee,
      remind_minutes: f.remind,
      description: f.description,
      linked_entity_type: ev?.linked_entity_type as never ?? null,
      linked_entity_id: ev?.linked_entity_id ?? null,
    });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    onClose();
    router.refresh();
  }

  return (
    <Sheet
      open={!!state}
      onOpenChange={(o) => !o && onClose()}
      title={ev ? "אירוע" : "אירוע חדש"}
      footer={
        <div className="flex gap-2">
          {ev && (
            <Button
              variant="danger-ghost"
              onClick={async () => {
                const r = await deleteEvent(ev.id);
                if (!r.ok) return void toast.error(r.error);
                onClose();
                router.refresh();
              }}
            >
              מחיקה
            </Button>
          )}
          <Button size="lg" className="flex-1" onClick={save} loading={saving} disabled={!f.title.trim()}>
            שמירה
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="מה" htmlFor="ev-title">
          <Input id="ev-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="טכנאי מזגנים, משלוח ספה…" />
        </Field>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
          {Object.entries(EVENT_CATEGORY).map(([k, v]) => (
            <button key={k} type="button" onClick={() => setF({ ...f, category: k as EventCategory })} aria-pressed={f.category === k} className={cn("h-9 shrink-0 rounded-full border px-3 text-[14px]", f.category === k ? "border-transparent bg-foreground text-background" : "border-border bg-surface")}>
              {v.emoji} {v.label}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
          כל היום
          <input type="checkbox" checked={f.allDay} onChange={(e) => setF({ ...f, allDay: e.target.checked })} className="size-5 accent-[var(--primary)]" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="מתי" htmlFor="ev-start">
            {f.allDay ? (
              <Input id="ev-start" type="date" value={f.start.slice(0, 10)} onChange={(e) => setF({ ...f, start: `${e.target.value}T00:00` })} />
            ) : (
              <Input id="ev-start" type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
            )}
          </Field>
          {!f.allDay && (
            <Field label="עד" htmlFor="ev-end">
              <Input id="ev-end" type="datetime-local" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
            </Field>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="מי" htmlFor="ev-who">
            <Select id="ev-who" value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>
              <option value="">שנינו</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="תזכורת" htmlFor="ev-remind">
            <Select id="ev-remind" value={f.remind} onChange={(e) => setF({ ...f, remind: e.target.value })}>
              <option value="">בלי</option>
              <option value="30">חצי שעה לפני</option>
              <option value="60">שעה לפני</option>
              <option value="1440">יום לפני</option>
            </Select>
          </Field>
        </div>
        <Field label="איפה" htmlFor="ev-loc">
          <Input id="ev-loc" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
        </Field>
        <Field label="פרטים" htmlFor="ev-desc">
          <Textarea id="ev-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="min-h-16" />
        </Field>
      </div>
    </Sheet>
  );
}
