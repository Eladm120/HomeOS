"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileCheck2, Receipt, X } from "lucide-react";
import { toast } from "sonner";
import { createDocument, linkDocument, saveAppliance } from "@/server/actions/admin";
import type { Appliance, Room } from "@/lib/types";
import { addYears, formatShortDate, todayInZone } from "@/lib/format";
import { uploadHouseholdFile, uploadHouseholdImage, validateImageFile } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PhotoPicker } from "@/components/media/photo-picker";

const KINDS = ["מקרר", "מכונת כביסה", "מייבש", "מדיח כלים", "תנור", "מזגן", "דוד חשמל", "טלוויזיה", "שואב אבק רובוטי", "מיקרוגל", "כיריים", "אחר"];
const WARRANTY_YEARS = [1, 2, 3, 5] as const;

type Form = Record<"name" | "kind" | "brand" | "model" | "serial_number" | "room_id" | "purchased_on" | "store" | "purchase_price" | "warranty_until" | "warranty_provider" | "notes", string> & {
  image_path: string | null;
};

const toForm = (a: Appliance | null): Form => ({
  name: a?.name ?? "",
  kind: a?.kind ?? "",
  brand: a?.brand ?? "",
  model: a?.model ?? "",
  serial_number: a?.serial_number ?? "",
  room_id: a?.room_id ?? "",
  purchased_on: a?.purchased_on ?? "",
  store: a?.store ?? "",
  purchase_price: a?.purchase_price != null ? String(a.purchase_price) : "",
  warranty_until: a?.warranty_until ?? "",
  warranty_provider: a?.warranty_provider ?? "",
  notes: a?.notes ?? "",
  image_path: a?.image_path ?? null,
});

/**
 * The appliance's digital folder, in the order people actually need it:
 * what it is → where it was bought → the receipt → the warranty. Model and
 * serial (what a technician asks for) sit in a folded "for service" section.
 */
export function ApplianceSheet({ open, onOpenChange, householdId, appliance, rooms }: { open: boolean; onOpenChange: (o: boolean) => void; householdId: string; appliance: Appliance | null; rooms: Room[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(appliance));
  const [receipt, setReceipt] = useState<File | null>(null);
  const [customWarranty, setCustomWarranty] = useState(false);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(appliance));
    setReceipt(null);
    setCustomWarranty(false);
    setMore(!!appliance && !!(appliance.brand || appliance.model || appliance.serial_number || appliance.notes));
  }, [open, appliance]);
  const set = (k: keyof Form, v: string | null) => setForm((f) => ({ ...f, [k]: v }));

  const warrantyFrom = form.purchased_on || todayInZone();
  const pickedYears = WARRANTY_YEARS.find((y) => form.warranty_until && addYears(warrantyFrom, y) === form.warranty_until);
  const hasInvoice = !!appliance?.invoice_document_id;

  function pickReceipt(f: File | undefined) {
    if (!f) return;
    if (f.type !== "application/pdf") {
      const problem = validateImageFile(f);
      if (problem) return void toast.error(problem);
    } else if (f.size > 25 * 1024 * 1024) return void toast.error("הקובץ גדול מדי");
    setReceipt(f);
  }

  /** The receipt becomes a document in the vault, linked to the appliance as its invoice. */
  async function storeReceipt(applianceId: string, name: string): Promise<string> {
    const file = receipt!;
    const isPdf = file.type === "application/pdf";
    const up = isPdf ? await uploadHouseholdFile(householdId, "documents", file) : { path: await uploadHouseholdImage(householdId, "documents", file), size: file.size };
    const res = await createDocument({
      title: `קבלה · ${name}`,
      category: "receipt",
      tags: [],
      file_path: up.path,
      file_name: file.name.slice(0, 200),
      mime_type: isPdf ? "application/pdf" : up.path.endsWith(".webp") ? "image/webp" : "image/jpeg",
      size_bytes: up.size,
      issued_on: form.purchased_on,
      expires_on: form.warranty_until,
      remind_on: "",
      sensitive: false,
      notes: "",
      previous_version_id: null,
    });
    if (!res.ok) throw new Error(res.error);
    await linkDocument(res.data.id, "appliance", applianceId);
    return res.data.id;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving("שומר…");
    try {
      const payload = { ...form, invoice_document_id: appliance?.invoice_document_id ?? null, manual_document_id: appliance?.manual_document_id ?? null };
      const res = await saveAppliance(appliance?.id ?? null, payload);
      if (!res.ok) throw new Error(res.error);
      if (receipt) {
        setSaving("מעלה את הקבלה…");
        const docId = await storeReceipt(res.data.id, form.name);
        const linked = await saveAppliance(res.data.id, { ...payload, invoice_document_id: docId });
        if (!linked.ok) throw new Error(linked.error);
      }
      onOpenChange(false);
      if (!appliance) router.push(`/appliances/${res.data.id}`);
      else router.refresh();
    } catch (err) {
      toast.error((err as Error).message || "השמירה נכשלה");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={appliance ? "עריכת מכשיר" : "מכשיר חדש"}
      description="תיק אחד לכל מכשיר: מאיפה קניתם, הקבלה והאחריות."
      footer={
        <Button type="submit" form="appliance-form" size="lg" className="w-full" loading={!!saving}>
          {saving ?? "שמירה"}
        </Button>
      }
    >
      <form id="appliance-form" onSubmit={submit} className="flex flex-col gap-5">
        {/* What it is */}
        <div className="flex flex-col gap-3">
          <PhotoPicker householdId={householdId} module="appliances" value={form.image_path} onChange={(p) => set("image_path", p)} />
          <Field label="איזה מכשיר?" htmlFor="ap-name">
            <Input id="ap-name" value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="המקרר במטבח" />
          </Field>
          <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="סוג המכשיר">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={form.kind === k}
                onClick={() => setForm((f) => ({ ...f, kind: f.kind === k ? "" : k, name: f.name || (k === "אחר" ? "" : k) }))}
                className={cn("h-8 shrink-0 rounded-full px-3 text-[14px] font-medium transition-colors", form.kind === k ? "bg-foreground text-background" : "bg-fill")}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <Step emoji="🛒" title="מאיפה קניתי">
          <Field label="חנות או אתר" htmlFor="ap-store">
            <Input id="ap-store" value={form.store} onChange={(e) => set("store", e.target.value)} placeholder="מחסני חשמל, KSP…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="מתי" htmlFor="ap-bought">
              <Input id="ap-bought" type="date" value={form.purchased_on} onChange={(e) => set("purchased_on", e.target.value)} />
            </Field>
            <Field label="כמה עלה (₪)" htmlFor="ap-price">
              <Input id="ap-price" inputMode="decimal" value={form.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} />
            </Field>
          </div>
        </Step>

        <Step emoji="🧾" title="קבלה">
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => pickReceipt(e.target.files?.[0])} />
          {receipt ? (
            <div className="flex items-center gap-3 rounded-2xl bg-sage-soft px-3 py-2.5">
              <FileCheck2 className="size-5 shrink-0 text-sage" />
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{receipt.name}</span>
              <button type="button" onClick={() => setReceipt(null)} aria-label="הסרת הקבלה" className="grid size-8 place-items-center rounded-full text-muted">
                <X className="size-4" />
              </button>
            </div>
          ) : hasInvoice ? (
            <p className="flex items-center gap-2 text-[15px] text-sage">
              <FileCheck2 className="size-5" /> הקבלה כבר שמורה בתיק
            </p>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-[15px] font-medium text-primary">
              <Receipt className="size-5" /> צילום או קובץ של הקבלה
            </button>
          )}
        </Step>

        <Step emoji="🛡️" title="אחריות">
          <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="משך האחריות">
            {WARRANTY_YEARS.map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={pickedYears === y && !customWarranty}
                onClick={() => {
                  setCustomWarranty(false);
                  set("warranty_until", addYears(warrantyFrom, y));
                }}
                className={cn("h-10 rounded-xl text-[14px] font-semibold transition-colors", pickedYears === y && !customWarranty ? "bg-primary text-primary-foreground" : "bg-fill")}
              >
                {y === 1 ? "שנה" : y === 2 ? "שנתיים" : `${y} שנים`}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={customWarranty || (!!form.warranty_until && !pickedYears)}
              onClick={() => setCustomWarranty(true)}
              className={cn("h-10 rounded-xl text-[14px] font-semibold", customWarranty || (form.warranty_until && !pickedYears) ? "bg-primary text-primary-foreground" : "bg-fill")}
            >
              תאריך
            </button>
          </div>
          {(customWarranty || (form.warranty_until && !pickedYears)) && (
            <Field label="אחריות עד" htmlFor="ap-warranty">
              <Input id="ap-warranty" type="date" value={form.warranty_until} onChange={(e) => set("warranty_until", e.target.value)} />
            </Field>
          )}
          {form.warranty_until && (
            <p className="footnote text-muted">
              באחריות עד <span className="num font-semibold text-foreground">{formatShortDate(form.warranty_until)}</span>
              {!form.purchased_on && " (מהיום — הוסיפו תאריך קנייה לדיוק)"}. נזכיר חודש לפני שהיא נגמרת.
            </p>
          )}
          <Field label="למי פונים בתקלה" htmlFor="ap-wprov">
            <Input id="ap-wprov" value={form.warranty_provider} onChange={(e) => set("warranty_provider", e.target.value)} placeholder="היבואן או חברת השירות + טלפון" />
          </Field>
        </Step>

        <div>
          <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="flex w-full items-center gap-2 py-1 text-[15px] font-semibold text-primary">
            <ChevronDown className={cn("size-4 transition-transform", more && "rotate-180")} />
            פרטים לטכנאי (יצרן, דגם, מספר סידורי)
          </button>
          {more && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="יצרן" htmlFor="ap-brand">
                  <Input id="ap-brand" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
                </Field>
                <Field label="דגם" htmlFor="ap-model">
                  <Input id="ap-model" dir="ltr" value={form.model} onChange={(e) => set("model", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="מספר סידורי" htmlFor="ap-serial">
                  <Input id="ap-serial" dir="ltr" value={form.serial_number} onChange={(e) => set("serial_number", e.target.value)} />
                </Field>
                <Field label="חדר" htmlFor="ap-room">
                  <Select id="ap-room" value={form.room_id} onChange={(e) => set("room_id", e.target.value)}>
                    <option value="">—</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="הערות" htmlFor="ap-notes">
                <Textarea id="ap-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>
          )}
        </div>
      </form>
    </Sheet>
  );
}

function Step({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-[1.25rem] bg-surface-2 p-3.5">
      <h3 className="headline flex items-center gap-2">
        <span aria-hidden>{emoji}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}
