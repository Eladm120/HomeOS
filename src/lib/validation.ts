import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `עד ${max} תווים`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const optionalId = z
  .union([z.uuid(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const positiveQty = z.coerce
  .number({ error: "כמות לא תקינה" })
  .positive("הכמות חייבת להיות גדולה מאפס")
  .max(1_000_000);

const nonNegativeQty = z.coerce.number({ error: "כמות לא תקינה" }).min(0, "כמות לא יכולה להיות שלילית").max(1_000_000);

const optionalNonNegative = z
  .union([z.literal(""), z.null(), z.undefined(), nonNegativeQty])
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)));

const optionalDate = z
  .union([z.literal(""), z.null(), z.undefined(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין")])
  .transform((v) => (v ? v : null));

const barcode = z
  .union([z.literal(""), z.null(), z.undefined(), z.string().trim().regex(/^[0-9A-Za-z-]{4,32}$/, "ברקוד לא תקין")])
  .transform((v) => (v ? v : null));

/** Storage path must live inside the household folder. Checked again server-side. */
export const storagePath = z
  .string()
  .regex(/^[0-9a-f-]{36}\/[a-z-]+\/[0-9A-Za-z_.-]+$/, "נתיב קובץ לא תקין")
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const householdNameSchema = z.object({
  name: z.string().trim().min(1, "יש להזין שם").max(80),
  rooms: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
});

export const inviteSchema = z.object({
  email: z
    .union([z.literal(""), z.email("כתובת מייל לא תקינה")])
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null)),
});

export const nameSchema = z.object({ name: z.string().trim().min(1, "יש להזין שם").max(60) });

export const shoppingItemSchema = z.object({
  name: z.string().trim().min(1, "יש להזין שם מוצר").max(120),
  quantity: positiveQty.default(1),
  unit: z.string().trim().max(20).default("יח׳"),
  category_id: optionalId,
  brand: optionalText(80),
  variant: optionalText(80),
  notes: optionalText(1000),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  image_path: storagePath,
  catalog_product_id: optionalId,
  inventory_item_id: optionalId,
  save_to_catalog: z.boolean().default(false),
});
export type ShoppingItemInput = z.input<typeof shoppingItemSchema>;

export const itemStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "purchased", "unavailable"]),
  base_version: z.number().int().positive().optional(),
});

export const inventoryItemSchema = z.object({
  name: z.string().trim().min(1, "יש להזין שם מוצר").max(120),
  brand: optionalText(80),
  barcode,
  category_id: optionalId,
  location_id: optionalId,
  unit: z.string().trim().min(1).max(20).default("יח׳"),
  min_threshold: optionalNonNegative,
  restock_quantity: optionalNonNegative,
  expires_on: optionalDate,
  image_path: storagePath,
  notes: optionalText(1000),
});
export type InventoryItemInput = z.input<typeof inventoryItemSchema>;

export const createInventoryItemSchema = inventoryItemSchema.extend({
  initial_quantity: nonNegativeQty.default(0),
});
export type CreateInventoryItemInput = z.input<typeof createInventoryItemSchema>;

export const movementSchema = z
  .object({
    item_id: z.uuid(),
    kind: z.enum(["add", "purchase", "consume", "correct", "discard", "transfer"]),
    quantity: nonNegativeQty.default(0),
    to_location_id: optionalId,
    note: optionalText(500),
    idempotency_key: z.string().min(8).max(100).optional(),
  })
  .refine((m) => m.kind !== "transfer" || !!m.to_location_id, {
    message: "יש לבחור מיקום יעד",
    path: ["to_location_id"],
  })
  .refine((m) => m.kind === "transfer" || m.kind === "correct" || m.quantity > 0, {
    message: "הכמות חייבת להיות גדולה מאפס",
    path: ["quantity"],
  });
export type MovementInput = z.input<typeof movementSchema>;

/**
 * Bulk text import, one product per line. Accepted forms:
 *   "חלב 3 ליטר"   "3 חלב"   "חלב x3"   "אורז, 2, ק״ג"   "חלב"
 */
export interface ParsedBulkLine {
  name: string;
  quantity: number;
  unit: string;
}

const UNIT_WORDS = [
  "יח׳", "יח'", "יחידות", "יחידה", "ליטר", "ל׳", "מ״ל", "מ\"ל", "קג", "ק״ג", "ק\"ג", "קילו", "גרם", "גר׳",
  "חבילה", "חבילות", "בקבוק", "בקבוקים", "קופסה", "קופסאות", "שקית", "שקיות", "גליל", "גלילים",
];

function normalizeUnit(u: string): string {
  const map: Record<string, string> = {
    "יח'": "יח׳", "יחידות": "יח׳", "יחידה": "יח׳", "ל׳": "ליטר", "מ\"ל": "מ״ל",
    "קג": "ק״ג", "ק\"ג": "ק״ג", "קילו": "ק״ג", "גר׳": "גרם", "חבילות": "חבילה",
    "בקבוקים": "בקבוק", "קופסאות": "קופסה", "שקיות": "שקית", "גלילים": "גליל",
  };
  return map[u] ?? u;
}

export function parseBulkLine(raw: string): ParsedBulkLine | null {
  // Strip list markers: "• ", "- ", "* ", "1. ", "2) "
  const line = raw.trim().replace(/^([•*-]\s*|\d+[.)]\s+)/, "").trim();
  if (!line) return null;

  if (line.includes(",")) {
    const [name, qty, unit] = line.split(",").map((s) => s.trim());
    const q = Number(qty);
    if (name) {
      return {
        name,
        quantity: Number.isFinite(q) && q >= 0 ? q : 1,
        unit: unit ? normalizeUnit(unit) : "יח׳",
      };
    }
  }

  const tokens = line.split(/\s+/);
  let quantity: number | null = null;
  let unit = "יח׳";
  const nameTokens: string[] = [];

  for (const tok of tokens) {
    const xMatch = tok.match(/^[x×*](\d+(?:\.\d+)?)$/i) ?? tok.match(/^(\d+(?:\.\d+)?)[x×*]$/i);
    if (quantity === null && xMatch) {
      quantity = Number(xMatch[1]);
      continue;
    }
    if (quantity === null && /^\d+(?:\.\d+)?$/.test(tok)) {
      quantity = Number(tok);
      continue;
    }
    if (UNIT_WORDS.includes(tok) && quantity !== null) {
      unit = normalizeUnit(tok);
      continue;
    }
    nameTokens.push(tok);
  }

  const name = nameTokens.join(" ").trim();
  if (!name) return null;
  return { name, quantity: quantity ?? 1, unit };
}

export function parseBulkText(text: string): ParsedBulkLine[] {
  return text
    .split(/\r?\n/)
    .map(parseBulkLine)
    .filter((l): l is ParsedBulkLine => l !== null);
}

export function flattenZodError(error: z.ZodError): { error: string; fieldErrors: Record<string, string[]> } {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { error: error.issues[0]?.message ?? "קלט לא תקין", fieldErrors };
}
