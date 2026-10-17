"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { completeChore, deleteChore, rescheduleChore, setChoreStatus } from "@/server/actions/chores";
import type { Chore, ChoreCompletion, Room } from "@/lib/types";
import { PRIORITY_LABEL, frequencyText } from "@/lib/labels";
import { formatShortDate, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/field";
import { Panel, PanelHeading } from "@/components/ui/panel";
import { ChoreSheet } from "./chore-sheet";
import { dueBadge } from "./chores-view";

export function ChoreDetail({
  chore: c,
  history,
  rooms,
  members,
}: {
  chore: Chore;
  history: ChoreCompletion[];
  rooms: Room[];
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(c.next_due_on);
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name;
  const badge = dueBadge(c.next_due_on);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return void toast.error(res.error ?? "שגיאה");
    if (success) toast.success(success);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title={c.title}
        back={{ href: "/chores", label: "משימות בית" }}
        subtitle={frequencyText(c.frequency, c.interval_days)}
        actions={
          <Button size="icon-sm" variant="secondary" onClick={() => setEdit(true)} aria-label="עריכה">
            <Pencil />
          </Button>
        }
      />
      <div className="space-y-6">
        <section className="flex flex-wrap items-center gap-2">
          {c.status === "active" ? <Badge tone={badge.tone}>{badge.text}</Badge> : <Badge>{c.status === "paused" ? "מושהה" : "הושלם"}</Badge>}
          {c.priority === "high" && <Badge tone="danger">דחוף</Badge>}
        </section>

        {c.status === "active" && (
          <Button size="lg" className="w-full" loading={busy} onClick={() => run(() => completeChore(c.id), "סומן כבוצע ✓")}>
            ביצענו ✓
          </Button>
        )}

        <Panel>
          <Row label="אחראי/ת" value={nameOf(c.assignee_id) ?? "משותף"} />
          <Row label="תדירות" value={frequencyText(c.frequency, c.interval_days)} />
          {c.room_id && <Row label="חדר" value={rooms.find((r) => r.id === c.room_id)?.name ?? ""} />}
          <Row label="עדיפות" value={PRIORITY_LABEL[c.priority]} />
          <Row label="בוצע לאחרונה" value={c.last_completed_at ? timeAgo(c.last_completed_at) : "עוד לא"} />
          <Row label="תזכורת" value={c.remind ? "כן" : "לא"} />
          {c.notes && <p className="px-4 py-3 text-[15px] whitespace-pre-wrap">{c.notes}</p>}
        </Panel>

        {c.status === "active" && (
          <section>
            <PanelHeading title="לדחות לתאריך אחר" />
            <div className="flex gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="תאריך חדש" />
              <Button variant="secondary" disabled={date === c.next_due_on} onClick={() => run(() => rescheduleChore(c.id, date), "התאריך עודכן")}>
                עדכון
              </Button>
            </div>
          </section>
        )}

        <section>
          <PanelHeading title="היסטוריה" count={history.length} />
          {history.length ? (
            <Panel>
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[15px]">
                  <span>
                    {nameOf(h.completed_by) ?? "מישהו"}
                    {h.note ? <span className="footnote block text-muted">{h.note}</span> : null}
                  </span>
                  <span className="footnote text-muted">
                    {formatShortDate(h.completed_at)}
                    {h.due_on !== h.completed_at.slice(0, 10) ? ` (מועד: ${formatShortDate(h.due_on)})` : ""}
                  </span>
                </div>
              ))}
            </Panel>
          ) : (
            <p className="px-1 text-[15px] text-muted">כשתסמנו ביצוע, הוא יירשם כאן.</p>
          )}
        </section>

        <div className="flex gap-2">
          {c.status === "active" ? (
            <Button variant="secondary" className="flex-1" onClick={() => run(() => setChoreStatus(c.id, "paused"), "הושהה")}>
              <Pause /> השהיה
            </Button>
          ) : (
            <Button variant="secondary" className="flex-1" onClick={() => run(() => setChoreStatus(c.id, "active"), "חזר לפעילות")}>
              <Play /> הפעלה מחדש
            </Button>
          )}
          <Button variant="danger-ghost" className="flex-1" onClick={() => setConfirm(true)}>
            <Trash2 /> מחיקה
          </Button>
        </div>
      </div>

      <ChoreSheet open={edit} onOpenChange={setEdit} chore={c} rooms={rooms} members={members} />
      <ConfirmSheet
        open={confirm}
        onOpenChange={setConfirm}
        title={`למחוק את "${c.title}"?`}
        description="המשימה וההיסטוריה שלה יימחקו."
        confirmLabel="מחיקה"
        destructive
        onConfirm={async () => {
          const r = await deleteChore(c.id);
          if (!r.ok) return void toast.error(r.error);
          router.push("/chores");
        }}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-3 text-[15px]">
      <span className="text-muted">{label}</span>
      <span className="text-end">{value}</span>
    </div>
  );
}
