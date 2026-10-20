"use client";

import { Emoji3D } from "@/components/ui/emoji-3d";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { importBill } from "@/server/actions/admin";
import type { UtilityBill } from "@/lib/types";
import { BILL_CATEGORY } from "@/lib/labels";
import { daysUntil, formatCurrency, formatShortDate } from "@/lib/format";
import { uploadHouseholdFile, uploadHouseholdImage, validateImageFile } from "@/lib/media";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeading, PanelRow } from "@/components/ui/panel";
import { BillSheet } from "./bill-sheet";
import { CategoryBars, MonthBars } from "./month-bars";

export interface BillInsight {
  billId: string;
  category: string;
  text: string;
  verdict: "higher" | "lower" | "similar";
}

export function BillIcon({ category }: { category: string }) {
  const c = BILL_CATEGORY[category] ?? BILL_CATEGORY.other;
  return (
    <span aria-hidden className="cat-tint grid size-11 shrink-0 place-items-center rounded-[14px] text-[22px]" style={{ "--h": c.hue } as React.CSSProperties}>
      <Emoji3D emoji={c.emoji} className="size-[72%]" />
    </span>
  );
}

export function billStatus(b: Pick<UtilityBill, "payment_status" | "due_on" | "import_status">): { text: string; tone: "sage" | "amber" | "danger" | "neutral" | "sky" } {
  if (b.import_status === "needs_review") return { text: "לבדיקה", tone: "sky" };
  if (b.payment_status === "paid") return { text: "שולם", tone: "sage" };
  if (b.payment_status === "autopay") return { text: "הוראת קבע", tone: "neutral" };
  if (b.due_on && daysUntil(b.due_on) < 0) return { text: "באיחור", tone: "danger" };
  if (b.due_on && daysUntil(b.due_on) <= 7) return { text: `עד ${formatShortDate(b.due_on)}`, tone: "amber" };
  return { text: "לתשלום", tone: "neutral" };
}

export function BillsView({
  householdId,
  bills,
  monthly,
  ytd,
  thisMonth,
  byCategory,
  insights,
  aiEnabled,
}: {
  householdId: string;
  bills: UtilityBill[];
  monthly: { month: string; total: number }[];
  ytd: number;
  thisMonth: number;
  byCategory: { key: string; label: string; emoji: string; total: number }[];
  insights: BillInsight[];
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);

  async function upload(f: File | undefined) {
    if (!f) return;
    try {
      const isPdf = f.type === "application/pdf";
      if (!isPdf) {
        const problem = validateImageFile(f);
        if (problem) throw new Error(problem);
      }
      setBusy(true);
      const path = isPdf ? (await uploadHouseholdFile(householdId, "bills", f)).path : await uploadHouseholdImage(householdId, "bills", f);
      const res = await importBill({ file_path: path, mime_type: isPdf ? "application/pdf" : path.endsWith(".webp") ? "image/webp" : "image/jpeg", file_name: f.name.slice(0, 200), size_bytes: f.size });
      if (!res.ok) throw new Error(res.error);
      toast.success("החשבון נקרא. בדקו את הנתונים.");
      router.push(`/bills/${res.data.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const review = bills.filter((b) => b.import_status === "needs_review");
  const due = bills.filter((b) => b.payment_status === "unpaid" && b.import_status === "confirmed");

  return (
    <>
      <PageHeader title="חשבונות" back={{ href: "/household", label: "משק הבית" }} subtitle="חשמל, מים, ארנונה ועוד — מעקב וניתוח" />
      <div className="space-y-6 pb-10">
        <div className="grid grid-cols-2 gap-2">
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <Button disabled={busy || !aiEnabled} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 className="animate-spin" /> : <FileUp />} {busy ? "קורא…" : "העלאת חשבון"}
          </Button>
          <Button variant="secondary" onClick={() => setManual(true)}>
            <Plus /> הזנה ידנית
          </Button>
        </div>
        {!aiEnabled && <p className="footnote -mt-3 text-muted">קריאת חשבון מ-PDF דורשת חיבור ל-AI. בינתיים אפשר להזין ידנית.</p>}

        {bills.length === 0 ? (
          <EmptyState icon={<Receipt />} title="עוד אין חשבונות" description="העלו את חשבון החשמל או המים האחרון (PDF או צילום). נשמור את הקובץ בכספת ונשווה לתקופות קודמות." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                <p className="footnote text-muted">החודש</p>
                <p className="num text-[24px] font-extrabold">{formatCurrency(Math.round(thisMonth))}</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                <p className="footnote text-muted">מתחילת השנה</p>
                <p className="num text-[24px] font-extrabold">{formatCurrency(Math.round(ytd))}</p>
              </div>
            </div>

            {review.length > 0 && (
              <section>
                <PanelHeading title="ממתינים לבדיקה" count={review.length} />
                <Panel>
                  {review.map((b) => (
                    <PanelRow key={b.id} href={`/bills/${b.id}`} leading={<BillIcon category={b.category} />} title={b.provider_name ?? BILL_CATEGORY[b.category].label} subtitle="נקרא אוטומטית — יש לאשר את הנתונים" trailing={<span className="num">{formatCurrency(Number(b.amount))}</span>} />
                  ))}
                </Panel>
              </section>
            )}

            {insights.length > 0 && (
              <section>
                <PanelHeading title="מה השתנה" />
                <Panel>
                  {insights.map((i) => (
                    <Link key={i.billId} href={`/bills/${i.billId}`} className="flex gap-3 px-4 py-3 active:bg-fill">
                      <BillIcon category={i.category} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 font-medium">
                          {BILL_CATEGORY[i.category]?.label ?? i.category}
                          {i.verdict !== "similar" && <Badge tone={i.verdict === "higher" ? "amber" : "sage"}>{i.verdict === "higher" ? "עלייה" : "ירידה"}</Badge>}
                        </span>
                        <span className="footnote mt-0.5 block text-muted">{i.text}</span>
                      </span>
                    </Link>
                  ))}
                </Panel>
              </section>
            )}

            <MonthBars data={monthly} title="הוצאה חודשית על חשבונות" />
            {byCategory.length > 1 && (
              <section>
                <PanelHeading title="לפי סוג (מתחילת השנה)" />
                <CategoryBars rows={byCategory} />
              </section>
            )}

            {due.length > 0 && (
              <section>
                <PanelHeading title="לתשלום" count={due.length} />
                <Panel>
                  {due.map((b) => {
                    const s = billStatus(b);
                    return <PanelRow key={b.id} href={`/bills/${b.id}`} leading={<BillIcon category={b.category} />} title={`${b.provider_name ?? BILL_CATEGORY[b.category].label} · ${formatCurrency(Number(b.amount))}`} trailing={<Badge tone={s.tone}>{s.text}</Badge>} />;
                  })}
                </Panel>
              </section>
            )}

            <section>
              <PanelHeading title="כל החשבונות" count={bills.length} />
              <Panel>
                {bills.map((b) => {
                  const s = billStatus(b);
                  return (
                    <PanelRow
                      key={b.id}
                      href={`/bills/${b.id}`}
                      leading={<BillIcon category={b.category} />}
                      title={b.provider_name ?? BILL_CATEGORY[b.category].label}
                      subtitle={[b.period_start && b.period_end ? `${formatShortDate(b.period_start)}–${formatShortDate(b.period_end)}` : null, b.consumption != null ? `${b.consumption} ${b.consumption_unit ?? ""}` : null].filter(Boolean).join(" · ") || undefined}
                      trailing={
                        <>
                          <span className="num text-[15px]">{formatCurrency(Number(b.amount))}</span>
                          <Badge tone={s.tone}>{s.text}</Badge>
                        </>
                      }
                    />
                  );
                })}
              </Panel>
            </section>
          </>
        )}
      </div>
      <BillSheet open={manual} onOpenChange={setManual} bill={null} />
    </>
  );
}
