"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { savePlannedPurchase } from "@/server/actions/planner";
import type { PlannedPurchase, Room } from "@/lib/types";
import { PRIORITY_LABEL, PURCHASE_STATUS, options } from "@/lib/labels";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PhotoPicker } from "@/components/media/photo-picker";

type Form = Record<
  "name" | "room_id" | "project_id" | "store" | "url" | "price" | "quantity" | "priority" | "status" | "dimensions" | "color" | "material" | "notes",
  string
> & { image_path: string | null };

function toForm(p: PlannedPurchase | null, defaults?: Partial<Form>): Form {
  return {
    name: p?.name ?? "",
    room_id: p?.room_id ?? "",
    project_id: p?.project_id ?? "",
    store: p?.store ?? "",
    url: p?.url ?? "",
    price: p?.price != null ? String(p.price) : "",
    quantity: String(p?.quantity ?? 1),
    priority: p?.priority ?? "normal",
    status: p?.status ?? "idea",
    dimensions: p?.dimensions ?? "",
    color: p?.color ?? "",
    material: p?.material ?? "",
    notes: p?.notes ?? "",
    image_path: p?.image_path ?? null,
    ...defaults,
  };
}

export function PurchaseSheet({
  open,
  onOpenChange,
  householdId,
  rooms,
  projects,
  purchase,
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  rooms: Room[];
  projects: { id: string; title: string }[];
  purchase: PlannedPurchase | null;
  defaults?: Partial<Form>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(purchase, defaults));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toForm(purchase, defaults));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opened
  }, [open, purchase]);

  const set = (k: keyof Form, v: string | null) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await savePlannedPurchase(purchase?.id ?? null, {
      ...form,
      priority: form.priority as "low" | "normal" | "high",
      status: form.status as PlannedPurchase["status"],
    });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return void toast.error(res.error);
    }
    toast.success(purchase ? "נשמר" : `${res.data.name} נוסף לתכנון`);
    onOpenChange(false);
    if (!purchase) router.push(`/planner/${res.data.id}`);
    else router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={purchase ? "עריכת פריט" : "פריט חדש לבית"}
      footer={
        <Button type="submit" form="purchase-form" size="lg" className="w-full" loading={saving}>
          שמירה
        </Button>
      }
    >
      <form id="purchase-form" onSubmit={submit} className="flex flex-col gap-4">
        <PhotoPicker householdId={householdId} module="planner" value={form.image_path} onChange={(p) => set("image_path", p)} />
        <Field label="מה רוצים לקנות?" htmlFor="pp-name" error={errors.name}>
          <Input id="pp-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="למשל: כורסת קריאה" required maxLength={160} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="חדר" htmlFor="pp-room">
            <Select id="pp-room" value={form.room_id} onChange={(e) => set("room_id", e.target.value)}>
              <option value="">ללא חדר</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="סטטוס" htmlFor="pp-status">
            <Select id="pp-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
              {options(PURCHASE_STATUS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="מחיר (₪)" htmlFor="pp-price" error={errors.price}>
            <Input id="pp-price" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0" />
          </Field>
          <Field label="כמות" htmlFor="pp-qty" error={errors.quantity}>
            <Input id="pp-qty" inputMode="numeric" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="חנות" htmlFor="pp-store">
            <Input id="pp-store" value={form.store} onChange={(e) => set("store", e.target.value)} placeholder="איקאה, ACE…" maxLength={120} />
          </Field>
          <Field label="עדיפות" htmlFor="pp-prio">
            <Select id="pp-prio" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              {options(PRIORITY_LABEL).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="קישור למוצר" htmlFor="pp-url" error={errors.url}>
          <Input id="pp-url" dir="ltr" inputMode="url" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="מידות" htmlFor="pp-dim">
            <Input id="pp-dim" value={form.dimensions} onChange={(e) => set("dimensions", e.target.value)} placeholder="80×90" />
          </Field>
          <Field label="צבע" htmlFor="pp-color">
            <Input id="pp-color" value={form.color} onChange={(e) => set("color", e.target.value)} />
          </Field>
          <Field label="חומר" htmlFor="pp-mat">
            <Input id="pp-mat" value={form.material} onChange={(e) => set("material", e.target.value)} />
          </Field>
        </div>
        {projects.length > 0 && (
          <Field label="שייך לפרויקט" htmlFor="pp-project">
            <Select id="pp-project" value={form.project_id} onChange={(e) => set("project_id", e.target.value)}>
              <option value="">ללא</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="הערות" htmlFor="pp-notes">
          <Textarea id="pp-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={5000} />
        </Field>
      </form>
    </Sheet>
  );
}
