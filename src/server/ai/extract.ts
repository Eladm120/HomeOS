import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AI_MODEL, AiNotConfiguredError, AiRefusalError, FALLBACK_BETA, getAi, recordUsage, type AiFeature } from "./client";

/**
 * One structured extraction call (receipts, recipes, bills, plant photos,
 * product photos). The schema is enforced by the API; the result is still a
 * draft that the user reviews before anything is saved.
 */
export async function extractStructured<S extends z.ZodType>({
  supabase,
  householdId,
  feature,
  schema,
  system,
  content,
  effort = "medium",
}: {
  supabase: SupabaseClient;
  householdId: string;
  feature: AiFeature;
  schema: S;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S>> {
  const ai = getAi();
  if (!ai) throw new AiNotConfiguredError();
  const response = await ai.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    system,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    messages: [{ role: "user", content }],
  });
  await recordUsage(supabase, householdId, feature, response.usage, response.model);
  if (response.stop_reason === "refusal") throw new AiRefusalError();
  if (response.parsed_output == null) throw new Error("לא הצלחנו לקרוא את התוכן");
  return response.parsed_output as z.infer<S>;
}

// ---- Schemas -------------------------------------------------------------------

export const receiptSchema = z.object({
  is_receipt: z.boolean().describe("false if the image is not a shopping receipt"),
  store: z.string().nullable().describe("Store or chain name as printed"),
  purchased_on: z.string().nullable().describe("Purchase date as YYYY-MM-DD, null if not legible"),
  total: z.number().nullable().describe("Grand total paid, in the receipt currency"),
  currency: z.string().describe("ISO code, ILS for shekels"),
  lines: z
    .array(
      z.object({
        name: z.string().describe("Product name, in Hebrew as printed, expanded from abbreviations only when certain"),
        quantity: z.number().describe("Units or weight bought; 1 when not printed"),
        unit: z.string().describe("יח׳ for units, ק״ג for weighed products, ליטר, etc."),
        unit_price: z.number().nullable(),
        total_price: z.number().nullable(),
      }),
    )
    .describe("Purchased product lines only: skip deposits (פיקדון), discounts, bags, payment and tax lines"),
  uncertain: z.array(z.string()).describe("Short notes about anything that was hard to read"),
});
export type ReceiptExtraction = z.infer<typeof receiptSchema>;

export const recipeSchema = z.object({
  is_recipe: z.boolean(),
  title: z.string(),
  description: z.string().nullable(),
  servings: z.number().nullable(),
  prep_minutes: z.number().nullable(),
  cook_minutes: z.number().nullable(),
  ingredients: z.array(
    z.object({
      name: z.string().describe("Ingredient name in Hebrew, without the quantity"),
      quantity: z.number().nullable(),
      unit: z.string().nullable().describe("Hebrew unit such as גרם, כוס, כף, כפית, יח׳; null for countable items"),
      optional: z.boolean(),
    }),
  ),
  steps: z.array(z.string()).describe("Preparation steps in Hebrew, in order"),
});
export type RecipeExtraction = z.infer<typeof recipeSchema>;

export const productPhotoSchema = z.object({
  name: z.string().describe("Generic product name in Hebrew, e.g. 'חלב 3%'"),
  brand: z.string().nullable(),
  barcode: z.string().nullable().describe("Digits of the barcode if clearly visible, else null"),
  unit: z.string().describe("Best unit for counting this product at home, e.g. יח׳, ליטר, ק״ג"),
  confidence: z.number().describe("0-1, how sure you are"),
});
