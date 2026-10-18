"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import type { RecipeDraft } from "@/lib/recipe-parse";
import { aiConfigured, aiErrorMessage, contentForFile, fileForModel } from "@/server/ai/client";
import { extractStructured, productPhotoSchema } from "@/server/ai/extract";
import { aiRecipeDraft } from "@/server/ai/recipe";
import { assertOwnPath, fail, ok, withHousehold } from "@/server/action-utils";
import { safeFetchText } from "@/server/safe-fetch";

const recipeInput = z.object({
  text: z.string().trim().max(20000).nullable(),
  image_path: z.string().regex(/^[0-9a-f-]{36}\/[a-z-]+\/[0-9A-Za-z_.-]+$/).nullable(),
  source_url: z.string().url().max(2000).nullable(),
});

/**
 * Turn a caption, pasted text or a photo/screenshot of a recipe into a draft.
 * The text is untrusted: it is passed as data and only structured fields come back.
 */
export async function extractRecipeWithAi(input: z.input<typeof recipeInput>): Promise<ActionResult<RecipeDraft>> {
  const parsed = recipeInput.safeParse(input);
  if (!parsed.success || (!parsed.data.text && !parsed.data.image_path)) return fail("אין מה לנתח");
  if (!aiConfigured()) return fail("זיהוי מתכון חכם דורש חיבור ל-AI, שעוד לא הוגדר.");
  return withHousehold<RecipeDraft>(async (ctx, supabase) => {
    if (!assertOwnPath(ctx.household.id, parsed.data.image_path)) return fail("קובץ לא מורשה");
    try {
      const image = parsed.data.image_path ? contentForFile(await fileForModel(supabase, parsed.data.image_path)) : undefined;
      return ok(await aiRecipeDraft({ supabase, householdId: ctx.household.id, text: parsed.data.text, image, sourceUrl: parsed.data.source_url }));
    } catch (e) {
      return fail(aiErrorMessage(e));
    }
  });
}

// ---- Product identification (barcode / photo) -----------------------------------

export interface ProductLookup {
  source: "household" | "open_food_facts" | "photo" | "none";
  barcode: string | null;
  name: string | null;
  brand: string | null;
  unit: string;
  image_url: string | null;
  inventory_item_id: string | null;
  confidence: number | null;
  note: string | null;
}

const productInput = z.object({
  barcode: z.string().regex(/^[0-9]{6,14}$/).nullable(),
  image_path: z.string().regex(/^[0-9a-f-]{36}\/[a-z-]+\/[0-9A-Za-z_.-]+$/).nullable(),
});

/**
 * Household catalog first, then the public Open Food Facts database, then (if a
 * photo was taken) the model. Every result is shown for confirmation — external
 * barcode data is often incomplete or wrong.
 */
export async function lookupProduct(input: z.input<typeof productInput>): Promise<ActionResult<ProductLookup>> {
  const parsed = productInput.safeParse(input);
  if (!parsed.success || (!parsed.data.barcode && !parsed.data.image_path)) return fail("אין ברקוד או תמונה");
  return withHousehold<ProductLookup>(async (ctx, supabase) => {
    const hid = ctx.household.id;
    if (!assertOwnPath(hid, parsed.data.image_path)) return fail("קובץ לא מורשה");
    const code = parsed.data.barcode;

    if (code) {
      const [{ data: inv }, { data: cat }] = await Promise.all([
        supabase.from("inventory_items").select("id, name, brand, unit").eq("household_id", hid).eq("barcode", code).is("archived_at", null).limit(1).maybeSingle(),
        supabase.from("product_catalog").select("name, brand, default_unit").eq("household_id", hid).eq("barcode", code).limit(1).maybeSingle(),
      ]);
      if (inv || cat) {
        return ok({
          source: "household",
          barcode: code,
          name: (inv?.name ?? cat?.name) as string,
          brand: (inv?.brand ?? cat?.brand ?? null) as string | null,
          unit: (inv?.unit ?? cat?.default_unit ?? "יח׳") as string,
          image_url: null,
          inventory_item_id: (inv?.id as string) ?? null,
          confidence: 1,
          note: inv ? "המוצר כבר במלאי" : "מוכר מהקטלוג של הבית",
        });
      }
      try {
        const { text } = await safeFetchText(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_he,brands,image_front_small_url,quantity`, "application/json");
        const j = JSON.parse(text) as { status?: number; product?: { product_name?: string; product_name_he?: string; brands?: string; image_front_small_url?: string; quantity?: string } };
        if (j.status === 1 && j.product && (j.product.product_name_he || j.product.product_name)) {
          return ok({
            source: "open_food_facts",
            barcode: code,
            name: (j.product.product_name_he || j.product.product_name || "").slice(0, 120),
            brand: j.product.brands?.split(",")[0]?.trim().slice(0, 80) ?? null,
            unit: "יח׳",
            image_url: j.product.image_front_small_url?.startsWith("https://") ? j.product.image_front_small_url : null,
            inventory_item_id: null,
            confidence: 0.7,
            note: `נמצא במאגר הציבורי Open Food Facts${j.product.quantity ? ` (${j.product.quantity})` : ""}. ודאו שהפרטים נכונים.`,
          });
        }
      } catch {
        /* public lookup is best effort */
      }
    }

    if (parsed.data.image_path && aiConfigured()) {
      try {
        const r = await extractStructured({
          supabase,
          householdId: hid,
          feature: "barcode",
          schema: productPhotoSchema,
          effort: "low",
          system: "Identify a grocery or household product from a photo for a Hebrew home-inventory app. If unsure, say so with a low confidence.",
          content: [contentForFile(await fileForModel(supabase, parsed.data.image_path)), { type: "text", text: "What product is this?" }],
        });
        return ok({
          source: "photo",
          barcode: code ?? (r.barcode && /^[0-9]{6,14}$/.test(r.barcode) ? r.barcode : null),
          name: r.name.slice(0, 120),
          brand: r.brand?.slice(0, 80) ?? null,
          unit: r.unit.slice(0, 20) || "יח׳",
          image_url: null,
          inventory_item_id: null,
          confidence: r.confidence,
          note: "זוהה מהתמונה. בדקו שהשם נכון.",
        });
      } catch (e) {
        return fail(aiErrorMessage(e));
      }
    }

    return ok({ source: "none", barcode: code, name: null, brand: null, unit: "יח׳", image_url: null, inventory_item_id: null, confidence: null, note: "לא מצאנו את המוצר. אפשר להזין שם בעצמכם." });
  });
}
