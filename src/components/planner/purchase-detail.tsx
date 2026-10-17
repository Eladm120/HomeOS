"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { chooseAlternative, deleteAlternative, deletePlannedPurchase, saveAlternative, setPlannedPurchaseStatus } from "@/server/actions/planner";
import type { Attachment, PlannedPurchase, PurchaseAlternative, Room } from "@/lib/types";
import { PRIORITY_LABEL, PURCHASE_STATUS, options } from "@/lib/labels";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { primeSignedUrls } from "@/lib/media";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Panel, PanelHeading } from "@/components/ui/panel";
import { PhotoPicker } from "@/components/media/photo-picker";
import { ImageViewer, SignedImage } from "@/components/media/signed-image";
import { AttachmentsPanel } from "@/components/media/attachments";
import { PurchaseSheet } from "./purchase-sheet";
import { PurchaseThumb } from "./planner-view";

const FLOW: PlannedPurchase["status"][] = ["idea", "researching", "considering", "ready", "purchased"];

export function PurchaseDetail({
  householdId,
  purchase: p,
  alternatives,
  attachments,
  rooms,
  projects,
  addedBy,
  signedUrls,
}: {
  householdId: string;
  purchase: PlannedPurchase;
  alternatives: PurchaseAlternative[];
  attachments: Attachment[];
  rooms: Room[];
  projects: { id: string; title: string }[];
  addedBy: string | null;
  signedUrls: Record<string, string>;
}) {
  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [altSheet, setAltSheet] = useState<PurchaseAlternative | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [busy, setBusy] = useState(false);

  const room = rooms.find((r) => r.id === p.room_id)?.name;
  const project = projects.find((x) => x.id === p.project_id)?.title;

  async function move(status: PlannedPurchase["status"]) {
    setBusy(true);
    const res = await setPlannedPurchaseStatus(p.id, status);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(status === "purchased" ? "סומן כנקנה" : `עבר ל"${PURCHASE_STATUS[status].label}"`);
    router.refresh();
  }

  async function remove() {
    const res = await deletePlannedPurchase(p.id);
    if (!res.ok) return void toast.error(res.error);
    router.push("/planner");
  }

  const columns = [{ key: "main", label: "האפשרות הנבחרת", ...p, isMain: true as const }, ...alternatives.map((a) => ({ key: a.id, label: "חלופה", ...a, isMain: false as const }))];
  const cheapest = Math.min(...columns.map((c) => (c.price != null ? Number(c.price) : Infinity)));
  const nextStatus = FLOW[FLOW.indexOf(p.status) + 1];

  return (
    <>
      <PageHeader
        title={p.name}
        back={{ href: "/planner", label: "תכנון רכישות" }}
        subtitle={[room, project ? `פרויקט: ${project}` : null].filter(Boolean).join(" · ") || undefined}
        actions={
          <Button size="icon-sm" variant="secondary" onClick={() => setEdit(true)} aria-label="עריכה">
            <Pencil />
          </Button>
        }
      />

      <div className="space-y-6">
        <section className="flex gap-4">
          {p.image_path ? (
            <button type="button" onClick={() => setViewer(true)} className="size-28 shrink-0 overflow-hidden rounded-[var(--radius)] border border-border" aria-label="הגדלת תמונה">
              <SignedImage path={p.image_path} alt={p.name} className="size-full" thumb={false} />
            </button>
          ) : (
            <PurchaseThumb p={p} className="size-28 rounded-[var(--radius)] text-[44px]" />
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <Badge tone={PURCHASE_STATUS[p.status].tone}>{PURCHASE_STATUS[p.status].label}</Badge>
            {p.price != null && <p className="num text-[24px] font-bold">{formatCurrency(Number(p.price) * p.quantity, p.currency)}</p>}
            <p className="footnote text-muted">
              {[p.store, p.quantity > 1 ? `${p.quantity} יח׳` : null, `עדיפות ${PRIORITY_LABEL[p.priority]}`].filter(Boolean).join(" · ")}
            </p>
            {p.url && (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[15px] font-medium text-primary">
                לעמוד המוצר <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        </section>

        <section className="flex flex-wrap gap-2">
          {nextStatus && p.status !== "canceled" && (
            <Button onClick={() => move(nextStatus)} loading={busy}>
              {nextStatus === "purchased" ? "סימון כנקנה" : `העברה ל"${PURCHASE_STATUS[nextStatus].label}"`}
            </Button>
          )}
          <Select aria-label="שינוי סטטוס" value={p.status} onChange={(e) => move(e.target.value as PlannedPurchase["status"])} className="h-11 w-auto min-w-36">
            {options(PURCHASE_STATUS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </section>

        {(p.dimensions || p.color || p.material || p.notes) && (
          <Panel>
            {[
              ["מידות", p.dimensions],
              ["צבע", p.color],
              ["חומר", p.material],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-3 text-[15px]">
                  <span className="text-muted">{k}</span>
                  <span className="text-end">{v}</span>
                </div>
              ))}
            {p.notes && <p className="px-4 py-3 text-[15px] whitespace-pre-wrap">{p.notes}</p>}
          </Panel>
        )}

        {/* Comparison */}
        <section>
          <PanelHeading
            title="השוואת חלופות"
            count={alternatives.length}
            action={
              <Button size="sm" variant="soft" onClick={() => setAltSheet("new")}>
                <Plus /> חלופה
              </Button>
            }
          />
          {alternatives.length === 0 ? (
            <p className="rounded-[var(--radius)] border border-dashed border-border p-4 text-center text-[15px] text-muted">הוסיפו מוצרים חלופיים כדי להשוות מחיר, מידות וחומר.</p>
          ) : (
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-max min-w-full border-separate border-spacing-0 overflow-hidden rounded-[var(--radius)] border border-border bg-surface text-[14px]">
                <thead>
                  <tr>
                    <th className="sticky start-0 z-10 w-24 bg-surface-2 p-3 text-start font-medium text-muted" />
                    {columns.map((c) => (
                      <th key={c.key} className="w-44 border-s border-border bg-surface-2 p-3 text-start align-top">
                        <span className="caption block font-medium text-muted">{c.label}</span>
                        <span className="block font-semibold">{c.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["תמונה", (c: (typeof columns)[number]) => (c.image_path ? <SignedImage path={c.image_path} alt={c.name} className="size-16 rounded-xl" /> : <span className="text-muted">—</span>)],
                      [
                        "מחיר",
                        (c: (typeof columns)[number]) =>
                          c.price != null ? (
                            <span className={Number(c.price) === cheapest && columns.length > 1 ? "font-bold text-sage" : ""}>{formatCurrency(Number(c.price), c.currency)}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          ),
                      ],
                      ["חנות", (c: (typeof columns)[number]) => c.store ?? "—"],
                      ["מידות", (c: (typeof columns)[number]) => c.dimensions ?? "—"],
                      ["חומר", (c: (typeof columns)[number]) => c.material ?? "—"],
                      ["צבע", (c: (typeof columns)[number]) => c.color ?? "—"],
                      ["הערות", (c: (typeof columns)[number]) => <span className="line-clamp-3 whitespace-pre-wrap">{c.notes ?? "—"}</span>],
                      [
                        "",
                        (c: (typeof columns)[number]) => (
                          <div className="flex flex-wrap gap-1.5">
                            {c.url && (
                              <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-primary" aria-label="קישור">
                                <ExternalLink className="size-4" />
                              </a>
                            )}
                            {!c.isMain && (
                              <>
                                <button
                                  type="button"
                                  className="font-semibold text-primary"
                                  onClick={async () => {
                                    const r = await chooseAlternative(p.id, c.key);
                                    if (!r.ok) return void toast.error(r.error);
                                    toast.success("החלופה נבחרה");
                                    router.refresh();
                                  }}
                                >
                                  לבחור בזה
                                </button>
                                <button type="button" className="text-muted" onClick={() => setAltSheet(alternatives.find((a) => a.id === c.key) ?? null)} aria-label="עריכת חלופה">
                                  <Pencil className="size-4" />
                                </button>
                              </>
                            )}
                          </div>
                        ),
                      ],
                    ] as [string, (c: (typeof columns)[number]) => React.ReactNode][]
                  ).map(([label, render]) => (
                    <tr key={label || "actions"}>
                      <th className="sticky start-0 z-10 border-t border-border bg-surface p-3 text-start font-medium text-muted">{label}</th>
                      {columns.map((c) => (
                        <td key={c.key} className="border-s border-t border-border p-3 align-top">
                          {render(c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <AttachmentsPanel householdId={householdId} entityType="planned_purchase" entityId={p.id} module="planner" attachments={attachments} />

        <p className="footnote px-1 text-muted">
          {addedBy ? `נוסף על ידי ${addedBy} · ` : ""}
          {formatShortDate(p.created_at)}
          {p.purchased_at ? ` · נקנה ב-${formatShortDate(p.purchased_at)}` : ""}
        </p>

        <Button variant="danger-ghost" className="w-full" onClick={() => setConfirmDelete(true)}>
          <Trash2 /> מחיקת הפריט
        </Button>
      </div>

      <PurchaseSheet open={edit} onOpenChange={setEdit} householdId={householdId} rooms={rooms} projects={projects} purchase={p} />
      <AlternativeSheet
        open={!!altSheet}
        onOpenChange={(o) => !o && setAltSheet(null)}
        householdId={householdId}
        purchaseId={p.id}
        alternative={altSheet && altSheet !== "new" ? altSheet : null}
      />
      <ConfirmSheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`למחוק את "${p.name}"?`}
        description="הפריט והחלופות שלו יימחקו."
        confirmLabel="מחיקה"
        destructive
        onConfirm={remove}
      />
      {p.image_path && <ImageViewer path={p.image_path} alt={p.name} open={viewer} onOpenChange={setViewer} />}
    </>
  );
}

function AlternativeSheet({
  open,
  onOpenChange,
  householdId,
  purchaseId,
  alternative,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  purchaseId: string;
  alternative: PurchaseAlternative | null;
}) {
  const router = useRouter();
  const blank = { name: "", store: "", url: "", price: "", dimensions: "", color: "", material: "", notes: "", image_path: null as string | null };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = open ? (alternative?.id ?? "new") : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (open)
      setForm(
        alternative
          ? {
              name: alternative.name,
              store: alternative.store ?? "",
              url: alternative.url ?? "",
              price: alternative.price != null ? String(alternative.price) : "",
              dimensions: alternative.dimensions ?? "",
              color: alternative.color ?? "",
              material: alternative.material ?? "",
              notes: alternative.notes ?? "",
              image_path: alternative.image_path,
            }
          : blank,
      );
  }
  const set = (k: keyof typeof form, v: string | null) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await saveAlternative(purchaseId, alternative?.id ?? null, form);
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    onOpenChange(false);
    router.refresh();
  }

  async function remove() {
    if (!alternative) return;
    const res = await deleteAlternative(purchaseId, alternative.id);
    if (!res.ok) return void toast.error(res.error);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={alternative ? "עריכת חלופה" : "חלופה חדשה"}
      footer={
        <div className="flex gap-2">
          {alternative && (
            <Button type="button" variant="danger-ghost" onClick={remove}>
              מחיקה
            </Button>
          )}
          <Button type="submit" form="alt-form" size="lg" className="flex-1" loading={saving}>
            שמירה
          </Button>
        </div>
      }
    >
      <form id="alt-form" onSubmit={submit} className="flex flex-col gap-4">
        <PhotoPicker householdId={householdId} module="planner" value={form.image_path} onChange={(v) => set("image_path", v)} />
        <Field label="שם המוצר" htmlFor="alt-name">
          <Input id="alt-name" value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={160} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="מחיר (₪)" htmlFor="alt-price">
            <Input id="alt-price" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} />
          </Field>
          <Field label="חנות" htmlFor="alt-store">
            <Input id="alt-store" value={form.store} onChange={(e) => set("store", e.target.value)} />
          </Field>
        </div>
        <Field label="קישור" htmlFor="alt-url">
          <Input id="alt-url" dir="ltr" inputMode="url" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="מידות" htmlFor="alt-dim">
            <Input id="alt-dim" value={form.dimensions} onChange={(e) => set("dimensions", e.target.value)} />
          </Field>
          <Field label="צבע" htmlFor="alt-color">
            <Input id="alt-color" value={form.color} onChange={(e) => set("color", e.target.value)} />
          </Field>
          <Field label="חומר" htmlFor="alt-mat">
            <Input id="alt-mat" value={form.material} onChange={(e) => set("material", e.target.value)} />
          </Field>
        </div>
        <Field label="הערות" htmlFor="alt-notes">
          <Textarea id="alt-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </form>
    </Sheet>
  );
}
