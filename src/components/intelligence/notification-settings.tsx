"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setPreference } from "@/server/actions/intelligence";
import { PageHeader } from "@/components/layout/page-header";
import { Field, Input, Select } from "@/components/ui/field";
import { Panel, PanelHeading } from "@/components/ui/panel";

const CATEGORIES: { key: string; label: string; description: string }[] = [
  { key: "low_stock", label: "מוצר נגמר", description: "רק כשמוצר נגמר לגמרי" },
  { key: "expiring", label: "תוקף שפג היום", description: "מוצרים שתוקפם מסתיים" },
  { key: "chore_due", label: "המשימות שלי להיום", description: "משימות שמוטלות עליך או משותפות" },
  { key: "overdue_chore", label: "משימות באיחור", description: "" },
  { key: "warranty", label: "אחריות שמסתיימת", description: "חודש לפני סוף האחריות" },
  { key: "bill_due", label: "חשבון לתשלום", description: "כמה ימים לפני מועד התשלום" },
  { key: "bill_unusual", label: "חשבון חריג", description: "צריכה או סכום גבוהים מהרגיל" },
  { key: "document_expiry", label: "מסמך שפג תוקפו", description: "ביטוחים, חוזים" },
];

export function NotificationSettings({ prefs }: { prefs: Record<string, unknown> }) {
  const [values, setValues] = useState<Record<string, unknown>>(prefs);
  const quiet = (values["notify.quiet_hours"] as { from?: string; to?: string } | undefined) ?? { from: "22:00", to: "07:00" };

  async function save(key: string, value: boolean | string | Record<string, string>) {
    setValues((v) => ({ ...v, [key]: value }));
    const res = await setPreference({ key, value, personal: true });
    if (!res.ok) toast.error(res.error);
  }

  return (
    <>
      <PageHeader title="הגדרות התראות" back={{ href: "/notifications", label: "התראות" }} subtitle="אישי — לא משפיע על בן/בת הזוג" />
      <div className="space-y-6">
        <section>
          <PanelHeading title="על מה להתריע" />
          <Panel>
            {CATEGORIES.map((c) => (
              <label key={c.key} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
                <span>
                  <span className="block">{c.label}</span>
                  {c.description && <span className="footnote block text-muted">{c.description}</span>}
                </span>
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--primary)]"
                  checked={values[`notify.${c.key}`] !== false}
                  onChange={(e) => save(`notify.${c.key}`, e.target.checked)}
                />
              </label>
            ))}
          </Panel>
        </section>

        <section>
          <PanelHeading title="שעות שקטות" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="מ־" htmlFor="q-from">
              <Input id="q-from" type="time" value={quiet.from ?? "22:00"} onChange={(e) => save("notify.quiet_hours", { ...quiet, from: e.target.value } as Record<string, string>)} />
            </Field>
            <Field label="עד" htmlFor="q-to">
              <Input id="q-to" type="time" value={quiet.to ?? "07:00"} onChange={(e) => save("notify.quiet_hours", { ...quiet, to: e.target.value } as Record<string, string>)} />
            </Field>
          </div>
        </section>

        <section>
          <PanelHeading title="תדירות" />
          <Select aria-label="תדירות" value={(values["notify.digest"] as string) ?? "instant"} onChange={(e) => save("notify.digest", e.target.value)}>
            <option value="instant">מיד כשמשהו קורה</option>
            <option value="daily">סיכום אחד בבוקר</option>
            <option value="important">רק דברים חשובים</option>
          </Select>
        </section>

        <p className="footnote px-1 text-muted">
          ההתראות מופיעות בתוך האפליקציה. שעות שקטות חלות על התראות דחיפה, שדורשות הגדרת מפתחות Web Push בשרת; עד אז הן לא נשלחות. באייפון, התראות דחיפה עובדות רק כשהאפליקציה מותקנת למסך הבית (iOS 16.4 ומעלה).
        </p>
      </div>
    </>
  );
}
