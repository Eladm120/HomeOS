import { z } from "zod";
import { optionalDate, optionalId, optionalText, storagePath } from "@/lib/validation";

/** Validation for Phase 2+ module inputs. Server actions re-check every field. */

const optionalUrl = z
  .union([z.literal(""), z.null(), z.undefined(), z.string().trim().max(2000).regex(/^https?:\/\/\S+$/i, "קישור לא תקין")])
  .transform((v) => (v ? v : null));

const optionalMoney = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.number({ error: "סכום לא תקין" }).min(0, "סכום לא יכול להיות שלילי").max(100_000_000)])
  .transform((v) => (v === "" || v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100));

const optionalInt = (min: number, max: number) =>
  z
    .union([z.literal(""), z.null(), z.undefined(), z.coerce.number().int("מספר שלם בלבד").min(min).max(max)])
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)));

const priority = z.enum(["low", "normal", "high"]).default("normal");
const currency = z.string().regex(/^[A-Z]{3}$/).default("ILS");

// ---- Shopping planner ----------------------------------------------------------
export const plannedPurchaseSchema = z.object({
  name: z.string().trim().min(1, "יש להזין שם מוצר").max(160),
  room_id: optionalId,
  project_id: optionalId,
  store: optionalText(120),
  url: optionalUrl,
  price: optionalMoney,
  currency,
  quantity: z.coerce.number().int().min(1).max(1000).default(1),
  priority,
  status: z.enum(["idea", "researching", "considering", "ready", "purchased", "canceled"]).default("idea"),
  dimensions: optionalText(200),
  color: optionalText(80),
  material: optionalText(120),
  image_path: storagePath,
  notes: optionalText(5000),
});
export type PlannedPurchaseInput = z.input<typeof plannedPurchaseSchema>;

export const purchaseAlternativeSchema = z.object({
  name: z.string().trim().min(1, "יש להזין שם").max(160),
  store: optionalText(120),
  url: optionalUrl,
  price: optionalMoney,
  currency,
  dimensions: optionalText(200),
  color: optionalText(80),
  material: optionalText(120),
  image_path: storagePath,
  notes: optionalText(2000),
});
export type PurchaseAlternativeInput = z.input<typeof purchaseAlternativeSchema>;

// ---- Projects & repairs ------------------------------------------------------------
export const projectSchema = z.object({
  kind: z.enum(["project", "repair"]).default("project"),
  title: z.string().trim().min(1, "יש להזין כותרת").max(160),
  description: optionalText(5000),
  room_id: optionalId,
  priority,
  status: z.enum(["idea", "planned", "in_progress", "waiting", "completed", "canceled"]).default("idea"),
  owner_id: optionalId,
  due_on: optionalDate,
  estimated_cost: optionalMoney,
  actual_cost: optionalMoney,
  provider_id: optionalId,
  symptoms: optionalText(5000),
  first_reported_on: optionalDate,
  warranty_notes: optionalText(2000),
  resolution: optionalText(5000),
  cover_path: storagePath,
  notes: optionalText(5000),
  appliance_id: optionalId,
});
export type ProjectInput = z.input<typeof projectSchema>;

export const projectTaskSchema = z.object({
  title: z.string().trim().min(1, "יש להזין משימה").max(200),
  assignee_id: optionalId,
  due_on: optionalDate,
});

export const projectActivitySchema = z.object({
  kind: z.enum(["note", "troubleshooting", "technician_visit", "quote", "status_change", "resolution"]).default("note"),
  body: z.string().trim().min(1, "יש לכתוב משהו").max(5000),
  occurred_on: optionalDate,
  amount: optionalMoney,
  provider_id: optionalId,
});
export type ProjectActivityInput = z.input<typeof projectActivitySchema>;

export const serviceProviderSchema = z.object({
  name: z.string().trim().min(1, "יש להזין שם").max(120),
  trade: optionalText(80),
  phone: optionalText(40),
  email: z
    .union([z.literal(""), z.null(), z.undefined(), z.email("כתובת מייל לא תקינה")])
    .transform((v) => (v ? v : null)),
  notes: optionalText(2000),
});
export type ServiceProviderInput = z.input<typeof serviceProviderSchema>;

export const attachmentSchema = z.object({
  entity_type: z.enum(["project", "planned_purchase", "appliance", "plant", "utility_bill"]),
  entity_id: z.uuid(),
  path: z.string().regex(/^[0-9a-f-]{36}\/[a-z-]+\/[0-9A-Za-z_.-]+$/, "נתיב קובץ לא תקין"),
  file_name: optionalText(200),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"]),
  size_bytes: optionalInt(0, 26_214_400),
  caption: optionalText(500),
});
export type AttachmentInput = z.input<typeof attachmentSchema>;

// ---- Chores ----------------------------------------------------------------------
export const choreSchema = z
  .object({
    title: z.string().trim().min(1, "יש להזין משימה").max(160),
    description: optionalText(2000),
    room_id: optionalId,
    assignee_id: optionalId,
    frequency: z.enum(["once", "daily", "weekly", "biweekly", "monthly", "quarterly", "yearly", "custom"]).default("weekly"),
    interval_days: optionalInt(1, 3650),
    next_due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין"),
    priority,
    remind: z.boolean().default(true),
    notes: optionalText(2000),
  })
  .refine((c) => c.frequency !== "custom" || !!c.interval_days, { message: "כל כמה ימים?", path: ["interval_days"] });
export type ChoreInput = z.input<typeof choreSchema>;

// ---- Recipes & meals ---------------------------------------------------------------
export const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(160),
  quantity: z
    .union([z.literal(""), z.null(), z.undefined(), z.coerce.number().positive().max(1_000_000)])
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v))),
  unit: optionalText(30),
  note: optionalText(300),
  optional: z.boolean().default(false),
  inventory_item_id: optionalId,
});
export type IngredientInput = z.input<typeof ingredientSchema>;

export const recipeSchema = z.object({
  title: z.string().trim().min(1, "יש להזין שם למתכון").max(200),
  description: optionalText(3000),
  image_path: storagePath,
  image_url: z
    .union([z.literal(""), z.null(), z.undefined(), z.string().trim().max(2000).regex(/^https:\/\/\S+$/i)])
    .transform((v) => (v ? v : null)),
  source_url: optionalUrl,
  source_platform: z.enum(["manual", "website", "instagram", "tiktok", "youtube", "facebook", "photo", "other"]).default("manual"),
  prep_minutes: optionalInt(0, 10000),
  cook_minutes: optionalInt(0, 10000),
  servings: z
    .union([z.literal(""), z.null(), z.undefined(), z.coerce.number().positive().max(1000)])
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v))),
  category: optionalText(60),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  notes: optionalText(5000),
  is_favorite: z.boolean().default(false),
  rating: optionalInt(1, 5),
  ingredients: z.array(ingredientSchema).max(200).default([]),
  steps: z.array(z.string().trim().min(1).max(3000)).max(200).default([]),
});
export type RecipeInput = z.input<typeof recipeSchema>;

export const mealEntrySchema = z
  .object({
    plan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין"),
    slot: z.enum(["breakfast", "lunch", "dinner", "snack"]).default("dinner"),
    recipe_id: optionalId,
    title: optionalText(160),
    servings: z
      .union([z.literal(""), z.null(), z.undefined(), z.coerce.number().positive().max(1000)])
      .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v))),
    notes: optionalText(1000),
  })
  .refine((m) => !!m.recipe_id || !!m.title, { message: "בחרו מתכון או כתבו מה אוכלים", path: ["title"] });
export type MealEntryInput = z.input<typeof mealEntrySchema>;
