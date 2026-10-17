import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { MEDIA_BUCKET } from "@/lib/env";

export function thumbPathFor(path: string): string {
  return path.endsWith(".webp") ? path.replace(/\.webp$/, "_thumb.webp") : path;
}

/** Batch-sign image paths (and their thumbnails) as the current user. */
export async function signPaths(
  supabase: SupabaseClient,
  paths: (string | null | undefined)[],
  { withThumbs = true }: { withThumbs?: boolean } = {},
): Promise<Record<string, string>> {
  const set = new Set<string>();
  for (const p of paths) {
    if (!p) continue;
    set.add(p);
    if (withThumbs) set.add(thumbPathFor(p));
  }
  if (!set.size) return {};
  const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls([...set], 60 * 60);
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.path && row.signedUrl && !row.error) out[row.path] = row.signedUrl;
  }
  return out;
}
