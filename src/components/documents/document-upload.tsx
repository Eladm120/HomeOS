"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { analyzeDocument, createDocument, linkDocument } from "@/server/actions/admin";
import { uploadHouseholdFile, uploadHouseholdImage, validateImageFile } from "@/lib/media";
import type { DocumentCategory, HouseholdDocument } from "@/lib/types";
import { DOCUMENT_CATEGORY } from "@/lib/labels";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

/**
 * Upload one file into the vault: pick file → fill title/category/dates →
 * save → optional AI indexing. Optionally links it to a record (appliance, bill…).
 */
export function DocumentUploadSheet({
  open,
  onOpenChange,
  householdId,
  defaultCategory = "other",
  link,
  previousVersion,
  aiEnabled,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  defaultCategory?: DocumentCategory;
  link?: { type: "appliance" | "project" | "utility_bill" | "planned_purchase" | "event" | "plant"; id: string };
  previousVersion?: HouseholdDocument;
  aiEnabled: boolean;
  onCreated?: (doc: HouseholdDocument) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(previousVersion?.title ?? "");
  const [category, setCategory] = useState<DocumentCategory>(previousVersion?.category ?? defaultCategory);
  const [expires, setExpires] = useState("");
  const [issued, setIssued] = useState("");
  const [tags, setTags] = useState(previousVersion?.tags.join(", ") ?? "");
  const [sensitive, setSensitive] = useState(previousVersion?.sensitive ?? false);
  const [notes, setNotes] = useState("");
  const [analyze, setAnalyze] = useState(aiEnabled);
  const [busy, setBusy] = useState<string | null>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    if (f.type !== "application/pdf") {
      const problem = validateImageFile(f);
      if (problem) return void toast.error(problem);
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 200));
  }

  async function save() {
    if (!file) return void toast.error("בחרו קובץ");
    try {
      setBusy("מעלה…");
      const isPdf = file.type === "application/pdf";
      const up = isPdf ? await uploadHouseholdFile(householdId, "documents", file) : { path: await uploadHouseholdImage(householdId, "documents", file), mime: "", size: file.size };
      const mime = isPdf ? "application/pdf" : up.path.endsWith(".webp") ? "image/webp" : "image/jpeg";
      const res = await createDocument({
        title: title || file.name,
        category,
        tags: tags.split(/[,،]/).map((t) => t.trim()).filter(Boolean),
        file_path: up.path,
        file_name: file.name.slice(0, 200),
        mime_type: mime as "application/pdf",
        size_bytes: up.size,
        issued_on: issued,
        expires_on: expires,
        remind_on: "",
        sensitive,
        notes,
        previous_version_id: previousVersion?.id ?? null,
      });
      if (!res.ok) throw new Error(res.error);
      if (link) await linkDocument(res.data.id, link.type, link.id);
      if (analyze && aiEnabled) {
        setBusy("קורא את המסמך…");
        const a = await analyzeDocument(res.data.id);
        if (!a.ok) toast.message(`המסמך נשמר. ${a.error}`);
      }
      toast.success("המסמך נשמר");
      onCreated?.(res.data);
      onOpenChange(false);
      setFile(null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message || "השמירה נכשלה");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={previousVersion ? "גרסה חדשה של המסמך" : "מסמך חדש"}
      footer={
        <Button size="lg" className="w-full" onClick={save} disabled={!file || !!busy}>
          {busy ? (
            <>
              <Loader2 className="animate-spin" /> {busy}
            </>
          ) : (
            "שמירה בכספת"
          )}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        <button type="button" onClick={() => inputRef.current?.click()} className="flex h-20 items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-2 text-[15px] text-muted">
          <FileUp className="size-5" /> {file ? file.name : "בחירת קובץ (PDF או תמונה, עד 10MB)"}
        </button>
        <Field label="שם" htmlFor="doc-title">
          <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="סוג" htmlFor="doc-cat">
            <Select id="doc-cat" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
              {Object.entries(DOCUMENT_CATEGORY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="בתוקף עד" htmlFor="doc-exp">
            <Input id="doc-exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="תאריך המסמך" htmlFor="doc-issued">
            <Input id="doc-issued" type="date" value={issued} onChange={(e) => setIssued(e.target.value)} />
          </Field>
          <Field label="תגיות" htmlFor="doc-tags" hint="מופרדות בפסיק">
            <Input id="doc-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
          </Field>
        </div>
        <Field label="הערות" htmlFor="doc-notes">
          <Textarea id="doc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" />
        </Field>
        <label className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
          <span>
            <span className="block">מסמך רגיש</span>
            <span className="footnote block text-muted">רק מי שהעלה יכול למחוק</span>
          </span>
          <input type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} className="size-5 accent-[var(--primary)]" />
        </label>
        {aiEnabled && (
          <label className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
            <span>
              <span className="block">לקרוא את המסמך (AI)</span>
              <span className="footnote block text-muted">לחיפוש, תאריכים ותוקף. אפשר לתקן אחר כך.</span>
            </span>
            <input type="checkbox" checked={analyze} onChange={(e) => setAnalyze(e.target.checked)} className="size-5 accent-[var(--primary)]" />
          </label>
        )}
      </div>
    </Sheet>
  );
}
