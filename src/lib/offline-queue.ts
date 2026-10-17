import type { ShoppingItemStatus, ShoppingListItem } from "@/lib/types";

/**
 * Offline shopping: status changes are queued as idempotent "set status"
 * operations (never toggles). Replaying an op twice is harmless; the latest op
 * per item wins locally, and the server ignores items deleted meanwhile.
 */
export interface StatusOp {
  itemId: string;
  status: ShoppingItemStatus;
  baseVersion: number;
  queuedAt: number;
}

export function enqueueOp(queue: StatusOp[], op: StatusOp): StatusOp[] {
  return [...queue.filter((q) => q.itemId !== op.itemId), op];
}

export function removeOp(queue: StatusOp[], op: StatusOp): StatusOp[] {
  // Only remove if no newer op for the same item was queued while sending.
  return queue.filter((q) => !(q.itemId === op.itemId && q.queuedAt === op.queuedAt));
}

/** Overlay pending local changes on top of the latest server snapshot. */
export function applyPendingOps(items: ShoppingListItem[], queue: StatusOp[]): ShoppingListItem[] {
  if (!queue.length) return items;
  const byItem = new Map(queue.map((q) => [q.itemId, q]));
  return items.map((it) => {
    const op = byItem.get(it.id);
    return op ? { ...it, status: op.status } : it;
  });
}

/**
 * Merge an incoming realtime row into local state. Rows carry a monotonically
 * increasing `version`; stale events (lower version) are ignored.
 */
export function mergeRealtimeRow(items: ShoppingListItem[], row: ShoppingListItem): ShoppingListItem[] {
  const visible = !row.deleted_at && !row.cleared_at;
  const idx = items.findIndex((i) => i.id === row.id);
  if (idx === -1) return visible ? [...items, row] : items;
  if (items[idx].version > row.version) return items;
  if (!visible) return items.filter((i) => i.id !== row.id);
  const next = items.slice();
  next[idx] = row;
  return next;
}

// --- Persistence (IndexedDB via idb-keyval; no-ops during SSR) -----------------
const snapKey = (hid: string) => `homeos:grocery:${hid}:snapshot`;
const queueKey = (hid: string) => `homeos:grocery:${hid}:queue`;

async function idb() {
  if (typeof indexedDB === "undefined") return null;
  return import("idb-keyval");
}

export async function saveSnapshot(hid: string, items: ShoppingListItem[]) {
  const db = await idb();
  await db?.set(snapKey(hid), { items, savedAt: Date.now() }).catch(() => undefined);
}

export async function loadSnapshot(hid: string): Promise<{ items: ShoppingListItem[]; savedAt: number } | null> {
  const db = await idb();
  return ((await db?.get(snapKey(hid)).catch(() => null)) as { items: ShoppingListItem[]; savedAt: number } | undefined) ?? null;
}

export async function saveQueue(hid: string, queue: StatusOp[]) {
  const db = await idb();
  await db?.set(queueKey(hid), queue).catch(() => undefined);
}

export async function loadQueue(hid: string): Promise<StatusOp[]> {
  const db = await idb();
  return ((await db?.get(queueKey(hid)).catch(() => null)) as StatusOp[] | undefined) ?? [];
}
