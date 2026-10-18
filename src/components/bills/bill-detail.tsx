"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteBill, setBillPaid } from "@/server/actions/admin";
import type { UtilityBill } from "@/lib/types";
import { BILL_CATEGORY } from "@/lib/labels";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/sheet";
import { Panel, PanelHeading } from "@/components/ui/panel";
import { BillSheet } from "./bill-sheet";
import { BillIcon, billStatus } from "./bills-view";

export function BillDetail({ bill: b, comparison, history }: { bill: UtilityBill; comparison: string | null; history: Pick<UtilityBill, "id" | "period_end" | "amount" | "consumption">[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<false | "edit" | "verify">(false);
  const [confirm, setConfirm] = useState(false);
  const cat = BILL_CATEGORY[b.category] ?? BILL_CATEGORY.other;
  const s = billStatus(b);
  const uncertain = ((b.extraction as { uncertain?: string[] } | null)?.uncertain ?? []).filter(Boolean);

  const rows: [string, string | null][] = [
    ["ספק", b.provider_name],
    ["מס׳ חוזה / חשבון", b.account_ref],
    ["תקופה", b.period_start && b.period_end ? `${formatShortDate(b.period_start)} – ${formatShortDate(b.period_end)}` : null],
    ["צריכה", b.consumption != null ? `${b.consumption} ${b.consumption_unit ?? cat.unit ?? ""}` : null],
    ["חיובים קבועים", b.fixed_charges != null ? formatCurrency(Number(b.fixed_charges)) : null],
    ["הופק", b.issue_date ? formatShortDate(b.issue_date) : null],
    ["לתשלום עד", b.due_on ? formatShortDate(b.due_on) : null],
    ["שולם", b.paid_on ? formatShortDate(b.paid_on) : null],
    ["מקור", b.source === "upload" ? "קובץ שהועלה" : b.source === "email" ? "מייל" : b.source === "api" ? "חיבור לספק" : "הזנה ידנית"],
  ];

  return (
    <>
      <PageHeader
        title={`${cat.label}${b.provider_name ? ` · ${b.provider_name}` : ""}`}
        back={{ href: "/bills", label: "חשבונות" }}
        actions={
          <Button size="icon-sm" variant="secondary" onClick={() => setEdit("edit")} aria-label="עריכה">
            <Pencil />
          </Button>
        }
      />
      <div className="space-y-6 pb-10">
        <section className="flex items-center gap-3">
          <BillIcon category={b.category} />
          <div>
            <p className="num text-[30px] font-extrabold leading-none">{formatCurrency(Number(b.amount), b.currency)}</p>
            <div className="mt-1.5 flex gap-1.5">
              <Badge tone={s.tone}>{s.text}</Badge>
              {!b.verified && <Badge tone="sky">לא אומת</Badge>}
            </div>
          </div>
        </section>

        {b.import_status === "needs_review" && (
          <section className="space-y-2 rounded-[var(--radius)] border border-sky/40 bg-sky-soft p-4">
            <p className="flex gap-2 text-[15px]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> הנתונים נקראו אוטומטית מהקובץ ועדיין לא אומתו. השוו למסמך המקורי ואשרו.
            </p>
            {uncertain.length > 0 && <p className="footnote text-muted">לא ברור: {uncertain.join(" · ")}</p>}
            <Button onClick={() => setEdit("verify")}>בדיקה ואישור</Button>
          </section>
        )}

        {comparison && (
          <Panel>
            <div className="px-4 py-3">
              <p className="footnote mb-1 text-muted">השוואה</p>
              <p className="text-[15px]">{comparison}</p>
            </div>
          </Panel>
        )}

        <Panel>
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-3 text-[15px]">
                <span className="text-muted">{k}</span>
                <span className="text-end">{v}</span>
              </div>
            ))}
          {b.notes && <p className="px-4 py-3 text-[15px] whitespace-pre-wrap">{b.notes}</p>}
        </Panel>

        <section className="flex flex-wrap gap-2">
          {b.payment_status !== "autopay" && (
            <Button
              variant={b.payment_status === "paid" ? "secondary" : "primary"}
              onClick={async () => {
                const r = await setBillPaid(b.id, b.payment_status !== "paid");
                if (!r.ok) return void toast.error(r.error);
                router.refresh();
              }}
            >
              {b.payment_status === "paid" ? "סימון כלא שולם" : "שולם ✓"}
            </Button>
          )}
          {b.document_id && (
            <Link href={`/documents/${b.document_id}`} className="pressable inline-flex h-11 items-center gap-1.5 rounded-full bg-fill px-5 text-[17px] font-semibold">
              <FileText className="size-[18px]" /> המסמך המקורי
            </Link>
          )}
        </section>

        {history.length > 1 && (
          <section>
            <PanelHeading title={`חשבונות ${cat.label} קודמים`} />
            <Panel>
              {history.map((h) => (
                <Link key={h.id} href={`/bills/${h.id}`} className={`flex justify-between px-4 py-3 text-[15px] ${h.id === b.id ? "font-semibold" : ""}`}>
                  <span>{h.period_end ? formatShortDate(h.period_end) : "—"}</span>
                  <span className="num">
                    {formatCurrency(Number(h.amount))}
                    {h.consumption != null ? <span className="text-muted"> · {h.consumption}</span> : null}
                  </span>
                </Link>
              ))}
            </Panel>
          </section>
        )}

        <Button variant="danger-ghost" className="w-full" onClick={() => setConfirm(true)}>
          <Trash2 /> מחיקת החשבון
        </Button>
      </div>
      <BillSheet open={!!edit} onOpenChange={(o) => !o && setEdit(false)} bill={b} verifying={edit === "verify"} />
      <ConfirmSheet
        open={confirm}
        onOpenChange={setConfirm}
        title="למחוק את החשבון?"
        description="הקובץ יישאר בכספת המסמכים."
        confirmLabel="מחיקה"
        destructive
        onConfirm={async () => {
          const r = await deleteBill(b.id);
          if (!r.ok) return void toast.error(r.error);
          router.push("/bills");
        }}
      />
    </>
  );
}
