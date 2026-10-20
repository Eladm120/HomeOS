"use client";

import { Emoji3D } from "@/components/ui/emoji-3d";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteExpense, deleteRecurringCharge, saveExpense, saveRecurringCharge } from "@/server/actions/admin";
import type { HouseholdExpense, RecurringCharge } from "@/lib/types";
import { formatCurrency, formatShortDate, todayInZone } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/labels";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Panel, PanelHeading, PanelRow } from "@/components/ui/panel";
import { CategoryBars, MonthBars } from "./month-bars";


const FREQ: Record<RecurringCharge["frequency"], { label: string; perMonth: number }> = {
  weekly: { label: "כל שבוע", perMonth: 52 / 12 },
  monthly: { label: "כל חודש", perMonth: 1 },
  bimonthly: { label: "כל חודשיים", perMonth: 0.5 },
  quarterly: { label: "כל רבעון", perMonth: 1 / 3 },
  yearly: { label: "כל שנה", perMonth: 1 / 12 },
};

export function ExpensesView({
  monthly,
  thisMonth,
  lastMonth,
  byCategory,
  expenses,
  recurring,
  upcoming,
}: {
  monthly: { month: string; total: number }[];
  thisMonth: number;
  lastMonth: number;
  byCategory: { key: string; label: string; emoji: string; total: number }[];
  expenses: HouseholdExpense[];
  recurring: RecurringCharge[];
  upcoming: { id: string; title: string; amount: number; due: string; href: string }[];
}) {
  const router = useRouter();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [charge, setCharge] = useState<RecurringCharge | "new" | null>(null);
  const change = lastMonth > 0 ? (thisMonth - lastMonth) / lastMonth : null;
  const committed = recurring.filter((r) => r.active).reduce((s, r) => s + Number(r.amount) * FREQ[r.frequency].perMonth, 0);

  return (
    <>
      <PageHeader title="הוצאות הבית" back={{ href: "/household", label: "משק הבית" }} subtitle="חשבונות, חיובים קבועים והוצאות — תמונת מצב, לא ייעוץ פיננסי" />
      <div className="space-y-6 pb-10">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-border bg-surface px-4 py-3">
            <p className="footnote text-muted">החודש עד עכשיו</p>
            <p className="num text-[24px] font-extrabold">{formatCurrency(Math.round(thisMonth))}</p>
            {change != null && (
              <p className="footnote text-muted">
                {change >= 0 ? "▲" : "▼"} <span className="num">{Math.round(Math.abs(change) * 100)}%</span> מהחודש שעבר
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-surface px-4 py-3">
            <p className="footnote text-muted">התחייבויות קבועות לחודש</p>
            <p className="num text-[24px] font-extrabold">{formatCurrency(Math.round(committed))}</p>
            <p className="footnote text-muted">{recurring.filter((r) => r.active).length} חיובים</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setExpenseOpen(true)}>
            <Plus /> הוצאה
          </Button>
          <Button variant="secondary" onClick={() => setCharge("new")}>
            <Repeat /> חיוב קבוע
          </Button>
        </div>

        <MonthBars data={monthly} title="הוצאות לפי חודש" />
        {byCategory.length > 0 && (
          <section>
            <PanelHeading title="לפי קטגוריה (השנה)" />
            <CategoryBars rows={byCategory} />
          </section>
        )}

        {upcoming.length > 0 && (
          <section>
            <PanelHeading title="תשלומים קרובים" count={upcoming.length} />
            <Panel>
              {upcoming.map((u) => (
                <PanelRow key={u.id} href={u.href} title={u.title} subtitle={formatShortDate(u.due)} trailing={<span className="num">{formatCurrency(u.amount)}</span>} />
              ))}
            </Panel>
          </section>
        )}

        <section>
          <PanelHeading title="חיובים קבועים" count={recurring.length || undefined} />
          {recurring.length ? (
            <Panel>
              {recurring.map((r) => (
                <PanelRow
                  key={r.id}
                  onClick={() => setCharge(r)}
                  title={r.title}
                  subtitle={[FREQ[r.frequency].label, r.provider, r.next_due_on ? `הבא: ${formatShortDate(r.next_due_on)}` : null].filter(Boolean).join(" · ")}
                  trailing={
                    <>
                      <span className="num">{formatCurrency(Number(r.amount))}</span>
                      {!r.active && <Badge>מושהה</Badge>}
                    </>
                  }
                />
              ))}
            </Panel>
          ) : (
            <p className="px-1 text-[15px] text-muted">שכר דירה, ועד בית, מנויים, ביטוחים — כדי לראות כמה הבית עולה בחודש.</p>
          )}
        </section>

        <section>
          <PanelHeading title="הוצאות אחרונות" count={expenses.length || undefined} />
          {expenses.length ? (
            <Panel>
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <span aria-hidden className="text-[20px]">
                    <Emoji3D emoji={(EXPENSE_CATEGORIES[e.category] ?? EXPENSE_CATEGORIES.other).emoji} className="size-[72%]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{e.title}</span>
                    <span className="footnote block text-muted">{formatShortDate(e.spent_on)}</span>
                  </span>
                  <span className="num">{formatCurrency(Number(e.amount))}</span>
                  <button
                    type="button"
                    aria-label="מחיקה"
                    className="grid size-8 place-items-center rounded-full text-muted active:bg-fill"
                    onClick={async () => {
                      const r = await deleteExpense(e.id);
                      if (!r.ok) return void toast.error(r.error);
                      router.refresh();
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </Panel>
          ) : (
            <p className="px-1 text-[15px] text-muted">הוסיפו הוצאות חד פעמיות לבית: תיקון, ריהוט, ציוד.</p>
          )}
        </section>
      </div>

      <ExpenseSheet open={expenseOpen} onOpenChange={setExpenseOpen} />
      <ChargeSheet charge={charge} onClose={() => setCharge(null)} />
    </>
  );
}

function ExpenseSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("home");
  const [date, setDate] = useState(todayInZone());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="הוצאה חדשה"
      footer={
        <Button
          size="lg"
          className="w-full"
          loading={saving}
          onClick={async () => {
            setSaving(true);
            const r = await saveExpense(null, { title, amount, category, spent_on: date, notes });
            setSaving(false);
            if (!r.ok) return void toast.error(r.error);
            setTitle("");
            setAmount("");
            onOpenChange(false);
            router.refresh();
          }}
        >
          שמירה
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="על מה" htmlFor="ex-title">
          <Input id="ex-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="אינסטלטור, מדפים…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="סכום (₪)" htmlFor="ex-amount">
            <Input id="ex-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="תאריך" htmlFor="ex-date">
            <Input id="ex-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="קטגוריה" htmlFor="ex-cat">
          <Select id="ex-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.emoji} {v.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="הערות" htmlFor="ex-notes">
          <Textarea id="ex-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" />
        </Field>
      </div>
    </Sheet>
  );
}

function ChargeSheet({ charge, onClose }: { charge: RecurringCharge | "new" | null; onClose: () => void }) {
  const router = useRouter();
  const existing = charge && charge !== "new" ? charge : null;
  const [seen, setSeen] = useState<typeof charge>(null);
  const [f, setF] = useState({ title: "", amount: "", category: "home", frequency: "monthly" as RecurringCharge["frequency"], next_due_on: "", provider: "", active: true, notes: "" });
  if (charge !== seen) {
    setSeen(charge);
    if (charge)
      setF(
        existing
          ? { title: existing.title, amount: String(existing.amount), category: existing.category, frequency: existing.frequency, next_due_on: existing.next_due_on ?? "", provider: existing.provider ?? "", active: existing.active, notes: existing.notes ?? "" }
          : { title: "", amount: "", category: "home", frequency: "monthly", next_due_on: "", provider: "", active: true, notes: "" },
      );
  }
  const [saving, setSaving] = useState(false);
  return (
    <Sheet
      open={!!charge}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? "חיוב קבוע" : "חיוב קבוע חדש"}
      footer={
        <div className="flex gap-2">
          {existing && (
            <Button
              variant="danger-ghost"
              onClick={async () => {
                const r = await deleteRecurringCharge(existing.id);
                if (!r.ok) return void toast.error(r.error);
                onClose();
                router.refresh();
              }}
            >
              מחיקה
            </Button>
          )}
          <Button
            size="lg"
            className="flex-1"
            loading={saving}
            onClick={async () => {
              setSaving(true);
              const r = await saveRecurringCharge(existing?.id ?? null, f);
              setSaving(false);
              if (!r.ok) return void toast.error(r.error);
              onClose();
              router.refresh();
            }}
          >
            שמירה
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="שם" htmlFor="rc-title2">
          <Input id="rc-title2" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="ועד בית, נטפליקס…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="סכום (₪)" htmlFor="rc-amount">
            <Input id="rc-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <Field label="תדירות" htmlFor="rc-freq">
            <Select id="rc-freq" value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value as RecurringCharge["frequency"] })}>
              {Object.entries(FREQ).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="החיוב הבא" htmlFor="rc-next">
            <Input id="rc-next" type="date" value={f.next_due_on} onChange={(e) => setF({ ...f, next_due_on: e.target.value })} />
          </Field>
          <Field label="קטגוריה" htmlFor="rc-cat2">
            <Select id="rc-cat2" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="ספק" htmlFor="rc-prov">
          <Input id="rc-prov" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} />
        </Field>
        <label className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
          פעיל
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="size-5 accent-[var(--primary)]" />
        </label>
      </div>
    </Sheet>
  );
}
