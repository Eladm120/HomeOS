"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { confirmReceipt, discardReceipt, updateReceiptLines } from "@/server/actions/receipts";
import { getSignedUrl } from "@/lib/media";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/sheet";
import { Input, Select } from "@/components/ui/field";
import { Panel, PanelHeading } from "@/components/ui/panel";

export interface ReceiptLineView {
  id: string;
  raw_name: string;
  quantity: number | null;
  unit: string | null;
  total_price: number | null;
  inventory_item_id: string | null;
  shopping_item_id: string | null;
  match_confidence: number | null;
  decision: "review" | "stock" | "new" | "ignore";
}

export interface ReceiptView {
  id: string;
  store: string | null;
  purchased_on: string | null;
  total: number | null;
  currency: string;
  status: "extracted" | "confirmed" | "discarded" | "failed";
  notice: string | null;
  file_path: string;
}

/** Decision per line: stock an existing product, create a new one, or ignore. */
export function ReceiptReview({
  receipt,
  lines: initial,
  inventory,
  shoppingNames,
}: {
  receipt: ReceiptView;
  lines: ReceiptLineView[];
  inventory: { id: string; name: string; unit: string }[];
  shoppingNames: Record<string, string>;
}) {
  const router = useRouter();
  const [lines, setLines] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const editable = receipt.status === "extracted";
  const pendingReview = lines.filter((l) => l.decision === "review").length;
  const toStock = lines.filter((l) => l.decision === "stock" || l.decision === "new").length;

  const set = (id: string, patch: Partial<ReceiptLineView>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  function choose(id: string, value: string) {
    if (value === "__new") set(id, { decision: "new", inventory_item_id: null });
    else if (value === "__ignore") set(id, { decision: "ignore" });
    else if (value === "") set(id, { decision: "review" });
    else set(id, { decision: "stock", inventory_item_id: value });
  }

  async function confirm() {
    setSaving(true);
    const saved = await updateReceiptLines(
      receipt.id,
      lines.map((l) => ({ id: l.id, decision: l.decision, inventory_item_id: l.inventory_item_id, quantity: Number(l.quantity) > 0 ? Number(l.quantity) : 1 })),
    );
    if (!saved.ok) {
      setSaving(false);
      return void toast.error(saved.error);
    }
    const res = await confirmReceipt(receipt.id);
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`המלאי עודכן: ${res.data.stocked} מוצרים`);
    router.push("/inventory");
  }

  async function openFile() {
    const url = await getSignedUrl(receipt.file_path);
    if (url) window.open(url, "_blank", "noopener");
  }

  return (
    <>
      <PageHeader
        title={receipt.store ?? "קבלה"}
        back={{ href: "/receipts", label: "קבלות" }}
        subtitle={[receipt.purchased_on ? formatShortDate(receipt.purchased_on) : null, receipt.total != null ? formatCurrency(Number(receipt.total), receipt.currency) : null, `${lines.length} שורות`].filter(Boolean).join(" · ")}
      />
      <div className="space-y-5 pb-28">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={receipt.status === "confirmed" ? "sage" : receipt.status === "failed" ? "danger" : receipt.status === "discarded" ? "neutral" : "amber"}>
            {receipt.status === "confirmed" ? "עודכן במלאי" : receipt.status === "failed" ? "הקריאה נכשלה" : receipt.status === "discarded" ? "בוטל" : "ממתין לאישור"}
          </Badge>
          <button type="button" onClick={openFile} className="footnote flex items-center gap-1 font-medium text-primary">
            הקבלה המקורית <ExternalLink className="size-3.5" />
          </button>
        </div>
        {receipt.notice && (
          <p className="flex gap-2 rounded-2xl bg-amber-soft px-3 py-2.5 text-[14px] text-amber">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {receipt.notice}
          </p>
        )}
        {editable && <p className="text-[15px] text-muted">בדקו כל שורה: לאיזה מוצר במלאי היא שייכת, מוצר חדש, או להתעלם. שום דבר לא מתעדכן עד שתאשרו.</p>}

        {lines.length > 0 && (
          <section>
            <PanelHeading title="מוצרים בקבלה" count={lines.length} action={pendingReview ? <Badge tone="amber">{pendingReview} לבדיקה</Badge> : undefined} />
            <Panel>
              {lines.map((l) => (
                <div key={l.id} className={cn("space-y-2 px-4 py-3", l.decision === "review" && "bg-amber-soft/50", l.decision === "ignore" && "opacity-60")}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{l.raw_name}</span>
                    {l.total_price != null && <span className="num text-[14px] text-muted">{formatCurrency(Number(l.total_price))}</span>}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      aria-label="כמות"
                      inputMode="decimal"
                      value={l.quantity ?? ""}
                      disabled={!editable || l.decision === "ignore"}
                      onChange={(e) => set(l.id, { quantity: e.target.value as unknown as number })}
                      className="w-20 px-2 text-center"
                    />
                    <Select
                      aria-label="לאן זה הולך"
                      disabled={!editable}
                      value={l.decision === "new" ? "__new" : l.decision === "ignore" ? "__ignore" : l.decision === "review" ? "" : (l.inventory_item_id ?? "")}
                      onChange={(e) => choose(l.id, e.target.value)}
                    >
                      <option value="">— לבחור —</option>
                      <option value="__new">מוצר חדש במלאי</option>
                      <option value="__ignore">לא לעדכן במלאי</option>
                      <optgroup label="מוצר קיים במלאי">
                        {inventory.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.unit})
                          </option>
                        ))}
                      </optgroup>
                    </Select>
                  </div>
                  {l.shopping_item_id && shoppingNames[l.shopping_item_id] && <p className="footnote text-sage">✓ יסומן כנקנה ברשימה: {shoppingNames[l.shopping_item_id]}</p>}
                  {l.decision === "review" && l.inventory_item_id && <p className="footnote text-amber">ייתכן שזה {inventory.find((i) => i.id === l.inventory_item_id)?.name}. אשרו או בחרו אחר.</p>}
                </div>
              ))}
            </Panel>
          </section>
        )}

        {editable && (
          <Button variant="danger-ghost" className="w-full" onClick={() => setConfirmDiscard(true)}>
            ביטול הקבלה
          </Button>
        )}
      </div>

      {editable && lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(max(0.35rem,env(safe-area-inset-bottom))+74px)] z-30 px-3 lg:start-72 lg:bottom-6">
          <div className="mx-auto max-w-md lg:max-w-xl">
            <Button size="lg" className="w-full shadow-lift" disabled={pendingReview > 0} loading={saving} onClick={confirm}>
              {pendingReview ? `נשארו ${pendingReview} שורות לבדיקה` : `אישור ועדכון ${toStock} מוצרים במלאי`}
            </Button>
          </div>
        </div>
      )}

      <ConfirmSheet
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="לבטל את הקבלה?"
        description="המלאי לא יתעדכן. אפשר לצלם אותה שוב אחר כך."
        confirmLabel="ביטול הקבלה"
        destructive
        onConfirm={async () => {
          const r = await discardReceipt(receipt.id);
          if (!r.ok) return void toast.error(r.error);
          router.push("/receipts");
        }}
      />
    </>
  );
}
