"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { bulkCreateInventory } from "@/server/actions/inventory";
import { parseBulkText, type ParsedBulkLine } from "@/lib/validation";
import type { InventoryLocation, ProductCategory } from "@/lib/types";
import { UNITS } from "@/lib/grocery";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";

const DRAFT_KEY = (hid: string) => `homeos:inventory-setup-draft:${hid}`;

interface Draft {
  text: string;
  locationId: string;
  categoryId: string;
}

/**
 * Guided initial inventory: paste a list per storage location, review the
 * parsed rows, import. Draft text is kept on this device until imported.
 */
export function BulkSetup({
  householdId,
  locations,
  categories,
  existingCount,
}: {
  householdId: string;
  locations: InventoryLocation[];
  categories: ProductCategory[];
  existingCount: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({ text: "", locationId: locations[0]?.id ?? "", categoryId: "" });
  const [rows, setRows] = useState<ParsedBulkLine[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [imported, setImported] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY(householdId));
      if (raw) setDraft((d) => ({ ...d, ...(JSON.parse(raw) as Partial<Draft>) }));
    } catch {
      /* storage unavailable */
    }
  }, [householdId]);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY(householdId), JSON.stringify(draft));
    } catch {
      /* storage unavailable */
    }
  }, [draft, householdId]);

  const lineCount = useMemo(() => draft.text.split(/\r?\n/).filter((l) => l.trim()).length, [draft.text]);

  function review() {
    const parsed = parseBulkText(draft.text);
    if (!parsed.length) return void toast.error("לא נמצאו מוצרים בטקסט");
    setRows(parsed);
  }

  function updateRow(idx: number, patch: Partial<ParsedBulkLine>) {
    setRows((rs) => rs!.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function importRows() {
    if (!rows?.length) return;
    setSaving(true);
    let created = 0;
    const skipped: string[] = [];
    for (let i = 0; i < rows.length; i += 50) {
      const res = await bulkCreateInventory({
        lines: rows.slice(i, i + 50),
        location_id: draft.locationId || null,
        category_id: draft.categoryId || null,
      });
      if (!res.ok) {
        setSaving(false);
        return void toast.error(res.error);
      }
      created += res.data.created;
      skipped.push(...res.data.skipped);
    }
    setSaving(false);
    setImported((n) => n + created);
    toast.success(`${created} מוצרים נוספו למלאי${skipped.length ? ` · ${skipped.length} כבר היו קיימים ודולגו` : ""}`);
    setRows(null);
    setDraft((d) => ({ ...d, text: "" }));
    router.refresh();
  }

  return (
    <div className="space-y-4 pb-8">
      <Card className="p-5">
        <p className="text-sm leading-relaxed text-muted">
          עברו מקום אחרי מקום — מקרר, מקפיא, מזווה — והדביקו או הקלידו את מה שיש, שורה לכל מוצר. אפשר לכתוב כמות ויחידה:
        </p>
        <pre className="mt-3 rounded-2xl bg-surface-2 p-3 text-sm leading-7 text-foreground/80">{`חלב 2 ליטר\nביצים 12\nגבינה צהובה\nאורז, 2, ק״ג`}</pre>
        {(existingCount > 0 || imported > 0) && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-sage">
            <CheckCircle2 className="size-4" /> כבר במלאי: <span className="num">{existingCount}</span> מוצרים. הטיוטה נשמרת במכשיר — אפשר להמשיך בכל זמן.
          </p>
        )}
      </Card>

      {!rows ? (
        <Card>
          <CardHeader title="מה יש כאן?" />
          <div className="space-y-4 px-5 pb-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="מיקום">
                <Select value={draft.locationId} onChange={(e) => setDraft((d) => ({ ...d, locationId: e.target.value }))}>
                  <option value="">ללא מיקום</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="קטגוריה (לא חובה)">
                <Select value={draft.categoryId} onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}>
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Textarea
              aria-label="רשימת מוצרים"
              value={draft.text}
              onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              placeholder={"חלב 2 ליטר\nביצים 12\n…"}
              className="min-h-56 leading-7"
            />
            <Button size="lg" className="w-full" onClick={review} disabled={!lineCount}>
              <Wand2 /> בדיקת {lineCount || ""} שורות
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader title="בדיקה לפני שמירה" subtitle={`${rows.length} מוצרים · ${locations.find((l) => l.id === draft.locationId)?.name ?? "ללא מיקום"}`} />
          <ul className="divide-y divide-border/60 px-3">
            {rows.map((r, idx) => (
              <li key={idx} className="flex items-center gap-2 py-2">
                <input
                  aria-label="שם"
                  value={r.name}
                  onChange={(e) => updateRow(idx, { name: e.target.value })}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 hover:border-border focus:border-ring focus:outline-none"
                />
                <input
                  aria-label="כמות"
                  inputMode="decimal"
                  value={r.quantity}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    if (!Number.isNaN(n)) updateRow(idx, { quantity: n });
                  }}
                  className="num h-10 w-14 rounded-xl border border-border bg-surface text-center"
                />
                <select
                  aria-label="יחידה"
                  value={r.unit}
                  onChange={(e) => updateRow(idx, { unit: e.target.value })}
                  className="h-10 w-20 rounded-xl border border-border bg-surface px-1 text-sm"
                >
                  {[...new Set([r.unit, ...UNITS])].map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs!.filter((_, i) => i !== idx))}
                  className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
                  aria-label={`הסרת ${r.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 p-5">
            <Button variant="ghost" onClick={() => setRows(null)}>
              חזרה לעריכה
            </Button>
            <Button className="flex-1" size="lg" onClick={importRows} loading={saving} disabled={!rows.length}>
              שמירת {rows.length} מוצרים
            </Button>
          </div>
        </Card>
      )}

      <Button variant="outline" className="w-full" onClick={() => router.push("/inventory")}>
        סיימתי — למלאי
      </Button>
    </div>
  );
}
