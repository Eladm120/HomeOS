"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, ShoppingListItem } from "@/lib/types";
import { flattenZodError, itemStatusSchema, shoppingItemSchema, type ShoppingItemInput } from "@/lib/validation";
import { escapeLike } from "@/lib/utils";
import { assertOwnPath, dbFail, fail, ok, withHousehold } from "@/server/action-utils";
import type { HouseholdContext } from "@/server/context";
import type { SupabaseClient } from "@supabase/supabase-js";

const ITEM_COLUMNS =
  "id, household_id, list_id, catalog_product_id, inventory_item_id, category_id, name, quantity, unit, brand, variant, notes, priority, status, image_path, added_by, purchased_by, purchased_at, cleared_at, deleted_at, version, created_at, updated_at";

async function defaultListId(supabase: SupabaseClient, householdId: string): Promise<string | null> {
  const { data } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("household_id", householdId)
    .eq("is_default", true)
    .maybeSingle();
  if (data) return data.id as string;
  const { data: created } = await supabase
    .from("shopping_lists")
    .insert({ household_id: householdId, name: "סופר", is_default: true })
    .select("id")
    .single();
  return (created?.id as string) ?? null;
}

async function upsertCatalogProduct(
  supabase: SupabaseClient,
  ctx: HouseholdContext,
  item: { name: string; brand: string | null; variant: string | null; category_id: string | null; unit: string; image_path: string | null },
): Promise<string | null> {
  let query = supabase
    .from("product_catalog")
    .select("id, image_path")
    .eq("household_id", ctx.household.id)
    .ilike("name", escapeLike(item.name));
  query = item.brand ? query.ilike("brand", escapeLike(item.brand)) : query.is("brand", null);
  const { data: existing } = await query.limit(1).maybeSingle();

  if (existing) {
    if (item.image_path && item.image_path !== existing.image_path) {
      await supabase.from("product_catalog").update({ image_path: item.image_path }).eq("id", existing.id);
    }
    return existing.id as string;
  }
  const { data } = await supabase
    .from("product_catalog")
    .insert({
      household_id: ctx.household.id,
      name: item.name,
      brand: item.brand,
      variant: item.variant,
      category_id: item.category_id,
      default_unit: item.unit,
      image_path: item.image_path,
    })
    .select("id")
    .single();
  return (data?.id as string) ?? null;
}

export async function addShoppingItem(
  input: ShoppingItemInput,
): Promise<ActionResult<{ item: ShoppingListItem; merged: boolean }>> {
  const parsed = shoppingItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  const v = parsed.data;

  return withHousehold<{ item: ShoppingListItem; merged: boolean }>(async (ctx, supabase) => {
    if (!assertOwnPath(ctx.household.id, v.image_path)) return fail("קובץ לא מורשה");
    const listId = await defaultListId(supabase, ctx.household.id);
    if (!listId) return fail("לא נמצאה רשימת קניות");

    // Duplicate guard: same product (name + unit + brand) still pending → bump quantity.
    let dupQuery = supabase
      .from("shopping_list_items")
      .select(ITEM_COLUMNS)
      .eq("list_id", listId)
      .eq("status", "pending")
      .is("deleted_at", null)
      .is("cleared_at", null)
      .ilike("name", escapeLike(v.name))
      .eq("unit", v.unit);
    dupQuery = v.brand ? dupQuery.ilike("brand", escapeLike(v.brand)) : dupQuery.is("brand", null);
    const { data: dup } = await dupQuery.limit(1).maybeSingle();

    if (dup) {
      const { data, error } = await supabase
        .from("shopping_list_items")
        .update({
          quantity: Number(dup.quantity) + v.quantity,
          image_path: v.image_path ?? dup.image_path,
          notes: v.notes ?? dup.notes,
          priority: v.priority === "high" ? "high" : dup.priority,
        })
        .eq("id", dup.id)
        .select(ITEM_COLUMNS)
        .single();
      if (error) return dbFail("grocery.merge", error);
      revalidatePath("/shopping");
      return ok({ item: data as ShoppingListItem, merged: true });
    }

    let catalogId = v.catalog_product_id;
    if (!catalogId && v.save_to_catalog) {
      catalogId = await upsertCatalogProduct(supabase, ctx, v);
    }

    const { data, error } = await supabase
      .from("shopping_list_items")
      .insert({
        household_id: ctx.household.id,
        list_id: listId,
        name: v.name,
        quantity: v.quantity,
        unit: v.unit,
        category_id: v.category_id,
        brand: v.brand,
        variant: v.variant,
        notes: v.notes,
        priority: v.priority,
        image_path: v.image_path,
        catalog_product_id: catalogId,
        inventory_item_id: v.inventory_item_id,
      })
      .select(ITEM_COLUMNS)
      .single();
    if (error) return dbFail("grocery.add", error);
    revalidatePath("/shopping");
    revalidatePath("/");
    return ok({ item: data as ShoppingListItem, merged: false });
  });
}

export async function updateShoppingItem(
  id: string,
  input: ShoppingItemInput,
  baseVersion?: number,
): Promise<ActionResult<ShoppingListItem>> {
  if (!z.uuid().safeParse(id).success) return fail("מזהה לא תקין");
  const parsed = shoppingItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };
  const v = parsed.data;

  return withHousehold(async (ctx, supabase) => {
    if (!assertOwnPath(ctx.household.id, v.image_path)) return fail("קובץ לא מורשה");

    let catalogId = v.catalog_product_id;
    if (!catalogId && v.save_to_catalog) catalogId = await upsertCatalogProduct(supabase, ctx, v);

    let q = supabase
      .from("shopping_list_items")
      .update({
        name: v.name,
        quantity: v.quantity,
        unit: v.unit,
        category_id: v.category_id,
        brand: v.brand,
        variant: v.variant,
        notes: v.notes,
        priority: v.priority,
        image_path: v.image_path,
        catalog_product_id: catalogId,
        inventory_item_id: v.inventory_item_id,
      })
      .eq("id", id)
      .eq("household_id", ctx.household.id);
    // Optimistic concurrency: refuse to overwrite someone else's newer edit.
    if (baseVersion) q = q.eq("version", baseVersion);
    const { data, error } = await q.select(ITEM_COLUMNS).maybeSingle();
    if (error) return dbFail("grocery.update", error);
    if (!data) return fail("הפריט עודכן בינתיים על ידי מישהו אחר. הנתונים רועננו — נסו שוב.");
    revalidatePath("/shopping");
    return ok(data as ShoppingListItem);
  });
}

/** Idempotent "set status" (never a toggle) — safe to replay from the offline queue. */
export async function setShoppingItemStatus(input: {
  id: string;
  status: "pending" | "purchased" | "unavailable";
  base_version?: number;
}): Promise<ActionResult<ShoppingListItem | null>> {
  const parsed = itemStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };

  return withHousehold(async (ctx, supabase) => {
    const { data: current } = await supabase
      .from("shopping_list_items")
      .select(ITEM_COLUMNS)
      .eq("id", parsed.data.id)
      .eq("household_id", ctx.household.id)
      .maybeSingle();
    // Deleted or cleared meanwhile: nothing to do, not an error.
    if (!current || current.deleted_at) return ok(null);
    if (current.status === parsed.data.status) return ok(current as ShoppingListItem);

    const { data, error } = await supabase
      .from("shopping_list_items")
      .update({ status: parsed.data.status })
      .eq("id", parsed.data.id)
      .eq("household_id", ctx.household.id)
      .select(ITEM_COLUMNS)
      .single();
    if (error) return dbFail("grocery.status", error);
    return ok(data as ShoppingListItem);
  });
}

export async function deleteShoppingItem(id: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase
      .from("shopping_list_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("household_id", ctx.household.id);
    if (error) return dbFail("grocery.delete", error);
    revalidatePath("/shopping");
    return ok(null);
  });
}

export async function restoreShoppingItem(id: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(id).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase
      .from("shopping_list_items")
      .update({ deleted_at: null })
      .eq("id", id)
      .eq("household_id", ctx.household.id);
    if (error) return dbFail("grocery.restore", error);
    revalidatePath("/shopping");
    return ok(null);
  });
}

const finishTripSchema = z.object({
  to_inventory: z
    .array(
      z.object({
        shopping_item_id: z.uuid(),
        inventory_item_id: z.uuid().nullable(),
        quantity: z.coerce.number().positive().max(1_000_000),
      }),
    )
    .max(300),
});

/**
 * End of a supermarket trip: optionally move purchased items into inventory
 * (as auditable 'purchase' movements), then clear purchased items from the list.
 * Idempotent: each shopping item can only be added to inventory once.
 */
export async function finishShoppingTrip(input: z.input<typeof finishTripSchema>): Promise<
  ActionResult<{ cleared: number; stocked: number }>
> {
  const parsed = finishTripSchema.safeParse(input);
  if (!parsed.success) return { ok: false, ...flattenZodError(parsed.error) };

  return withHousehold(async (ctx, supabase) => {
    const ids = parsed.data.to_inventory.map((r) => r.shopping_item_id);
    const { data: items } = ids.length
      ? await supabase
          .from("shopping_list_items")
          .select(ITEM_COLUMNS)
          .eq("household_id", ctx.household.id)
          .eq("status", "purchased")
          .in("id", ids)
      : { data: [] as ShoppingListItem[] };
    const byId = new Map((items ?? []).map((i) => [i.id as string, i as ShoppingListItem]));

    let stocked = 0;
    for (const row of parsed.data.to_inventory) {
      const item = byId.get(row.shopping_item_id);
      if (!item) continue;
      let invId = row.inventory_item_id;

      if (!invId) {
        const { data: created, error: createErr } = await supabase
          .from("inventory_items")
          .insert({
            household_id: ctx.household.id,
            name: item.name,
            brand: item.brand,
            unit: item.unit,
            category_id: item.category_id,
            image_path: item.image_path,
            catalog_product_id: item.catalog_product_id,
          })
          .select("id")
          .single();
        if (createErr) return dbFail("trip.create_inventory", createErr);
        invId = created.id as string;
      }

      const { error: mvErr } = await supabase.rpc("inventory_apply_movement", {
        p_item_id: invId,
        p_kind: "purchase",
        p_quantity: row.quantity,
        p_note: null,
        p_to_location: null,
        p_idempotency_key: `grocery-purchase:${item.id}`,
        p_source: "grocery",
        p_source_ref: item.id,
      });
      if (mvErr) return dbFail("trip.movement", mvErr);
      if (!item.inventory_item_id) {
        await supabase.from("shopping_list_items").update({ inventory_item_id: invId }).eq("id", item.id);
      }
      stocked++;
    }

    const { data: cleared, error } = await supabase
      .from("shopping_list_items")
      .update({ cleared_at: new Date().toISOString() })
      .eq("household_id", ctx.household.id)
      .eq("status", "purchased")
      .is("cleared_at", null)
      .is("deleted_at", null)
      .select("id");
    if (error) return dbFail("trip.clear", error);

    revalidatePath("/shopping");
    revalidatePath("/inventory");
    revalidatePath("/");
    return ok({ cleared: cleared?.length ?? 0, stocked });
  });
}

/** Low stock → grocery list. Skips if a pending linked item already exists. */
export async function addInventoryItemToList(inventoryItemId: string): Promise<ActionResult<{ created: boolean }>> {
  if (!z.uuid().safeParse(inventoryItemId).success) return fail("מזהה לא תקין");
  return withHousehold<{ created: boolean }>(async (ctx, supabase) => {
    const { data: inv } = await supabase
      .from("inventory_items")
      .select("id, name, brand, unit, category_id, image_path, catalog_product_id, restock_quantity")
      .eq("id", inventoryItemId)
      .eq("household_id", ctx.household.id)
      .maybeSingle();
    if (!inv) return fail("המוצר לא נמצא");

    const { data: existing } = await supabase
      .from("shopping_list_items")
      .select("id")
      .eq("household_id", ctx.household.id)
      .eq("inventory_item_id", inv.id)
      .eq("status", "pending")
      .is("deleted_at", null)
      .is("cleared_at", null)
      .limit(1)
      .maybeSingle();
    if (existing) return ok({ created: false });

    const listId = await defaultListId(supabase, ctx.household.id);
    if (!listId) return fail("לא נמצאה רשימת קניות");
    const { error } = await supabase.from("shopping_list_items").insert({
      household_id: ctx.household.id,
      list_id: listId,
      name: inv.name,
      brand: inv.brand,
      unit: inv.unit,
      quantity: inv.restock_quantity ?? 1,
      category_id: inv.category_id,
      image_path: inv.image_path,
      catalog_product_id: inv.catalog_product_id,
      inventory_item_id: inv.id,
    });
    if (error) return dbFail("grocery.from_inventory", error);
    revalidatePath("/shopping");
    revalidatePath("/");
    return ok({ created: true });
  });
}
