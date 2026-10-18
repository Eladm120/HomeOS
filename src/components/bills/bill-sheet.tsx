"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveBill } from "@/server/actions/admin";
import type { BillCategory, UtilityBill } from "@/lib/types";
import { BILL_CATEGORY } from "@/lib/labels";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

type Form = Record<"provider_name" | "account_ref" | "period_start" | "period_end" | "amount" | "issue_date" | "due_on" | "paid_on" | "consumption" | "consumption_unit" | "fixed_charges" | "notes", string> & {
  category: BillCategory;
  payment_status: UtilityBill["payment_status"];
};

const toForm = (b: UtilityBill | null): Form => ({
  category: b?.category ?? "electricity",
  provider_name: b?.provider_name ?? "",
  account_ref: b?.account_ref ?? "",
  period_start: b?.period_start ?? "",
  period_end: b?.period_end ?? "",
  amount: b ? String(b.amount) : "",
  issue_date: b?.issue_date ?? "",
  due_on: b?.due_on ?? "",
  paid_on: b?.paid_on ?? "",
  payment_status: b?.payment_status ?? "unpaid",
  consumption: b?.consumption != null ? String(b.consumption) : "",
  consumption_unit: b?.consumption_unit ?? "",
  fixed_charges: b?.fixed_charges != null ? String(b.fixed_charges) : "",
  notes: b?.notes ?? "",
});

/** Manual entry, and the review form for imported bills (saving it marks the figures verified). */
export function BillSheet({ open, onOpenChange, bill, verifying }: { open: boolean; onOpenChange: (o: boolean) => void; bill: UtilityBill | null; verifying?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(bill));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setForm(toForm(bill));
      setErrors({});
    }
  }, [open, bill]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const unit = BILL_CATEGORY[form.category]?.unit;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await saveBill(bill?.id ?? null, { ...form, consumption_unit: form.consumption_unit || unit || "", document_id: bill?.document_id ?? null }, { verify: true });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return void toast.error(res.error);
    }
    toast.success(verifying ? "החשבון אומת" : "נשמר");
    onOpenChange(false);
    if (!bill) router.push(`/bills/${res.data.id}`);
    else router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={verifying ? "בדיקת הנתונים שנקראו" : bill ? "עריכת חשבון" : "חשבון חדש"}
      description={verifying ? "תקנו מה שצריך ואשרו" : undefined}
      footer={
        <Button type="submit" form="bill-form" size="lg" className="w-full" loading={saving}>
          {verifying ? "אישור הנתונים" : "שמירה"}
        </Button>
      }
    >
      <form id="bill-form" onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="סוג" htmlFor="bl-cat">
            <Select id="bl-cat" value={form.category} onChange={(e) => set("category", e.target.value as BillCategory)}>
              {Object.entries(BILL_CATEGORY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.emoji} {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="ספק" htmlFor="bl-prov">
            <Input id="bl-prov" value={form.provider_name} onChange={(e) => set("provider_name", e.target.value)} placeholder="חברת החשמל" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="סכום (₪)" htmlFor="bl-amount" error={errors.amount}>
            <Input id="bl-amount" inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} required />
          </Field>
          <Field label="לתשלום עד" htmlFor="bl-due">
            <Input id="bl-due" type="date" value={form.due_on} onChange={(e) => set("due_on", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="תקופה מ־" htmlFor="bl-start">
            <Input id="bl-start" type="date" value={form.period_start} onChange={(e) => set("period_start", e.target.value)} />
          </Field>
          <Field label="עד" htmlFor="bl-end" error={errors.period_end}>
            <Input id="bl-end" type="date" value={form.period_end} onChange={(e) => set("period_end", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={`צריכה${unit ? ` (${unit})` : ""}`} htmlFor="bl-cons">
            <Input id="bl-cons" inputMode="decimal" value={form.consumption} onChange={(e) => set("consumption", e.target.value)} />
          </Field>
          <Field label="חיובים קבועים" htmlFor="bl-fixed">
            <Input id="bl-fixed" inputMode="decimal" value={form.fixed_charges} onChange={(e) => set("fixed_charges", e.target.value)} />
          </Field>
          <Field label="מס׳ חוזה" htmlFor="bl-acc">
            <Input id="bl-acc" dir="ltr" value={form.account_ref} onChange={(e) => set("account_ref", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="תשלום" htmlFor="bl-status">
            <Select id="bl-status" value={form.payment_status} onChange={(e) => set("payment_status", e.target.value as Form["payment_status"])}>
              <option value="unpaid">לא שולם</option>
              <option value="paid">שולם</option>
              <option value="autopay">הוראת קבע</option>
            </Select>
          </Field>
          <Field label="תאריך הפקה" htmlFor="bl-issue">
            <Input id="bl-issue" type="date" value={form.issue_date} onChange={(e) => set("issue_date", e.target.value)} />
          </Field>
        </div>
        <Field label="הערות" htmlFor="bl-notes">
          <Textarea id="bl-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-16" />
        </Field>
      </form>
    </Sheet>
  );
}
