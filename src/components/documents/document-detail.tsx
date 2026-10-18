"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { analyzeDocument, deleteDocument, updateDocument } from "@/server/actions/admin";
import type { HouseholdDocument } from "@/lib/types";
import { DOCUMENT_CATEGORY } from "@/lib/labels";
import { formatShortDate } from "@/lib/format";
import { getSignedUrl } from "@/lib/media";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Panel, PanelHeading, PanelRow } from "@/components/ui/panel";
import { SignedImage } from "@/components/media/signed-image";
import { DocumentUploadSheet } from "./document-upload";
import { expiryBadge } from "./documents-view";

export function DocumentDetail({
  householdId,
  doc,
  versions,
  links,
  aiEnabled,
  canDelete,
}: {
  householdId: string;
  doc: HouseholdDocument;
  versions: Pick<HouseholdDocument, "id" | "version" | "created_at">[];
  links: { label: string; href: string }[];
  aiEnabled: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  const [category, setCategory] = useState(doc.category);
  const [expires, setExpires] = useState(doc.expires_on ?? "");
  const [issued, setIssued] = useState(doc.issued_on ?? "");
  const [tags, setTags] = useState(doc.tags.join(", "));
  const [notes, setNotes] = useState(doc.notes ?? "");
  const [sensitive, setSensitive] = useState(doc.sensitive);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const badge = expiryBadge(doc.expires_on);

  async function open() {
    const url = await getSignedUrl(doc.file_path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("לא ניתן לפתוח את הקובץ");
  }

  async function save() {
    setSaving(true);
    const res = await updateDocument(doc.id, {
      title,
      category,
      expires_on: expires,
      issued_on: issued,
      remind_on: doc.remind_on ?? "",
      tags: tags.split(/[,،]/).map((t) => t.trim()).filter(Boolean),
      notes,
      sensitive,
    });
    setSaving(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("נשמר");
    router.refresh();
  }

  return (
    <>
      <PageHeader title={doc.title} back={{ href: "/documents", label: "מסמכים" }} subtitle={[DOCUMENT_CATEGORY[doc.category]?.label, `גרסה ${doc.version}`].join(" · ")} />
      <div className="space-y-6 pb-10">
        <section className="flex items-center gap-3">
          {doc.mime_type.startsWith("image/") ? (
            <button type="button" onClick={open} className="size-24 overflow-hidden rounded-2xl border border-border" aria-label="פתיחת המסמך">
              <SignedImage path={doc.file_path} alt={doc.title} className="size-full" />
            </button>
          ) : (
            <span className="cat-tint grid size-24 place-items-center rounded-2xl text-[40px]" style={{ "--h": 260 } as React.CSSProperties}>
              📄
            </span>
          )}
          <div className="space-y-2">
            {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
            {doc.sensitive && <Badge>🔒 רגיש</Badge>}
            <Button size="sm" onClick={open}>
              <ExternalLink /> פתיחת הקובץ
            </Button>
          </div>
        </section>

        {doc.extracted_text && (
          <Panel>
            <div className="px-4 py-3">
              <p className="footnote mb-1 flex items-center gap-1 text-muted">
                <Sparkles className="size-3" /> מה כתוב במסמך (נקרא אוטומטית, לחיפוש)
              </p>
              <p className="line-clamp-6 text-[15px] whitespace-pre-wrap">{doc.extracted_text}</p>
            </div>
          </Panel>
        )}

        <section className="space-y-4">
          <PanelHeading title="פרטים" />
          <Field label="שם" htmlFor="dd-title">
            <Input id="dd-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="סוג" htmlFor="dd-cat">
              <Select id="dd-cat" value={category} onChange={(e) => setCategory(e.target.value as HouseholdDocument["category"])}>
                {Object.entries(DOCUMENT_CATEGORY).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="בתוקף עד" htmlFor="dd-exp">
              <Input id="dd-exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="תאריך המסמך" htmlFor="dd-issued">
              <Input id="dd-issued" type="date" value={issued} onChange={(e) => setIssued(e.target.value)} />
            </Field>
            <Field label="תגיות" htmlFor="dd-tags">
              <Input id="dd-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
            </Field>
          </div>
          <Field label="הערות" htmlFor="dd-notes">
            <Textarea id="dd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <label className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
            מסמך רגיש
            <input type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} className="size-5 accent-[var(--primary)]" />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} loading={saving}>
              שמירה
            </Button>
            {aiEnabled && (
              <Button
                variant="secondary"
                disabled={analyzing}
                onClick={async () => {
                  setAnalyzing(true);
                  const r = await analyzeDocument(doc.id);
                  setAnalyzing(false);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("המסמך נקרא. בדקו את התאריכים.");
                  router.refresh();
                }}
              >
                {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles />} קריאה חוזרת (AI)
              </Button>
            )}
            <Button variant="secondary" onClick={() => setVersionOpen(true)}>
              <Upload /> גרסה חדשה
            </Button>
          </div>
        </section>

        {links.length > 0 && (
          <section>
            <PanelHeading title="מקושר אל" />
            <Panel>
              {links.map((l) => (
                <PanelRow key={l.href} href={l.href} title={l.label} />
              ))}
            </Panel>
          </section>
        )}

        {versions.length > 1 && (
          <section>
            <PanelHeading title="גרסאות" count={versions.length} />
            <Panel>
              {versions.map((v) => (
                <Link key={v.id} href={`/documents/${v.id}`} className="flex justify-between px-4 py-3 text-[15px]">
                  <span>גרסה {v.version}</span>
                  <span className="text-muted">{formatShortDate(v.created_at)}</span>
                </Link>
              ))}
            </Panel>
          </section>
        )}

        {canDelete && (
          <Button variant="danger-ghost" className="w-full" onClick={() => setConfirm(true)}>
            <Trash2 /> מחיקת המסמך
          </Button>
        )}
      </div>

      <DocumentUploadSheet open={versionOpen} onOpenChange={setVersionOpen} householdId={householdId} previousVersion={doc} aiEnabled={aiEnabled} onCreated={(d) => router.push(`/documents/${d.id}`)} />
      <ConfirmSheet
        open={confirm}
        onOpenChange={setConfirm}
        title="למחוק את המסמך?"
        description="הרשומה תימחק משני המכשירים. קישורים ממכשירים וחשבונות יוסרו."
        confirmLabel="מחיקה"
        destructive
        onConfirm={async () => {
          const r = await deleteDocument(doc.id);
          if (!r.ok) return void toast.error(r.error);
          router.push("/documents");
        }}
      />
    </>
  );
}
