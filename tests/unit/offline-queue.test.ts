import { describe, expect, it } from "vitest";
import { applyPendingOps, enqueueOp, mergeRealtimeRow, removeOp, type StatusOp } from "@/lib/offline-queue";
import type { ShoppingListItem } from "@/lib/types";

function item(id: string, patch: Partial<ShoppingListItem> = {}): ShoppingListItem {
  return {
    id,
    household_id: "h",
    list_id: "l",
    catalog_product_id: null,
    inventory_item_id: null,
    category_id: null,
    name: id,
    quantity: 1,
    unit: "יח׳",
    brand: null,
    variant: null,
    notes: null,
    priority: "normal",
    status: "pending",
    image_path: null,
    added_by: null,
    purchased_by: null,
    purchased_at: null,
    cleared_at: null,
    deleted_at: null,
    version: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...patch,
  };
}

const op = (itemId: string, status: StatusOp["status"], queuedAt: number): StatusOp => ({ itemId, status, baseVersion: 1, queuedAt });

describe("offline status queue", () => {
  it("keeps only the latest op per item (tap, untap, tap → one op)", () => {
    let q: StatusOp[] = [];
    q = enqueueOp(q, op("a", "purchased", 1));
    q = enqueueOp(q, op("a", "pending", 2));
    q = enqueueOp(q, op("b", "purchased", 3));
    q = enqueueOp(q, op("a", "purchased", 4));
    expect(q).toEqual([op("b", "purchased", 3), op("a", "purchased", 4)]);
  });

  it("does not drop a newer op queued while an older one was sending", () => {
    const sent = op("a", "purchased", 1);
    const q = enqueueOp([sent], op("a", "pending", 2));
    expect(removeOp(q, sent)).toEqual([op("a", "pending", 2)]);
  });

  it("overlays pending ops on the server snapshot", () => {
    const items = [item("a"), item("b")];
    const out = applyPendingOps(items, [op("b", "purchased", 1)]);
    expect(out.map((i) => i.status)).toEqual(["pending", "purchased"]);
    expect(items[1].status).toBe("pending"); // immutable
  });
});

describe("mergeRealtimeRow", () => {
  it("adds new visible rows", () => {
    expect(mergeRealtimeRow([item("a")], item("b"))).toHaveLength(2);
  });
  it("ignores stale events with a lower version", () => {
    const cur = [item("a", { version: 5, status: "purchased" })];
    expect(mergeRealtimeRow(cur, item("a", { version: 4 }))[0].status).toBe("purchased");
  });
  it("applies newer versions", () => {
    const cur = [item("a", { version: 1 })];
    expect(mergeRealtimeRow(cur, item("a", { version: 2, quantity: 3 }))[0].quantity).toBe(3);
  });
  it("removes soft-deleted and cleared rows", () => {
    const cur = [item("a"), item("b")];
    expect(mergeRealtimeRow(cur, item("a", { version: 2, deleted_at: "x" })).map((i) => i.id)).toEqual(["b"]);
    expect(mergeRealtimeRow(cur, item("b", { version: 2, cleared_at: "x" })).map((i) => i.id)).toEqual(["a"]);
  });
  it("does not resurrect a deleted row it never had", () => {
    expect(mergeRealtimeRow([], item("z", { deleted_at: "x" }))).toEqual([]);
  });
});
