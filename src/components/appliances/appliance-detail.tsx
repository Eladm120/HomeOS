"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { addMaintenance, deleteAppliance, saveAppliance } from "@/server/actions/admin";
import type { Appliance, ApplianceMaintenance, Attachment, HomeProject, HouseholdDocument, Room, ServiceProvider } from "@/lib/types";
import { PROJECT_STATUS } from "@/lib/labels";
import { formatCurrency, formatShortDate, todayInZone } from "@/lib/format";
import { primeSignedUrls } from "@/lib/media";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Panel, PanelHeading, PanelRow } from "@/components/ui/panel";
import { AttachmentsPanel } from "@/components/media/attachments";
import { SignedImage } from "@/components/media/signed-image";
import { DocumentUploadSheet } from "@/components/documents/document-upload";
import { ApplianceSheet } from "./appliance-sheet";
import { applianceEmoji, warrantyBadge } from "./appliances-view";

export function ApplianceDetail({
  householdId,
  appliance: a,
  rooms,
  maintenance,
  repairs,
  documents,
  attachments,
  providers,
  signedUrls,
  aiEnabled,
}: {
  householdId: string;
  appliance: Appliance;
  rooms: Room[];
  maintenance: ApplianceMaintenance[];
  repairs: Pick<HomeProject, "id" | "title" | "status" | "created_at">[];
  documents: Pick<HouseholdDocument, "id" | "title" | "category">[];
  attachments: Attachment[];
  providers: ServiceProvider[];
  signedUrls: Record<string, string>;
  aiEnabled: boolean;
}) {
  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [upload, setUpload] = useState<"invoice" | "manual" | null>(null);
  const [mOpen, setMOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const badge = warrantyBadge(a.warranty_until);
  const invoice = documents.find((d) => d.id === a.invoice_document_id);
  const manual = documents.find((d) => d.id === a.manual_document_id);

  async function attachDoc(kind: "invoice" | "manual", docId: string) {
    const res = await saveAppliance(a.id, { ...a, purchase_price: a.purchase_price != null ? String(a.purchase_price) : "", invoice_document_id: kind === "invoice" ? docId : a.invoice_document_id, manual_document_id: kind === "manual" ? docId : a.manual_document_id } as never);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  const room = rooms.find((r) => r.id === a.room_id)?.name ?? null;
  const bought = [a.store, a.purchased_on ? formatShortDate(a.purchased_on) : null, a.purchase_price != null ? formatCurrency(Number(a.purchase_price), a.currency) : null].filter(Boolean).join(" · ");
  const service = [["יצרן ודגם", [a.brand, a.model].filter(Boolean).join(" ") || null], ["מספר סידורי", a.serial_number], ["חדר", room]].filter(([, v]) => v) as [string, string][];
  const folder = [!!bought, !!invoice, !!a.warranty_until, !!manual];
  const filled = folder.filter(Boolean).length;

  return (
    <>
      <PageHeader
        title={a.name}
        back={{ href: "/appliances", label: "מכשירי חשמל" }}
        subtitle={a.kind ?? undefined}
        actions={
          <Button size="icon-sm" variant="secondary" onClick={() => setEdit(true)} aria-label="עריכה">
            <Pencil />
          </Button>
        }
      />
      <div className="space-y-6 pb-10">
        <section className="flex items-center gap-4">
          {a.image_path ? (
            <SignedImage path={a.image_path} alt={a.name} className="size-24 rounded-[var(--radius)] border border-border" />
          ) : (
            <span className="cat-tint grid size-24 place-items-center rounded-[var(--radius)] text-[44px]" style={{ "--h": 235 } as React.CSSProperties}>
              {applianceEmoji(a)}
            </span>
          )}
          <div className="space-y-2">
            {badge ? <Badge tone={badge.tone}>{badge.text}</Badge> : <Badge>אין פרטי אחריות</Badge>}
            <Link href={`/projects?new=1&kind=repair&appliance=${a.id}`} className="flex items-center gap-1.5 text-[15px] font-medium text-primary">
              <Wrench className="size-4" /> דיווח על תקלה במכשיר
            </Link>
          </div>
        </section>

        <section>
          <PanelHeading title="התיק של המכשיר" action={<span className="num footnote text-muted">{filled}/4</span>} />
          <Panel>
            <PanelRow
              onClick={() => setEdit(true)}
              leading={<FolderIcon emoji="🛒" done={!!bought} />}
              title="מאיפה קניתי"
              subtitle={bought || "חנות, תאריך ומחיר"}
              chevron={false}
            />
            {invoice ? (
              <PanelRow href={`/documents/${invoice.id}`} leading={<FolderIcon emoji="🧾" done />} title="קבלה" subtitle={invoice.title} />
            ) : (
              <PanelRow onClick={() => setUpload("invoice")} leading={<FolderIcon emoji="🧾" />} title="קבלה" subtitle="צילום או PDF" trailing={<Plus className="size-5 text-primary" />} chevron={false} />
            )}
            <PanelRow
              onClick={() => setEdit(true)}
              leading={<FolderIcon emoji="🛡️" done={!!a.warranty_until} />}
              title="אחריות"
              subtitle={a.warranty_until ? [`עד ${formatShortDate(a.warranty_until)}`, a.warranty_provider].filter(Boolean).join(" · ") : "כמה זמן ולמי פונים"}
              trailing={badge ? <Badge tone={badge.tone}>{badge.tone === "sage" ? "בתוקף" : badge.text}</Badge> : undefined}
              chevron={false}
            />
            {manual ? (
              <PanelRow href={`/documents/${manual.id}`} leading={<FolderIcon emoji="📘" done />} title="הוראות שימוש" subtitle={manual.title} />
            ) : (
              <PanelRow onClick={() => setUpload("manual")} leading={<FolderIcon emoji="📘" />} title="הוראות שימוש" subtitle="PDF מהיצרן" trailing={<Plus className="size-5 text-primary" />} chevron={false} />
            )}
          </Panel>
        </section>

        {(service.length > 0 || a.notes) && (
          <section>
            <PanelHeading title="לטכנאי" />
            <Panel>
              {service.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-3 text-[15px]">
                  <span className="text-muted">{k}</span>
                  <span className="text-end" dir="auto">
                    {v}
                  </span>
                </div>
              ))}
              {a.notes && <p className="px-4 py-3 text-[15px] whitespace-pre-wrap">{a.notes}</p>}
            </Panel>
          </section>
        )}

        <section>
          <PanelHeading
            title="תחזוקה"
            count={maintenance.length || undefined}
            action={
              <Button size="sm" variant="soft" onClick={() => setMOpen(true)}>
                <Plus /> רישום
              </Button>
            }
          />
          {maintenance.length ? (
            <Panel>
              {maintenance.map((m) => (
                <div key={m.id} className="px-4 py-3">
                  <p className="footnote text-muted">
                    {formatShortDate(m.performed_on)}
                    {m.cost != null ? ` · ${formatCurrency(Number(m.cost))}` : ""}
                    {m.provider_id ? ` · ${providers.find((p) => p.id === m.provider_id)?.name ?? ""}` : ""}
                  </p>
                  <p className="text-[15px]">{m.description}</p>
                </div>
              ))}
            </Panel>
          ) : (
            <p className="px-1 text-[15px] text-muted">ניקוי מסננים, טיפולים ובדיקות יירשמו כאן.</p>
          )}
        </section>

        {repairs.length > 0 && (
          <section>
            <PanelHeading title="תיקונים" count={repairs.length} />
            <Panel>
              {repairs.map((r) => (
                <PanelRow key={r.id} href={`/projects/${r.id}`} title={r.title} subtitle={formatShortDate(r.created_at)} trailing={<Badge tone={PROJECT_STATUS[r.status].tone}>{PROJECT_STATUS[r.status].label}</Badge>} />
              ))}
            </Panel>
          </section>
        )}

        <AttachmentsPanel householdId={householdId} entityType="appliance" entityId={a.id} module="appliances" attachments={attachments} title="תמונות (מדבקת דגם, התקנה)" />

        <Button variant="danger-ghost" className="w-full" onClick={() => setConfirm(true)}>
          <Trash2 /> מחיקת המכשיר
        </Button>
      </div>

      <ApplianceSheet open={edit} onOpenChange={setEdit} householdId={householdId} appliance={a} rooms={rooms} />
      <DocumentUploadSheet
        open={!!upload}
        onOpenChange={(o) => !o && setUpload(null)}
        householdId={householdId}
        defaultCategory={upload === "invoice" ? "invoice" : "warranty"}
        link={{ type: "appliance", id: a.id }}
        aiEnabled={aiEnabled}
        onCreated={(d) => upload && attachDoc(upload, d.id)}
      />
      <MaintenanceSheet open={mOpen} onOpenChange={setMOpen} applianceId={a.id} providers={providers} />
      <ConfirmSheet
        open={confirm}
        onOpenChange={setConfirm}
        title={`למחוק את "${a.name}"?`}
        description="היסטוריית התחזוקה תימחק. מסמכים בכספת יישארו."
        confirmLabel="מחיקה"
        destructive
        onConfirm={async () => {
          const r = await deleteAppliance(a.id);
          if (!r.ok) return void toast.error(r.error);
          router.push("/appliances");
        }}
      />
    </>
  );
}

function MaintenanceSheet({ open, onOpenChange, applianceId, providers }: { open: boolean; onOpenChange: (o: boolean) => void; applianceId: string; providers: ServiceProvider[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<"maintenance" | "repair" | "inspection" | "cleaning">("maintenance");
  const [date, setDate] = useState(todayInZone());
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [provider, setProvider] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="רישום תחזוקה"
      footer={
        <Button
          size="lg"
          className="w-full"
          loading={saving}
          disabled={!description.trim()}
          onClick={async () => {
            setSaving(true);
            const r = await addMaintenance(applianceId, { kind, performed_on: date, description, cost, provider_id: provider });
            setSaving(false);
            if (!r.ok) return void toast.error(r.error);
            setDescription("");
            setCost("");
            onOpenChange(false);
            router.refresh();
          }}
        >
          שמירה
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="סוג" htmlFor="mt-kind">
            <Select id="mt-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="maintenance">טיפול</option>
              <option value="cleaning">ניקוי</option>
              <option value="inspection">בדיקה</option>
              <option value="repair">תיקון</option>
            </Select>
          </Field>
          <Field label="תאריך" htmlFor="mt-date">
            <Input id="mt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="מה נעשה" htmlFor="mt-desc">
          <Textarea id="mt-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ניקוי מסננים, החלפת פילטר…" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="עלות (₪)" htmlFor="mt-cost">
            <Input id="mt-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
          <Field label="בעל מקצוע" htmlFor="mt-prov">
            <Select id="mt-prov" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="">—</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Sheet>
  );
}

function FolderIcon({ emoji, done }: { emoji: string; done?: boolean }) {
  return (
    <span aria-hidden className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-fill text-[19px]">
      {emoji}
      {done && (
        <span className="absolute -end-1 -bottom-1 grid size-[18px] place-items-center rounded-full bg-sage text-white ring-2 ring-surface">
          <Check className="size-3" strokeWidth={3.5} />
        </span>
      )}
    </span>
  );
}
