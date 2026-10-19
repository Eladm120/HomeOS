"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { MEDIA_BUCKET } from "@/lib/env";

export const MAX_RAW_IMAGE_BYTES = 15 * 1024 * 1024;
const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif)$/;

export type MediaModule =
  | "grocery"
  | "inventory"
  | "catalog"
  | "planner"
  | "projects"
  | "recipes"
  | "appliances"
  | "documents"
  | "plants"
  | "receipts"
  | "bills"
  | "household";

export function thumbPathFor(path: string): string {
  return path.endsWith(".webp") ? path.replace(/\.webp$/, "_thumb.webp") : path;
}

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED.test(file.type)) return "ניתן להעלות תמונות בלבד (JPG, PNG, WEBP, HEIC)";
  if (file.size > MAX_RAW_IMAGE_BYTES) return "התמונה גדולה מדי (עד 15MB)";
  return null;
}

/** Resize + re-encode in the browser. Strips EXIF (incl. GPS) as a side effect. */
export async function compressImage(file: Blob, maxDim: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (blob && blob.type === "image/webp") return blob;
  // Safari < 17 cannot encode WebP; fall back to JPEG.
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!jpeg) throw new Error("encode failed");
  return jpeg;
}

/**
 * Uploads a compressed image + thumbnail into the household's private folder.
 * Storage RLS rejects any path outside a household the user belongs to.
 */
export async function uploadHouseholdImage(householdId: string, module: MediaModule, file: File): Promise<string> {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);

  const [full, thumb] = await Promise.all([compressImage(file, 1600, 0.82), compressImage(file, 360, 0.7)]);
  const ext = full.type === "image/webp" ? "webp" : "jpg";
  const id = crypto.randomUUID();
  const path = `${householdId}/${module}/${id}.${ext}`;
  const thumbPath = ext === "webp" ? thumbPathFor(path) : null;

  const supabase = getSupabaseBrowser();
  const bucket = supabase.storage.from(MEDIA_BUCKET);
  const { error } = await bucket.upload(path, full, { contentType: full.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error("העלאת התמונה נכשלה");
  if (thumbPath) {
    await bucket.upload(thumbPath, thumb, { contentType: thumb.type, cacheControl: "31536000", upsert: false });
  }
  return path;
}

// Matches the storage bucket limit (10 MB).
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** PDFs and other documents are uploaded as-is (no re-encoding) into the household folder. */
export async function uploadHouseholdFile(householdId: string, module: MediaModule, file: File): Promise<{ path: string; mime: string; size: number }> {
  if (file.type !== "application/pdf") throw new Error("ניתן להעלות קובצי PDF בלבד");
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("הקובץ גדול מדי (עד 10MB)");
  const path = `${householdId}/${module}/${crypto.randomUUID()}.pdf`;
  const { error } = await getSupabaseBrowser().storage.from(MEDIA_BUCKET).upload(path, file, { contentType: "application/pdf", upsert: false });
  if (error) throw new Error("העלאת הקובץ נכשלה");
  return { path, mime: "application/pdf", size: file.size };
}

export async function removeHouseholdImage(path: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  const paths = path.endsWith(".webp") ? [path, thumbPathFor(path)] : [path];
  await supabase.storage.from(MEDIA_BUCKET).remove(paths);
}

// --- Signed URL cache ----------------------------------------------------------
const SIGN_TTL_SECONDS = 60 * 60;
const cache = new Map<string, { url: string; expires: number }>();
const inflight = new Map<string, Promise<string | null>>();

export function cachedSignedUrl(path: string): string | null {
  const hit = cache.get(path);
  return hit && hit.expires > Date.now() ? hit.url : null;
}

export async function getSignedUrl(path: string): Promise<string | null> {
  const hit = cachedSignedUrl(path);
  if (hit) return hit;
  const pending = inflight.get(path);
  if (pending) return pending;

  const p = (async () => {
    const { data } = await getSupabaseBrowser().storage.from(MEDIA_BUCKET).createSignedUrl(path, SIGN_TTL_SECONDS);
    if (!data?.signedUrl) return null;
    cache.set(path, { url: data.signedUrl, expires: Date.now() + (SIGN_TTL_SECONDS - 300) * 1000 });
    return data.signedUrl;
  })().finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

/** Seed the cache with URLs signed on the server (avoids a request per image). */
export function primeSignedUrls(entries: Record<string, string>) {
  const expires = Date.now() + (SIGN_TTL_SECONDS - 300) * 1000;
  for (const [path, url] of Object.entries(entries)) cache.set(path, { url, expires });
}
