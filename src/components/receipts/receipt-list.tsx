"use client";

import { ReceiptText } from "lucide-react";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, EmptyState } from "@/components/ui/card";
import { Panel, PanelHeading, PanelRow } from "@/components/ui/panel";
import { ReceiptCapture } from "./receipt-capture";

const STATUS = {
  extracted: { label: "ממתין לאישור", tone: "amber" },
  confirmed: { label: "עודכן במלאי", tone: "sage" },
  discarded: { label: "בוטל", tone: "neutral" },
  failed: { label: "לא נקרא", tone: "danger" },
} as const;

export function ReceiptList({
  householdId,
  configured,
  receipts,
}: {
  householdId: string;
  configured: boolean;
  receipts: { id: string; store: string | null; purchased_on: string | null; total: number | null; currency: string; status: keyof typeof STATUS; created_at: string }[];
}) {
  return (
    <>
      <PageHeader title="קבלות" back={{ href: "/inventory", label: "מלאי" }} subtitle="אחרי קנייה: מצלמים, מאשרים, והמלאי מתעדכן" />
      <div className="space-y-6">
        <ReceiptCapture householdId={householdId} configured={configured} />
        {!configured && <p className="rounded-2xl bg-amber-soft px-3 py-2.5 text-[14px] text-amber">קריאת קבלות דורשת חיבור ל-AI (מפתח API בהגדרות השרת).</p>}
        {receipts.length === 0 ? (
          <EmptyState icon={<ReceiptText />} title="עוד אין קבלות" description="צלמו קבלה מהסופר. נזהה את המוצרים, תאשרו, והמלאי יתעדכן. אותה קבלה לא תיספר פעמיים." />
        ) : (
          <section>
            <PanelHeading title="קבלות אחרונות" count={receipts.length} />
            <Panel>
              {receipts.map((r) => (
                <PanelRow
                  key={r.id}
                  href={`/receipts/${r.id}`}
                  leading={<span aria-hidden className="cat-tint grid size-11 shrink-0 place-items-center rounded-[14px] text-[22px]" style={{ "--h": 55 } as React.CSSProperties}>🧾</span>}
                  title={r.store ?? "קבלה"}
                  subtitle={[r.purchased_on ? formatShortDate(r.purchased_on) : formatShortDate(r.created_at), r.total != null ? formatCurrency(Number(r.total), r.currency) : null].filter(Boolean).join(" · ")}
                  trailing={<Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>}
                />
              ))}
            </Panel>
          </section>
        )}
      </div>
    </>
  );
}
