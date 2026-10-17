import type { InventoryItem, InventoryMovement } from "@/lib/types";
import { daysUntil } from "@/lib/format";

export type StockLevel = "out" | "low" | "ok" | "unknown";

export function stockLevel(item: Pick<InventoryItem, "quantity" | "min_threshold">): StockLevel {
  const q = Number(item.quantity);
  if (q <= 0) return "out";
  if (item.min_threshold === null || item.min_threshold === undefined) return "ok";
  return q <= Number(item.min_threshold) ? "low" : "ok";
}

export const EXPIRY_SOON_DAYS = 3;

export function expiryState(expiresOn: string | null, now = new Date()): { days: number; state: "expired" | "soon" | "ok" } | null {
  if (!expiresOn) return null;
  const days = daysUntil(expiresOn, now);
  return { days, state: days < 0 ? "expired" : days <= EXPIRY_SOON_DAYS ? "soon" : "ok" };
}

/** Days since the stock count was last confirmed by a person. */
export function daysSinceVerified(item: Pick<InventoryItem, "last_verified_at">, now = new Date()): number | null {
  if (!item.last_verified_at) return null;
  return Math.floor((now.getTime() - new Date(item.last_verified_at).getTime()) / 86_400_000);
}

export interface DepletionEstimate {
  dailyRate: number;
  daysLeft: number;
  confidence: "low" | "medium" | "high";
  basedOnEvents: number;
}

/**
 * Deterministic usage estimate from recorded consumption (no AI).
 * Returns null when there is not enough history to say anything honest.
 */
export function estimateDepletion(
  movements: Pick<InventoryMovement, "kind" | "quantity_delta" | "created_at">[],
  currentQty: number,
  now = new Date(),
  windowDays = 60,
): DepletionEstimate | null {
  const since = now.getTime() - windowDays * 86_400_000;
  const usage = movements
    .filter((m) => (m.kind === "consume" || m.kind === "discard") && new Date(m.created_at).getTime() >= since)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (usage.length < 2) return null;

  const first = new Date(usage[0].created_at).getTime();
  const spanDays = (now.getTime() - first) / 86_400_000;
  if (spanDays < 3) return null;

  const total = usage.reduce((s, m) => s + Math.abs(Number(m.quantity_delta)), 0);
  const dailyRate = total / spanDays;
  if (dailyRate <= 0) return null;

  const confidence = usage.length >= 8 ? "high" : usage.length >= 4 ? "medium" : "low";
  return {
    dailyRate,
    daysLeft: Math.max(0, Math.floor(currentQty / dailyRate)),
    confidence,
    basedOnEvents: usage.length,
  };
}

export const MOVEMENT_LABELS: Record<InventoryMovement["kind"], string> = {
  initial: "הזנה ראשונית",
  add: "הוספה",
  purchase: "קנייה",
  consume: "שימוש",
  correct: "תיקון ספירה",
  discard: "זריקה / פג תוקף",
  transfer: "העברת מיקום",
};
