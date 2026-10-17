"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveChore } from "@/server/actions/chores";
import type { Chore, ChoreFrequency, Room } from "@/lib/types";
import { CHORE_FREQUENCY, PRIORITY_LABEL, options } from "@/lib/labels";
import { todayInZone } from "@/lib/format";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

type Form = Record<"title" | "description" | "room_id" | "assignee_id" | "interval_days" | "next_due_on" | "priority" | "notes", string> & {
  frequency: ChoreFrequency;
  remind: boolean;
};

function toForm(c: Chore | null, defaults?: Partial<Form>): Form {
  return {
    title: c?.title ?? "",
    description: c?.description ?? "",
    room_id: c?.room_id ?? "",
    assignee_id: c?.assignee_id ?? "",
    frequency: c?.frequency ?? "weekly",
    interval_days: c?.interval_days != null ? String(c.interval_days) : "",
    next_due_on: c?.next_due_on ?? todayInZone(),
    priority: c?.priority ?? "normal",
    remind: c?.remind ?? true,
    notes: c?.notes ?? "",
    ...defaults,
  };
}

const SUGGESTIONS = ["החלפת מצעים", "שטיפת רצפה", "ניקוי חדר רחצה", "כביסה", "הוצאת מחזור", "ניקוי מסנן מזגן", "ניקוי מקרר", "החלפת פילטר מים"];

export function ChoreSheet({
  open,
  onOpenChange,
  chore,
  rooms,
  members,
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  chore: Chore | null;
  rooms: Room[];
  members: { id: string; name: string }[];
  defaults?: Partial<Form>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(chore, defaults));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toForm(chore, defaults));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opened
  }, [open, chore]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await saveChore(chore?.id ?? null, { ...form, priority: form.priority as Chore["priority"] });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return void toast.error(res.error);
    }
    toast.success(chore ? "נשמר" : "המשימה נוספה");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={chore ? "עריכת משימה" : "משימה חדשה"}
      footer={
        <Button type="submit" form="chore-form" size="lg" className="w-full" loading={saving}>
          שמירה
        </Button>
      }
    >
      <form id="chore-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="מה צריך לעשות?" htmlFor="ch-title" error={errors.title}>
          <Input id="ch-title" value={form.title} onChange={(e) => set("title", e.target.value)} required maxLength={160} placeholder="החלפת מצעים" />
        </Field>
        {!chore && !form.title && (
          <div className="scrollbar-none -mx-4 -mt-2 flex gap-2 overflow-x-auto px-4">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => set("title", s)} className="h-8 shrink-0 rounded-full bg-fill px-3 text-[14px]">
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="תדירות" htmlFor="ch-freq">
            <Select id="ch-freq" value={form.frequency} onChange={(e) => set("frequency", e.target.value as ChoreFrequency)}>
              {options(CHORE_FREQUENCY).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          {form.frequency === "custom" ? (
            <Field label="כל כמה ימים" htmlFor="ch-interval" error={errors.interval_days}>
              <Input id="ch-interval" inputMode="numeric" value={form.interval_days} onChange={(e) => set("interval_days", e.target.value)} placeholder="10" />
            </Field>
          ) : (
            <Field label={chore ? "הפעם הבאה" : "החל מ־"} htmlFor="ch-due" error={errors.next_due_on}>
              <Input id="ch-due" type="date" value={form.next_due_on} onChange={(e) => set("next_due_on", e.target.value)} required />
            </Field>
          )}
        </div>
        {form.frequency === "custom" && (
          <Field label={chore ? "הפעם הבאה" : "החל מ־"} htmlFor="ch-due2">
            <Input id="ch-due2" type="date" value={form.next_due_on} onChange={(e) => set("next_due_on", e.target.value)} required />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="מי אחראי/ת" htmlFor="ch-assignee">
            <Select id="ch-assignee" value={form.assignee_id} onChange={(e) => set("assignee_id", e.target.value)}>
              <option value="">משותף</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="חדר" htmlFor="ch-room">
            <Select id="ch-room" value={form.room_id} onChange={(e) => set("room_id", e.target.value)}>
              <option value="">כל הבית</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="עדיפות" htmlFor="ch-prio">
          <Select id="ch-prio" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            {options(PRIORITY_LABEL).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-[16px]">
          תזכורת ביום הביצוע
          <input type="checkbox" checked={form.remind} onChange={(e) => set("remind", e.target.checked)} className="size-5 accent-[var(--primary)]" />
        </label>
        <Field label="הערות" htmlFor="ch-notes">
          <Textarea id="ch-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="איך עושים, איפה הציוד…" />
        </Field>
      </form>
    </Sheet>
  );
}
