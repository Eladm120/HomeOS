import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Escape LIKE/ILIKE wildcards so user text matches literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Only allow same-origin relative redirect targets (prevents open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/** Safe term for PostgREST .or() filters: escapes LIKE wildcards and drops filter-syntax characters. */
export function orFilterTerm(q: string): string {
  return escapeLike(q.replace(/[,()\*:"]/g, " ").trim());
}
