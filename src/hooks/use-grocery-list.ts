"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { primeSignedUrls } from "@/lib/media";
import {
  applyPendingOps,
  enqueueOp,
  loadQueue,
  loadSnapshot,
  mergeRealtimeRow,
  removeOp,
  saveQueue,
  saveSnapshot,
  type StatusOp,
} from "@/lib/offline-queue";
import type { ShoppingItemStatus, ShoppingListItem } from "@/lib/types";
import { setShoppingItemStatus } from "@/server/actions/grocery";

export type SyncState = "live" | "connecting" | "offline";

export function useGroceryList({
  householdId,
  initialItems,
  signedUrls,
  renderedAt,
  preview = false,
}: {
  householdId: string;
  initialItems: ShoppingListItem[];
  signedUrls: Record<string, string>;
  renderedAt: number;
  /** Design preview: local state only, no server sync. */
  preview?: boolean;
}) {
  const [items, setItems] = useState<ShoppingListItem[]>(initialItems);
  const [queue, setQueue] = useState<StatusOp[]>([]);
  const [sync, setSync] = useState<SyncState>("connecting");
  const queueRef = useRef<StatusOp[]>([]);
  const flushing = useRef(false);

  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);

  // Server re-render (router.refresh / revalidate) → adopt fresh data.
  useEffect(() => setItems(initialItems), [initialItems]);

  const commitQueue = useCallback(
    (next: StatusOp[]) => {
      queueRef.current = next;
      setQueue(next);
      void saveQueue(householdId, next);
    },
    [householdId],
  );

  const refetch = useCallback(async () => {
    const { data, error } = await getSupabaseBrowser()
      .from("shopping_list_items")
      .select("*")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .is("cleared_at", null);
    if (!error && data) setItems(data as ShoppingListItem[]);
  }, [householdId]);

  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return;
    flushing.current = true;
    try {
      for (const op of [...queueRef.current]) {
        let res;
        try {
          res = await setShoppingItemStatus({ id: op.itemId, status: op.status, base_version: op.baseVersion });
        } catch {
          setSync("offline");
          return; // network failure: keep op, retry later
        }
        commitQueue(removeOp(queueRef.current, op));
        if (res.ok && res.data) {
          const row = res.data;
          setItems((cur) => mergeRealtimeRow(cur, row));
        } else if (!res.ok) {
          toast.error(res.error);
        }
      }
    } finally {
      flushing.current = false;
    }
  }, [commitQueue]);

  // Restore offline state (queue + newer snapshot) once on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [q, snap] = await Promise.all([loadQueue(householdId), loadSnapshot(householdId)]);
      if (!alive) return;
      queueRef.current = q;
      setQueue(q);
      if (snap && snap.savedAt > renderedAt && !navigator.onLine) setItems(snap.items);
      if (q.length) void flush();
    })();
    return () => {
      alive = false;
    };
  }, [householdId, renderedAt, flush]);

  // Persist the latest list for offline use.
  useEffect(() => {
    const t = setTimeout(() => void saveSnapshot(householdId, items), 400);
    return () => clearTimeout(t);
  }, [householdId, items]);

  // Realtime: other members' changes appear instantly. RLS filters rows.
  useEffect(() => {
    if (preview) {
      setSync("live");
      return;
    }
    const supabase = getSupabaseBrowser();
    let cancelled = false;
    const channel = supabase.channel(`grocery:${householdId}`);
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "shopping_list_items", filter: `household_id=eq.${householdId}` },
      (payload) => {
        const row = payload.new as ShoppingListItem | undefined;
        if (row && "id" in row) setItems((cur) => mergeRealtimeRow(cur, row));
        else if (payload.eventType === "DELETE") {
          const oldId = (payload.old as { id?: string }).id;
          if (oldId) setItems((cur) => cur.filter((i) => i.id !== oldId));
        }
      },
    );
    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSync("live");
          void refetch(); // close any gap while we were disconnected
          void flush();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setSync(navigator.onLine ? "connecting" : "offline");
        }
      });
    })();

    const goOnline = () => {
      setSync("connecting");
      void flush();
      void refetch();
    };
    const goOffline = () => setSync("offline");
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (!navigator.onLine) setSync("offline");

    return () => {
      cancelled = true;
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      void supabase.removeChannel(channel);
    };
  }, [householdId, refetch, flush, preview]);

  const setStatus = useCallback(
    (item: ShoppingListItem, status: ShoppingItemStatus) => {
      if (preview) {
        setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, status, version: i.version + 1 } : i)));
        return;
      }
      commitQueue(enqueueOp(queueRef.current, { itemId: item.id, status, baseVersion: item.version, queuedAt: Date.now() }));
      void flush();
    },
    [commitQueue, flush, preview],
  );

  const upsertLocal = useCallback((row: ShoppingListItem) => setItems((cur) => mergeRealtimeRow(cur, row)), []);
  const removeLocal = useCallback((id: string) => setItems((cur) => cur.filter((i) => i.id !== id)), []);

  const visible = useMemo(() => applyPendingOps(items, queue), [items, queue]);

  return { items: visible, pendingOps: queue.length, sync, setStatus, upsertLocal, removeLocal, refetch };
}
