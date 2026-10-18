"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, InventoryItem } from "@/lib/types";
import {
  createInventoryItemSchema,
  flattenZodError,
  inventoryItemSchema,
  movementSchema,
  type CreateInventoryItemInput,
  type InventoryItemInput,
  type MovementInput,
} from "@/lib/validation";
import { escapeLike } from "@/lib/utils";
import { assertOwnPath, dbFail, fail, ok, withHousehold } from "@/server/action-utils";
import { autoRestock } from "@/server/auto-restock";

/** Inventory row plus whether this change just put it on the shopping list. */
export type InventoryChange = InventoryItem & { auto_listed?: boolean };

function revalidateInventory(id?: string) {
  revalidatePath("/inventory");
  if (id) revalidatePath(`/inventory/${id}`);
  revalidatePath("/");
}

export async function createInventoryItem(input: CreateInventoryItemInput): Promise<ActionResult<InventoryItem>> {
  const parsed = createInventoryItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  const { initial_quantity, ...fields } = parsed.data;

  return withHousehold(async (ctx, supabase) => {
    if (!assertOwnPath(ctx.household.id, fields.image_path)) return fail("קובץ לא מורשה");
    const { data: created, error } = await supabase
      .from("inventory_items")
      .insert({ ...fields, household_id: ctx.household.id })
      .select("id")
      .single();
    if (error) return dbFail("inventory.create", error);

    const { data: item, error: mvErr } = await supabase.rpc("inventory_apply_movement", {
      p_item_id: created.id,
      p_kind: "initial",
      p_quantity: initial_quantity,
      p_note: null,
      p_to_location: null,
      p_idempotency_key: `initial:${created.id}`,
      p_source: "manual",
      p_source_ref: null,
    });
    if (mvErr) {
      // Keep the two-step create atomic from the user's point of view.
      await supabase.from("inventory_items").delete().eq("id", created.id);
      return dbFail("inventory.initial_movement", mvErr);
    }
    revalidateInventory();
    return ok(item as InventoryItem);
  });
}

export async function updateInventoryItem(id: string, input: InventoryItemInput): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(id).success) return fail("מזהה לא תקין");
  const parsed = inventoryItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  // Location changes go through a 'transfer' movement so they are auditable.
  const { location_id, ...fields } = parsed.data;

  return withHousehold(async (ctx, supabase) => {
    if (!assertOwnPath(ctx.household.id, fields.image_path)) return fail("קובץ לא מורשה");
    const { data: current } = await supabase
      .from("inventory_items")
      .select("location_id")
      .eq("id", id)
      .eq("household_id", ctx.household.id)
      .maybeSingle();
    if (!current) return fail("המוצר לא נמצא");

    const { error } = await supabase.from("inventory_items").update(fields).eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("inventory.update", error);

    if (location_id && location_id !== current.location_id) {
      const { error: mvErr } = await supabase.rpc("inventory_apply_movement", {
        p_item_id: id,
        p_kind: "transfer",
        p_quantity: 0,
        p_note: null,
        p_to_location: location_id,
        p_idempotency_key: null,
        p_source: "manual",
        p_source_ref: null,
      });
      if (mvErr) return dbFail("inventory.transfer", mvErr);
    }
    // A raised minimum can put the item under it right away.
    const { data: fresh } = await supabase.from("inventory_items").select("id, quantity, min_threshold").eq("id", id).maybeSingle();
    if (fresh && (await autoRestock(supabase, ctx.household.id, fresh))) revalidatePath("/shopping");
    revalidateInventory(id);
    return ok(null);
  });
}

export async function applyInventoryMovement(input: MovementInput): Promise<ActionResult<InventoryChange>> {
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  const m = parsed.data;

  return withHousehold(async (ctx, supabase) => {
    const { data, error } = await supabase.rpc("inventory_apply_movement", {
      p_item_id: m.item_id,
      p_kind: m.kind,
      p_quantity: m.quantity,
      p_note: m.note,
      p_to_location: m.kind === "transfer" ? m.to_location_id : null,
      p_idempotency_key: m.idempotency_key ?? null,
      p_source: "manual",
      p_source_ref: null,
    });
    if (error) return dbFail("inventory.movement", error);
    const item = data as InventoryItem;
    // Using something up (or correcting the count) can cross the minimum: list it right away.
    const auto_listed = m.kind === "consume" || m.kind === "discard" || m.kind === "correct" ? await autoRestock(supabase, ctx.household.id, item) : false;
    if (auto_listed) revalidatePath("/shopping");
    revalidateInventory(m.item_id);
    return ok({ ...item, auto_listed });
  });
}

export async function archiveInventoryItem(id: string, archived = true): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase
      .from("inventory_items")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", id)
      .eq("household_id", ctx.household.id);
    if (error) return dbFail("inventory.archive", error);
    revalidateInventory(id);
    return ok(null);
  });
}

export async function deleteInventoryItem(id: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("inventory_items").delete().eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("inventory.delete", error);
    revalidateInventory();
    return ok(null);
  });
}

const bulkSchema = z.object({
  location_id: z.uuid().nullable(),
  category_id: z.uuid().nullable(),
  lines: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        quantity: z.coerce.number().min(0).max(1_000_000),
        unit: z.string().trim().min(1).max(20),
      }),
    )
    .min(1, "אין שורות לייבוא")
    .max(200, "עד 200 מוצרים בכל פעם"),
});

/**
 * Guided initial setup: create many inventory items at once. Existing items
 * (same name, case-insensitive) are skipped, so re-running a draft is safe.
 */
export async function bulkCreateInventory(
  input: z.input<typeof bulkSchema>,
): Promise<ActionResult<{ created: number; skipped: string[] }>> {
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  const { lines, location_id, category_id } = parsed.data;

  return withHousehold(async (ctx, supabase) => {
    const { data: existing } = await supabase
      .from("inventory_items")
      .select("name")
      .eq("household_id", ctx.household.id)
      .is("archived_at", null);
    const taken = new Set((existing ?? []).map((r) => (r.name as string).trim().toLowerCase()));

    const skipped: string[] = [];
    let created = 0;
    for (const line of lines) {
      const key = line.name.toLowerCase();
      if (taken.has(key)) {
        skipped.push(line.name);
        continue;
      }
      taken.add(key);
      const { data: row, error } = await supabase
        .from("inventory_items")
        .insert({ household_id: ctx.household.id, name: line.name, unit: line.unit, location_id, category_id })
        .select("id")
        .single();
      if (error) return dbFail("inventory.bulk_insert", error);
      const { error: mvErr } = await supabase.rpc("inventory_apply_movement", {
        p_item_id: row.id,
        p_kind: "initial",
        p_quantity: line.quantity,
        p_note: "הזנה ראשונית",
        p_to_location: null,
        p_idempotency_key: `initial:${row.id}`,
        p_source: "manual",
        p_source_ref: null,
      });
      if (mvErr) return dbFail("inventory.bulk_movement", mvErr);
      created++;
    }
    revalidateInventory();
    return ok({ created, skipped });
  });
}

/** Lookup by barcode in the household's own inventory and catalog. */
export async function findByBarcode(
  barcode: string,
): Promise<ActionResult<{ inventoryItemId: string | null; catalog: { name: string; brand: string | null; image_path: string | null } | null }>> {
  if (!/^[0-9A-Za-z-]{4,32}$/.test(barcode)) return fail("ברקוד לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const [{ data: inv }, { data: cat }] = await Promise.all([
      supabase.from("inventory_items").select("id").eq("household_id", ctx.household.id).eq("barcode", barcode).is("archived_at", null).limit(1).maybeSingle(),
      supabase.from("product_catalog").select("name, brand, image_path").eq("household_id", ctx.household.id).eq("barcode", barcode).maybeSingle(),
    ]);
    return ok({ inventoryItemId: (inv?.id as string) ?? null, catalog: cat ?? null });
  });
}

export async function searchInventoryByName(q: string): Promise<ActionResult<Pick<InventoryItem, "id" | "name" | "unit" | "quantity">[]>> {
  const term = q.trim().slice(0, 60);
  if (!term) return ok([]);
  return withHousehold(async (ctx, supabase) => {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, name, unit, quantity")
      .eq("household_id", ctx.household.id)
      .is("archived_at", null)
      .ilike("name", `%${escapeLike(term)}%`)
      .limit(8);
    if (error) return dbFail("inventory.search", error);
    return ok(data as Pick<InventoryItem, "id" | "name" | "unit" | "quantity">[]);
  });
}
