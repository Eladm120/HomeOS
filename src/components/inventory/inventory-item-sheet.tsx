"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createInventoryItem, updateInventoryItem } from "@/server/actions/inventory";
import type { InventoryItem, InventoryLocation, ProductCategory } from "@/lib/types";
import { UNITS } from "@/lib/grocery";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PhotoPicker } from "@/components/media/photo-picker";

interface FormState {
  name: string;
  brand: string;
  barcode: string;
  category_id: string;
  location_id: string;
  unit: string;
  initial_quantity: string;
  min_threshold: string;
  restock_quantity: string;
  expires_on: string;
  image_path: string | null;
  notes: string;
}

function toForm(i: InventoryItem | null, defaults?: Partial<FormState>): FormState {
  return {
    name: i?.name ?? "",
    brand: i?.brand ?? "",
    barcode: i?.barcode ?? "",
    category_id: i?.category_id ?? "",
    location_id: i?.location_id ?? "",
    unit: i?.unit ?? "יח׳",
    initial_quantity: "1",
    min_threshold: i?.min_threshold != null ? String(i.min_threshold) : "",
    restock_quantity: i?.restock_quantity != null ? String(i.restock_quantity) : "",
    expires_on: i?.expires_on ?? "",
    image_path: i?.image_path ?? null,
    notes: i?.notes ?? "",
    ...defaults,
  };
}

export function InventoryItemSheet({
  open,
  onOpenChange,
  householdId,
  item,
  categories,
  locations,
  defaults,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  item: InventoryItem | null;
  categories: ProductCategory[];
  locations: InventoryLocation[];
  defaults?: Partial<FormState>;
  onCreated?: (item: InventoryItem) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toForm(item, defaults));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toForm(item, defaults));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opened
  }, [open, item]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const base = {
      name: form.name,
      brand: form.brand,
      barcode: form.barcode,
      category_id: form.category_id,
      location_id: form.location_id,
      unit: form.unit,
      min_threshold: form.min_threshold,
      restock_quantity: form.restock_quantity,
      expires_on: form.expires_on,
      image_path: form.image_path,
      notes: form.notes,
    };
    const res = item
      ? await updateInventoryItem(item.id, base)
      : await createInventoryItem({ ...base, initial_quantity: form.initial_quantity || 0 });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return void toast.error(res.error);
    }
    toast.success(item ? "נשמר" : "נוסף למלאי");
    if (!item && res.data) onCreated?.(res.data as InventoryItem);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "עריכת מוצר" : "מוצר חדש במלאי"}
      footer={
        <Button type="submit" form="inv-form" size="lg" className="w-full" loading={saving}>
          {item ? "שמירה" : "הוספה למלאי"}
        </Button>
      }
    >
      <form id="inv-form" onSubmit={submit} className="space-y-4">
        <Field label="שם המוצר" htmlFor="inv-name" error={errors.name}>
          <Input id="inv-name" value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} autoFocus={!item} placeholder="חלב 3%" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          {!item && (
            <Field label="כמות בבית" error={errors.initial_quantity}>
              <Input inputMode="decimal" className="num" value={form.initial_quantity} onChange={(e) => set("initial_quantity", e.target.value.replace(",", "."))} />
            </Field>
          )}
          <Field label="יחידה" className={item ? "col-span-2" : undefined}>
            <Select value={form.unit} onChange={(e) => set("unit", e.target.value)}>
              {[...new Set([form.unit, ...UNITS])].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="מיקום">
            <Select value={form.location_id} onChange={(e) => set("location_id", e.target.value)}>
              <option value="">—</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="קטגוריה">
            <Select value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="התראה כשנשאר" hint="מינימום במלאי" error={errors.min_threshold}>
            <Input inputMode="decimal" className="num" value={form.min_threshold} onChange={(e) => set("min_threshold", e.target.value.replace(",", "."))} placeholder="1" />
          </Field>
          <Field label="כמה לקנות בכל פעם" error={errors.restock_quantity}>
            <Input inputMode="decimal" className="num" value={form.restock_quantity} onChange={(e) => set("restock_quantity", e.target.value.replace(",", "."))} placeholder="2" />
          </Field>
        </div>

        <Field label="תוקף" error={errors.expires_on}>
          <Input type="date" value={form.expires_on} onChange={(e) => set("expires_on", e.target.value)} />
        </Field>

        <Field label="תמונה">
          <PhotoPicker householdId={householdId} module="inventory" value={form.image_path} onChange={(p) => set("image_path", p)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="מותג" error={errors.brand}>
            <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} maxLength={80} />
          </Field>
          <Field label="ברקוד" error={errors.barcode}>
            <Input dir="ltr" inputMode="numeric" className="num" value={form.barcode} onChange={(e) => set("barcode", e.target.value.trim())} maxLength={32} />
          </Field>
        </div>

        <Field label="הערות" error={errors.notes}>
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={1000} className="min-h-20" />
        </Field>
      </form>
    </Sheet>
  );
}
