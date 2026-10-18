"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveAppliance } from "@/server/actions/admin";
import type { Appliance, Room } from "@/lib/types";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PhotoPicker } from "@/components/media/photo-picker";

const KINDS = ["מקרר", "מכונת כביסה", "מייבש", "מדיח כלים", "תנור", "כיריים", "מיקרוגל", "מזגן", "דוד חשמל", "טלוויזיה", "שואב אבק רובוטי", "אחר"];

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

export function ApplianceSheet({ open, onOpenChange, householdId, appliance, rooms }: { open: boolean; onOpenChange: (o: boolean) => void; householdId: string; appliance: Appliance | null; rooms: Room[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(appliance));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(toForm(appliance));
  }, [open, appliance]);
  const set = (k: keyof Form, v: string | null) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await saveAppliance(appliance?.id ?? null, {
      ...form,
      invoice_document_id: appliance?.invoice_document_id ?? null,
      manual_document_id: appliance?.manual_document_id ?? null,
    });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    onOpenChange(false);
    if (!appliance) router.push(`/appliances/${res.data.id}`);
    else router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={appliance ? "עריכת מכשיר" : "מכשיר חדש"}
      footer={
        <Button type="submit" form="appliance-form" size="lg" className="w-full" loading={saving}>
          שמירה
        </Button>
      }
    >
      <form id="appliance-form" onSubmit={submit} className="flex flex-col gap-4">
        <PhotoPicker householdId={householdId} module="appliances" value={form.image_path} onChange={(p) => set("image_path", p)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="שם" htmlFor="ap-name">
            <Input id="ap-name" value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="המקרר במטבח" />
          </Field>
          <Field label="סוג" htmlFor="ap-kind">
            <Input id="ap-kind" list="ap-kinds" value={form.kind} onChange={(e) => set("kind", e.target.value)} />
            <datalist id="ap-kinds">
              {KINDS.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </Field>
        </div>
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="תאריך קנייה" htmlFor="ap-bought">
            <Input id="ap-bought" type="date" value={form.purchased_on} onChange={(e) => set("purchased_on", e.target.value)} />
          </Field>
          <Field label="אחריות עד" htmlFor="ap-warranty">
            <Input id="ap-warranty" type="date" value={form.warranty_until} onChange={(e) => set("warranty_until", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="חנות" htmlFor="ap-store">
            <Input id="ap-store" value={form.store} onChange={(e) => set("store", e.target.value)} />
          </Field>
          <Field label="מחיר (₪)" htmlFor="ap-price">
            <Input id="ap-price" inputMode="decimal" value={form.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} />
          </Field>
          <Field label="נותן אחריות" htmlFor="ap-wprov">
            <Input id="ap-wprov" value={form.warranty_provider} onChange={(e) => set("warranty_provider", e.target.value)} />
          </Field>
        </div>
        <Field label="הערות" htmlFor="ap-notes">
          <Textarea id="ap-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </form>
    </Sheet>
  );
}
