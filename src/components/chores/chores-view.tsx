"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import { toast } from "sonner";
import { completeChore } from "@/server/actions/chores";
import type { Chore, Room } from "@/lib/types";
import { frequencyText } from "@/lib/labels";
import { daysUntil, formatShortDate, relativeDays } from "@/lib/format";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, EmptyState } from "@/components/ui/card";
import { AddButton, FilterPills, Panel, PanelHeading } from "@/components/ui/panel";
import { CheckCircle } from "@/components/grocery/item-row";
import Link from "next/link";
import { ChoreSheet } from "./chore-sheet";

type Who = "all" | "mine" | "shared";

export function dueBadge(dateIso: string): { text: string; tone: "danger" | "amber" | "neutral" | "primary" } {
  const d = daysUntil(dateIso);
  if (d < 0) return { text: `באיחור · ${relativeDays(d)}`, tone: "danger" };
  if (d === 0) return { text: "היום", tone: "amber" };
  if (d === 1) return { text: "מחר", tone: "primary" };
  return { text: d < 7 ? relativeDays(d) : formatShortDate(dateIso), tone: "neutral" };
}

export function ChoresView({
  householdId,
  chores,
  rooms,
  members,
  currentUserId,
}: {
  householdId: string;
  chores: Chore[];
  rooms: Room[];
  members: { id: string; name: string }[];
  currentUserId: string;
}) {
  useRealtimeRefresh("chores", householdId);
  const router = useRouter();
  const [who, setWho] = useState<Who>("all");
  const [sheet, setSheet] = useState(false);
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  useOpenFromQuery(() => setSheet(true));

  const active = chores.filter((c) => c.status === "active");
  const paused = chores.filter((c) => c.status === "paused");
  const visible = active.filter((c) => (who === "all" ? true : who === "mine" ? c.assignee_id === currentUserId : !c.assignee_id));

  const groups = useMemo(() => {
    const g: { key: string; title: string; items: Chore[] }[] = [
      { key: "late", title: "באיחור", items: [] },
      { key: "today", title: "היום", items: [] },
      { key: "week", title: "השבוע", items: [] },
      { key: "later", title: "בהמשך", items: [] },
    ];
    for (const c of [...visible].sort((a, b) => a.next_due_on.localeCompare(b.next_due_on))) {
      const d = daysUntil(c.next_due_on);
      g[d < 0 ? 0 : d === 0 ? 1 : d <= 7 ? 2 : 3].items.push(c);
    }
    return g.filter((x) => x.items.length);
  }, [visible]);

  const nameOf = (id: string | null) => (id ? members.find((m) => m.id === id)?.name : "משותף");
  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name;

  async function complete(c: Chore) {
    setCompleting((s) => new Set(s).add(c.id));
    const res = await completeChore(c.id);
    if (!res.ok) {
      setCompleting((s) => {
        const n = new Set(s);
        n.delete(c.id);
        return n;
      });
      return void toast.error(res.error);
    }
    toast.success(res.data.status === "archived" ? `${c.title} — בוצע ✓` : `${c.title} ✓ · הפעם הבאה ${formatShortDate(res.data.next_due_on)}`);
    router.refresh();
    setTimeout(
      () =>
        setCompleting((s) => {
          const n = new Set(s);
          n.delete(c.id);
          return n;
        }),
      600,
    );
  }

  const lateCount = active.filter((c) => daysUntil(c.next_due_on) < 0).length;
  const todayCount = active.filter((c) => daysUntil(c.next_due_on) === 0).length;

  return (
    <>
      <PageHeader
        title="משימות בית"
        back={{ href: "/household", label: "משק הבית" }}
        subtitle={lateCount || todayCount ? [todayCount ? `${todayCount} להיום` : null, lateCount ? `${lateCount} באיחור` : null].filter(Boolean).join(" · ") : "מטלות חוזרות, בלי לזכור בעל פה"}
        actions={<AddButton onClick={() => setSheet(true)} label="משימה" />}
      />

      {members.length > 1 && (
        <FilterPills
          className="mb-4"
          label="של מי"
          value={who}
          onChange={setWho}
          options={[
            { value: "all", label: "הכל", count: active.length },
            { value: "mine", label: "שלי", count: active.filter((c) => c.assignee_id === currentUserId).length },
            { value: "shared", label: "משותף", count: active.filter((c) => !c.assignee_id).length },
          ]}
        />
      )}

      {active.length === 0 && paused.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="אין עדיין משימות" description="הוסיפו מטלות חוזרות כמו החלפת מצעים או ניקוי מסנן מזגן. HomeOS יזכיר ויתזמן את הפעם הבאה." />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.key}>
              <PanelHeading title={<span className={g.key === "late" ? "text-danger" : undefined}>{g.title}</span>} count={g.items.length} />
              <Panel>
                {g.items.map((c) => {
                  const done = completing.has(c.id);
                  const badge = dueBadge(c.next_due_on);
                  return (
                    <div key={c.id} className="flex min-h-[64px] items-center gap-3 px-4 py-2.5">
                      <CheckCircle checked={done} onToggle={() => !done && complete(c)} label={`סימון ${c.title} כבוצע`} />
                      <Link href={`/chores/${c.id}`} className="min-w-0 flex-1 active:opacity-60">
                        <span className={cn("block truncate text-[16px] font-medium", done && "text-muted line-through")}>{c.title}</span>
                        <span className="footnote block truncate text-muted">{[nameOf(c.assignee_id), frequencyText(c.frequency, c.interval_days), roomName(c.room_id)].filter(Boolean).join(" · ")}</span>
                      </Link>
                      <Badge tone={c.priority === "high" && badge.tone !== "danger" ? "danger" : badge.tone}>{badge.text}</Badge>
                    </div>
                  );
                })}
              </Panel>
            </section>
          ))}
          {visible.length === 0 && active.length > 0 && <p className="text-center text-[15px] text-muted">אין משימות בסינון הזה.</p>}
          {paused.length > 0 && (
            <section>
              <PanelHeading title="מושהות" count={paused.length} />
              <Panel>
                {paused.map((c) => (
                  <Link key={c.id} href={`/chores/${c.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 text-muted active:bg-fill">
                    <span className="truncate">{c.title}</span>
                    <span className="footnote">{frequencyText(c.frequency, c.interval_days)}</span>
                  </Link>
                ))}
              </Panel>
            </section>
          )}
        </div>
      )}

      <ChoreSheet open={sheet} onOpenChange={setSheet} chore={null} rooms={rooms} members={members} />
    </>
  );
}
