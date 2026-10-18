"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { nameScore } from "@/lib/ingredients";
import { aiConfigured, aiErrorMessage, contentForFile, fileForModel } from "@/server/ai/client";
import { extractStructured, receiptSchema } from "@/server/ai/extract";
import { assertOwnPath, dbFail, fail, ok, withHousehold } from "@/server/action-utils";

const createSchema = z.object({
  path: z.string().regex(/^[0-9a-f-]{36}\/receipts\/[0-9A-Za-z_.-]+$/),
  file_hash: z.string().regex(/^[0-9a-f]{64}$/),
  mime_type: z.enum(["image/webp", "image/jpeg", "application/pdf"]),
});

/**
 * Upload → extract → match. Nothing touches inventory here; the member reviews
 * every line and confirms (confirm_receipt runs the stock movements once).
 */
export async function createReceiptImport(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string; duplicateOf?: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail("קובץ לא תקין");
  if (!aiConfigured()) return fail("קריאת קבלות דורשת חיבור ל-AI, שעוד לא הוגדר.");

  return withHousehold<{ id: string; duplicateOf?: string }>(async (ctx, supabase) => {
    const hid = ctx.household.id;
    if (!assertOwnPath(hid, parsed.data.path)) return fail("קובץ לא מורשה");

    const { data: same } = await supabase.from("receipt_imports").select("id, status").eq("household_id", hid).eq("file_hash", parsed.data.file_hash).maybeSingle();
    if (same && (same.status === "extracted" || same.status === "confirmed")) return ok({ id: same.id as string, duplicateOf: same.id as string });
    // A failed or discarded attempt with the same file may be retried.
    if (same) await supabase.from("receipt_imports").delete().eq("id", same.id);

    const { data: imp, error } = await supabase
      .from("receipt_imports")
      .insert({ household_id: hid, file_path: parsed.data.path, file_hash: parsed.data.file_hash, mime_type: parsed.data.mime_type })
      .select("id")
      .single();
    if (error) return dbFail("receipts.create", error);

    try {
      const file = await fileForModel(supabase, parsed.data.path);
      const r = await extractStructured({
        supabase,
        householdId: hid,
        feature: "receipt",
        schema: receiptSchema,
        effort: "medium",
        system:
          "You read Israeli supermarket receipts (Hebrew). Extract the purchased product lines exactly as printed. Quantities: use the printed count, or the weight in kg for weighed items. Never invent lines or prices that are not on the receipt; when something is unreadable, leave the price null and mention it in uncertain.",
        content: [contentForFile(file), { type: "text", text: "Extract this receipt." }],
      });

      if (!r.is_receipt) {
        await supabase.from("receipt_imports").update({ status: "failed", notice: "התמונה לא נראית כמו קבלה." }).eq("id", imp.id);
        return ok({ id: imp.id as string });
      }

      const [{ data: inventory }, { data: pending }] = await Promise.all([
        supabase.from("inventory_items").select("id, name, unit").eq("household_id", hid).is("archived_at", null),
        supabase.from("shopping_list_items").select("id, name, inventory_item_id").eq("household_id", hid).in("status", ["pending", "purchased"]).is("deleted_at", null).is("cleared_at", null),
      ]);
      const usedShop = new Set<string>();
      const lines = r.lines.slice(0, 150).map((l, position) => {
        const scored = (inventory ?? []).map((i) => ({ i, s: nameScore(l.name, i.name as string) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
        const best = scored[0];
        const tie = scored[1] && best && scored[1].s === best.s;
        const shop = (pending ?? []).find((p) => !usedShop.has(p.id) && ((best && p.inventory_item_id === best.i.id) || nameScore(l.name, p.name as string) >= 0.5));
        if (shop) usedShop.add(shop.id);
        const confident = best && !tie && best.s >= 0.5;
        return {
          household_id: hid,
          import_id: imp.id,
          position,
          raw_name: l.name.slice(0, 200),
          quantity: l.quantity > 0 ? Math.round(l.quantity * 1000) / 1000 : 1,
          unit: l.unit.slice(0, 20) || "יח׳",
          unit_price: l.unit_price,
          total_price: l.total_price,
          inventory_item_id: best ? (best.i.id as string) : null,
          shopping_item_id: shop?.id ?? null,
          match_confidence: best ? Math.round(best.s * 100) / 100 : null,
          // confident match → stock it; ambiguous → the member decides; unknown → new product
          decision: confident ? "stock" : best ? "review" : "new",
        };
      });
      if (lines.length) {
        const { error: le } = await supabase.from("receipt_import_lines").insert(lines);
        if (le) return dbFail("receipts.lines", le);
      }

      // Possible duplicate: same store, date and total as an earlier confirmed receipt
      let notice = r.uncertain.length ? `לא ברור: ${r.uncertain.join("; ")}`.slice(0, 450) : null;
      if (r.store && r.purchased_on && r.total != null) {
        const { data: twin } = await supabase
          .from("receipt_imports")
          .select("id")
          .eq("household_id", hid)
          .eq("status", "confirmed")
          .eq("purchased_on", r.purchased_on)
          .eq("total", r.total)
          .ilike("store", r.store)
          .limit(1)
          .maybeSingle();
        if (twin) notice = "נראה שקבלה עם אותה חנות, תאריך וסכום כבר נקלטה. בדקו לפני אישור.";
      }
      await supabase
        .from("receipt_imports")
        .update({
          store: r.store?.slice(0, 120) ?? null,
          purchased_on: r.purchased_on && /^\d{4}-\d{2}-\d{2}$/.test(r.purchased_on) ? r.purchased_on : null,
          total: r.total,
          notice,
        })
        .eq("id", imp.id);
      revalidatePath("/receipts");
      return ok({ id: imp.id as string });
    } catch (e) {
      await supabase.from("receipt_imports").update({ status: "failed", notice: aiErrorMessage(e).slice(0, 450) }).eq("id", imp.id);
      return ok({ id: imp.id as string });
    }
  });
}

const lineSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["review", "stock", "new", "ignore"]),
  inventory_item_id: z.uuid().nullable(),
  quantity: z.coerce.number().positive().max(100000),
});

export async function updateReceiptLines(importId: string, lines: z.input<typeof lineSchema>[]): Promise<ActionResult<null>> {
  const parsed = z.array(lineSchema).max(200).safeParse(lines);
  if (!z.uuid().safeParse(importId).success || !parsed.success) return fail("קלט לא תקין");
  return withHousehold(async (ctx, supabase) => {
    for (const l of parsed.data) {
      const { error } = await supabase
        .from("receipt_import_lines")
        .update({ decision: l.decision, inventory_item_id: l.decision === "new" ? null : l.inventory_item_id, quantity: l.quantity })
        .eq("id", l.id)
        .eq("import_id", importId)
        .eq("household_id", ctx.household.id);
      if (error) return dbFail("receipts.line", error);
    }
    return ok(null);
  });
}

export async function confirmReceipt(importId: string): Promise<ActionResult<{ stocked: number }>> {
  if (!z.uuid().safeParse(importId).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { count } = await supabase.from("receipt_import_lines").select("id", { count: "exact", head: true }).eq("import_id", importId).eq("decision", "review");
    if (count) return fail("יש שורות שעדיין צריך להחליט עליהן");
    const { data, error } = await supabase.rpc("confirm_receipt", { p_import: importId });
    if (error) return dbFail("receipts.confirm", error);
    revalidatePath("/receipts");
    revalidatePath("/inventory");
    revalidatePath("/shopping");
    revalidatePath("/");
    return ok({ stocked: Number(data ?? 0) });
  });
}

export async function discardReceipt(importId: string): Promise<ActionResult<null>> {
  if (!z.uuid().safeParse(importId).success) return fail("מזהה לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("receipt_imports").update({ status: "discarded" }).eq("id", importId).eq("household_id", ctx.household.id).neq("status", "confirmed");
    if (error) return dbFail("receipts.discard", error);
    revalidatePath("/receipts");
    return ok(null);
  });
}
