"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createReceiptImport } from "@/server/actions/receipts";
import { uploadHouseholdFile, uploadHouseholdImage, validateImageFile } from "@/lib/media";
import { Button } from "@/components/ui/button";

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Photograph or upload a receipt, then go straight to the review screen. */
export function ReceiptCapture({ householdId, configured, compact }: { householdId: string; configured: boolean; compact?: boolean }) {
  const router = useRouter();
  const camera = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handle(f: File | undefined) {
    if (!f) return;
    try {
      const isPdf = f.type === "application/pdf";
      if (!isPdf) {
        const problem = validateImageFile(f);
        if (problem) throw new Error(problem);
      }
      setBusy("מעלה…");
      const hash = await sha256(f);
      const path = isPdf ? (await uploadHouseholdFile(householdId, "receipts", f)).path : await uploadHouseholdImage(householdId, "receipts", f);
      setBusy("קורא את הקבלה…");
      const res = await createReceiptImport({ path, file_hash: hash, mime_type: isPdf ? "application/pdf" : path.endsWith(".webp") ? "image/webp" : "image/jpeg" });
      if (!res.ok) throw new Error(res.error);
      if (res.data.duplicateOf) toast.message("הקבלה הזו כבר נקלטה. פתחתי אותה.");
      router.push(`/receipts/${res.data.id}`);
    } catch (e) {
      toast.error((e as Error).message || "ההעלאה נכשלה");
    } finally {
      setBusy(null);
      if (camera.current) camera.current.value = "";
      if (file.current) file.current.value = "";
    }
  }

  return (
    <div className={compact ? "flex gap-2" : "grid grid-cols-2 gap-2"}>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      <Button size={compact ? "md" : "lg"} disabled={!configured || !!busy} onClick={() => camera.current?.click()}>
        {busy ? <Loader2 className="animate-spin" /> : <Camera />} {busy ?? "צילום קבלה"}
      </Button>
      <Button size={compact ? "md" : "lg"} variant="secondary" disabled={!configured || !!busy} onClick={() => file.current?.click()}>
        <FileUp /> קובץ / PDF
      </Button>
    </div>
  );
}
