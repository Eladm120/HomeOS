"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadHouseholdImage, validateImageFile, type MediaModule } from "@/lib/media";
import { SignedImage } from "./signed-image";
import { cn } from "@/lib/utils";

/**
 * Take a photo (rear camera on phones) or pick from the gallery.
 * Uploads immediately; the parent stores the returned storage path.
 */
export function PhotoPicker({
  householdId,
  module,
  value,
  onChange,
  className,
}: {
  householdId: string;
  module: MediaModule;
  value: string | null;
  onChange: (path: string | null) => void;
  className?: string;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) return void toast.error(problem);
    setUploading(true);
    try {
      const path = await uploadHouseholdImage(householdId, module, file);
      onChange(path);
    } catch (e) {
      toast.error((e as Error).message || "העלאת התמונה נכשלה");
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  const inputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
    </>
  );

  if (value) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        {inputs}
        <div className="relative size-24 overflow-hidden rounded-2xl border border-border">
          <SignedImage path={value} alt="תמונת המוצר" className="size-full" />
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-black/40">
              <Loader2 className="size-6 animate-spin text-white" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => cameraRef.current?.click()} className="flex h-9 items-center gap-2 rounded-full px-3 text-sm hover:bg-surface-2">
            <RefreshCw className="size-4" /> החלפה
          </button>
          <button type="button" onClick={() => onChange(null)} className="flex h-9 items-center gap-2 rounded-full px-3 text-sm text-danger hover:bg-danger-soft">
            <Trash2 className="size-4" /> הסרה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {inputs}
      <button
        type="button"
        disabled={uploading}
        onClick={() => cameraRef.current?.click()}
        className="flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-surface-2/50 text-sm text-muted transition hover:bg-surface-2 active:scale-[0.98]"
      >
        {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        צילום
      </button>
      <button
        type="button"
        disabled={uploading}
        onClick={() => galleryRef.current?.click()}
        className="flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-surface-2/50 text-sm text-muted transition hover:bg-surface-2 active:scale-[0.98]"
      >
        <ImagePlus className="size-5" />
        מהגלריה
      </button>
    </div>
  );
}
