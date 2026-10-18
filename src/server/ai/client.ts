import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/server/log";

/**
 * Single entry point to the model. Server-only: the API key never reaches the
 * browser. When ANTHROPIC_API_KEY is not configured every AI feature reports
 * "not connected" and the rest of the app keeps working.
 */
export const AI_MODEL = "claude-opus-5-5";

/** Server-side retry on Anthropic's recommended model when a request is declined for policy reasons. */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export type AiFeature = "assistant" | "receipt" | "recipe" | "brief" | "bill" | "plant" | "barcode" | "document";

let client: Anthropic | null | undefined;

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function getAi(): Anthropic | null {
  if (client !== undefined) return client;
  client = aiConfigured() ? new Anthropic({ maxRetries: 2, timeout: 120_000 }) : null;
  return client;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("עוזר ה-AI עוד לא מחובר. יש להוסיף מפתח API בהגדרות השרת.");
  }
}

export class AiRefusalError extends Error {
  constructor() {
    super("לא אוכל לעזור בבקשה הזו.");
  }
}

/** Record token usage for cost visibility (best effort; never blocks the feature). */
export async function recordUsage(
  supabase: SupabaseClient,
  householdId: string,
  feature: AiFeature,
  usage: { input_tokens?: number | null; output_tokens?: number | null } | null | undefined,
  model: string,
) {
  const { error } = await supabase.from("ai_usage_events").insert({
    household_id: householdId,
    feature,
    model,
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
  });
  if (error) log.warn("ai.usage_record_failed", { code: error.code });
}

/** Hebrew message for SDK errors; details go to the log only. */
export function aiErrorMessage(e: unknown): string {
  if (e instanceof AiNotConfiguredError || e instanceof AiRefusalError) return e.message;
  if (e instanceof Anthropic.RateLimitError) return "יותר מדי בקשות כרגע. נסו שוב בעוד דקה.";
  if (e instanceof Anthropic.AuthenticationError) return "מפתח ה-API של ה-AI לא תקין. בדקו את ההגדרות.";
  if (e instanceof Anthropic.BadRequestError) {
    log.error("ai.bad_request", { message: e.message });
    return "הבקשה ל-AI נכשלה. נסו לנסח אחרת.";
  }
  if (e instanceof Anthropic.APIError) {
    log.error("ai.api_error", { status: e.status, message: e.message });
    return "שירות ה-AI לא זמין כרגע. נסו שוב בעוד רגע.";
  }
  log.error("ai.unexpected", { message: (e as Error)?.message });
  return "משהו השתבש בעיבוד. נסו שוב.";
}

/** Download a household file from private storage as base64 for the model (as the signed-in user). */
export async function fileForModel(
  supabase: SupabaseClient,
  path: string,
): Promise<{ type: "image"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } | { type: "pdf"; data: string }> {
  const { data, error } = await supabase.storage.from("household-media").download(path);
  if (error || !data) throw new Error("לא ניתן לקרוא את הקובץ");
  const buf = Buffer.from(await data.arrayBuffer());
  const b64 = buf.toString("base64");
  if (path.endsWith(".pdf")) return { type: "pdf", data: b64 };
  const media_type = path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return { type: "image", media_type, data: b64 };
}

export function contentForFile(file: Awaited<ReturnType<typeof fileForModel>>): Anthropic.Beta.BetaContentBlockParam {
  return file.type === "pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.data } }
    : { type: "image", source: { type: "base64", media_type: file.media_type, data: file.data } };
}
