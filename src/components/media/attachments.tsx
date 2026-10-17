"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileText, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addAttachment, deleteAttachment } from "@/server/actions/projects";
import { getSignedUrl, uploadHouseholdFile, uploadHouseholdImage, validateImageFile, type MediaModule } from "@/lib/media";
import type { Attachment, AttachmentEntity } from "@/lib/types";
import { ImageViewer, SignedImage } from "./signed-image";
import { ConfirmSheet } from "@/components/ui/sheet";

/** Photo / PDF strip for any record (projects, repairs, purchases, appliances, plants, bills). */
export function AttachmentsPanel({
  householdId,
  entityType,
  entityId,
  module,
  attachments,
  allowPdf = false,
  title = "תמונות וקבצים",
}: {
  householdId: string;
  entityType: AttachmentEntity;
  entityId: string;
  module: MediaModule;
  attachments: Attachment[];
  allowPdf?: boolean;
  title?: string;
}) {
  const router = useRouter();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<Attachment | null>(null);
  const [confirm, setConfirm] = useState<Attachment | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      let path: string;
      let mime = file.type;
      let size = file.size;
      if (file.type === "application/pdf") {
        const r = await uploadHouseholdFile(householdId, module, file);
        path = r.path;
        mime = r.mime;
        size = r.size;
      } else {
        const problem = validateImageFile(file);
        if (problem) throw new Error(problem);
        path = await uploadHouseholdImage(householdId, module, file);
        mime = path.endsWith(".webp") ? "image/webp" : "image/jpeg";
      }
      const res = await addAttachment({ entity_type: entityType, entity_id: entityId, path, mime_type: mime as never, size_bytes: size, file_name: file.name.slice(0, 200) });
      if (!res.ok) throw new Error(res.error);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message || "ההעלאה נכשלה");
    } finally {
      setBusy(false);
      for (const r of [camera, gallery, pdf]) if (r.current) r.current.value = "";
    }
  }

  async function openPdf(a: Attachment) {
    const url = await getSignedUrl(a.path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("לא ניתן לפתוח את הקובץ");
  }

  async function remove(a: Attachment) {
    setConfirm(null);
    const res = await deleteAttachment(a.id);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="headline">{title}</h2>
        {busy && <Loader2 className="size-4 animate-spin text-muted" />}
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <input ref={pdf} type="file" accept="application/pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {attachments.map((a) =>
          a.mime_type === "application/pdf" ? (
            <div key={a.id} className="relative shrink-0">
              <button type="button" onClick={() => openPdf(a)} className="flex size-24 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-surface p-2 text-center">
                <FileText className="size-7 text-primary" />
                <span className="line-clamp-2 text-[11px] text-muted">{a.file_name ?? "PDF"}</span>
              </button>
              <DeleteDot onClick={() => setConfirm(a)} />
            </div>
          ) : (
            <div key={a.id} className="relative shrink-0">
              <button type="button" onClick={() => setViewer(a)} className="block size-24 overflow-hidden rounded-2xl border border-border" aria-label="הגדלת תמונה">
                <SignedImage path={a.path} alt={a.caption ?? "תמונה"} className="size-full" />
              </button>
              <DeleteDot onClick={() => setConfirm(a)} />
            </div>
          ),
        )}
        <AddTile icon={<Camera />} label="צילום" onClick={() => camera.current?.click()} disabled={busy} />
        <AddTile icon={<ImagePlus />} label="מהגלריה" onClick={() => gallery.current?.click()} disabled={busy} />
        {allowPdf && <AddTile icon={<FileText />} label="PDF" onClick={() => pdf.current?.click()} disabled={busy} />}
      </div>
      <ImageViewer path={viewer?.path ?? null} alt="תמונה" open={!!viewer} onOpenChange={(o) => !o && setViewer(null)} />
      <ConfirmSheet
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="למחוק את הקובץ?"
        description="הקובץ יימחק לצמיתות משני המכשירים."
        confirmLabel="מחיקה"
        destructive
        onConfirm={() => confirm && remove(confirm)}
      />
    </section>
  );
}

function AddTile({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-surface-2 text-[13px] text-muted [&_svg]:size-6 disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

function DeleteDot({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="מחיקת קובץ" className="absolute -top-1.5 -start-1.5 grid size-7 place-items-center rounded-full border border-border bg-surface text-danger shadow-sm">
      <Trash2 className="size-3.5" />
    </button>
  );
}
