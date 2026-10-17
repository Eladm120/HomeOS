"use client";

import { useEffect, useState } from "react";
import { Flag, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { addShoppingItem, deleteShoppingItem, restoreShoppingItem, updateShoppingItem } from "@/server/actions/grocery";
import type { CatalogProduct, ItemPriority, ProductCategory, ShoppingListItem } from "@/lib/types";
import { UNITS } from "@/lib/grocery";
import { escapeLike, cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PhotoPicker } from "@/components/media/photo-picker";
import { SignedImage } from "@/components/media/signed-image";

interface FormState {
  name: string;
  quantity: number;
  unit: string;
  category_id: string;
  brand: string;
  variant: string;
  notes: string;
  priority: ItemPriority;
  image_path: string | null;
  catalog_product_id: string | null;
  save_to_catalog: boolean;
}

const EMPTY: FormState = {
  name: "",
  quantity: 1,
  unit: "יח׳",
  category_id: "",
  brand: "",
  variant: "",
  notes: "",
  priority: "normal",
  image_path: null,
  catalog_product_id: null,
  save_to_catalog: true,
};

function fromItem(i: ShoppingListItem): FormState {
  return {
    name: i.name,
    quantity: Number(i.quantity),
    unit: i.unit,
    category_id: i.category_id ?? "",
    brand: i.brand ?? "",
    variant: i.variant ?? "",
    notes: i.notes ?? "",
    priority: i.priority,
    image_path: i.image_path,
    catalog_product_id: i.catalog_product_id,
    save_to_catalog: !i.catalog_product_id,
  };
}

export function GroceryItemSheet({
  open,
  onOpenChange,
  householdId,
  categories,
  item,
  onSaved,
  onDeleted,
  addedByName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  categories: ProductCategory[];
  item: ShoppingListItem | null;
  onSaved: (row: ShoppingListItem) => void;
  onDeleted?: (id: string) => void;
  addedByName?: string;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<CatalogProduct[]>([]);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(item ? fromItem(item) : EMPTY);
    setErrors({});
    setSuggestions([]);
    setShowMore(!!item && !!(item.brand || item.variant || item.notes));
  }, [open, item]);

  // Household catalog autocomplete (reuses names, brands and photos).
  useEffect(() => {
    const term = form.name.trim();
    if (!open || term.length < 2 || form.catalog_product_id) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await getSupabaseBrowser()
        .from("product_catalog")
        .select("id, household_id, name, brand, variant, barcode, category_id, default_unit, image_path")
        .eq("household_id", householdId)
        .ilike("name", `%${escapeLike(term)}%`)
        .limit(5);
      setSuggestions((data as CatalogProduct[]) ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [form.name, form.catalog_product_id, householdId, open]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  function pickSuggestion(p: CatalogProduct) {
    setForm((f) => ({
      ...f,
      name: p.name,
      brand: p.brand ?? "",
      variant: p.variant ?? "",
      unit: p.default_unit || f.unit,
      category_id: p.category_id ?? f.category_id,
      image_path: f.image_path ?? p.image_path,
      catalog_product_id: p.id,
      save_to_catalog: false,
    }));
    setSuggestions([]);
    if (p.brand || p.variant) setShowMore(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, inventory_item_id: item?.inventory_item_id ?? null };
    const res = item ? await updateShoppingItem(item.id, payload, item.version) : await addShoppingItem(payload);
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    if ("merged" in res.data) {
      onSaved(res.data.item);
      toast.success(res.data.merged ? `"${form.name}" כבר ברשימה — הכמות עודכנה` : "נוסף לרשימה");
    } else {
      onSaved(res.data);
      toast.success("נשמר");
    }
    onOpenChange(false);
  }

  async function remove() {
    if (!item) return;
    const res = await deleteShoppingItem(item.id);
    if (!res.ok) return void toast.error(res.error);
    onDeleted?.(item.id);
    onOpenChange(false);
    toast("הפריט הוסר", {
      action: {
        label: "ביטול",
        onClick: async () => {
          const r = await restoreShoppingItem(item.id);
          if (r.ok) onSaved({ ...item, deleted_at: null, version: item.version + 1 });
        },
      },
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "עריכת פריט" : "הוספה לרשימה"}
      description={item && addedByName ? `נוסף על ידי ${addedByName}` : undefined}
      footer={
        <div className="flex gap-2">
          {item && (
            <Button type="button" variant="danger-ghost" size="icon" onClick={remove} aria-label="מחיקה">
              <Trash2 />
            </Button>
          )}
          <Button type="submit" form="grocery-item-form" size="lg" className="flex-1" loading={saving}>
            {item ? "שמירה" : "הוספה לרשימה"}
          </Button>
        </div>
      }
    >
      <form id="grocery-item-form" onSubmit={submit} className="space-y-4">
        <Field label="מה צריך?" htmlFor="gi-name" error={errors.name}>
          <div className="relative">
            <Input
              id="gi-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, catalog_product_id: null }))}
              placeholder="חלב, לחם, אבקת כביסה…"
              autoComplete="off"
              autoFocus={!item}
              maxLength={120}
              required
            />
            {suggestions.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-2xl border border-border bg-surface shadow-lift">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => pickSuggestion(s)} className="flex w-full items-center gap-3 px-3 py-2 text-start hover:bg-surface-2">
                      {s.image_path ? (
                        <SignedImage path={s.image_path} alt="" className="size-9 rounded-lg" />
                      ) : (
                        <span className="size-9 rounded-lg bg-surface-2" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{s.name}</span>
                        {(s.brand || s.variant) && <span className="block truncate text-xs text-muted">{[s.brand, s.variant].filter(Boolean).join(" · ")}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>

        <div className="flex items-end gap-3">
          <Field label="כמות" className="flex-1" error={errors.quantity}>
            <div className="flex h-12 items-center rounded-2xl border border-border bg-surface">
              <button type="button" className="grid size-12 place-items-center text-muted" aria-label="הפחתה" onClick={() => set("quantity", form.quantity > 1 ? +(form.quantity - 1).toFixed(3) : form.quantity)}>
                <Minus className="size-4" />
              </button>
              <input
                aria-label="כמות"
                inputMode="decimal"
                className="num w-full bg-transparent text-center text-lg font-medium outline-none"
                value={form.quantity}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(",", "."));
                  if (!Number.isNaN(n)) set("quantity", n);
                }}
              />
              <button type="button" className="grid size-12 place-items-center text-muted" aria-label="הוספה" onClick={() => set("quantity", +(form.quantity + 1).toFixed(3))}>
                <Plus className="size-4" />
              </button>
            </div>
          </Field>
          <Field label="יחידה" className="w-32">
            <Select value={form.unit} onChange={(e) => set("unit", e.target.value)}>
              {[...new Set([form.unit, ...UNITS])].map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="קטגוריה">
          <div className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => set("category_id", form.category_id === c.id ? "" : c.id)}
                aria-pressed={form.category_id === c.id}
                className={cn(
                  "h-9 shrink-0 rounded-full border px-3.5 text-sm transition-all",
                  form.category_id === c.id ? "border-primary bg-primary-soft font-medium text-primary" : "border-border text-muted",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </Field>

        <Field label="תמונה" hint="תמונה עוזרת לזהות בדיוק את המוצר הנכון בסופר">
          <PhotoPicker householdId={householdId} module="grocery" value={form.image_path} onChange={(p) => set("image_path", p)} />
        </Field>

        <button
          type="button"
          onClick={() => set("priority", form.priority === "high" ? "normal" : "high")}
          aria-pressed={form.priority === "high"}
          className={cn(
            "flex h-11 w-full items-center gap-2 rounded-2xl border px-4 text-sm transition-all",
            form.priority === "high" ? "border-danger/40 bg-danger-soft text-danger" : "border-border text-muted",
          )}
        >
          <Flag className="size-4" /> {form.priority === "high" ? "דחוף" : "סימון כדחוף"}
        </button>

        {!showMore ? (
          <button type="button" className="text-sm font-medium text-primary" onClick={() => setShowMore(true)}>
            + מותג, סוג והערות
          </button>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="מותג מועדף" error={errors.brand}>
                <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="תנובה" maxLength={80} />
              </Field>
              <Field label="סוג / גרסה" error={errors.variant}>
                <Input value={form.variant} onChange={(e) => set("variant", e.target.value)} placeholder="3%, 1 ליטר" maxLength={80} />
              </Field>
            </div>
            <Field label="הערות" error={errors.notes}>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="רק אם יש במבצע…" maxLength={1000} className="min-h-20" />
            </Field>
          </div>
        )}

        {!form.catalog_product_id && (
          <label className="flex items-center gap-3 text-sm text-muted">
            <input type="checkbox" checked={form.save_to_catalog} onChange={(e) => set("save_to_catalog", e.target.checked)} className="size-4 accent-[var(--primary)]" />
            לשמור את המוצר בקטלוג הבית לשימוש חוזר
          </label>
        )}
      </form>
    </Sheet>
  );
}
