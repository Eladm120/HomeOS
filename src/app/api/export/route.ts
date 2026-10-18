import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getHouseholdContext } from "@/server/context";
import { log } from "@/server/log";

// Everything a member can read in their household, as one JSON file (data portability).
const TABLES = [
  "households", "rooms", "product_categories", "inventory_locations", "product_catalog", "inventory_items", "inventory_movements",
  "shopping_lists", "shopping_list_items", "activity_events", "service_providers", "home_projects", "project_tasks", "project_activities",
  "planned_purchases", "purchase_alternatives", "attachments", "chores", "chore_completions", "recipes", "recipe_ingredients", "recipe_steps",
  "ingredient_product_mappings", "meal_plan_entries", "ai_conversations", "ai_messages", "ai_suggestions", "notifications", "household_preferences",
  "receipt_imports", "receipt_import_lines", "documents", "document_links", "appliances", "appliance_maintenance", "utility_bills",
  "recurring_charges", "household_expenses", "household_events", "plants", "plant_care_events", "smart_home_devices", "device_command_log",
] as const;

export async function GET() {
  const ctx = await getHouseholdContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await getSupabaseServer();
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), household_id: ctx.household.id, note: "Files (photos, PDFs) are referenced by storage path and are not included." };
  for (const t of TABLES) {
    const col = t === "households" ? "id" : "household_id";
    const { data, error } = await supabase.from(t).select("*").eq(col, ctx.household.id).limit(10000);
    out[t] = error ? { error: "not available" } : data;
  }
  log.info("export.household", { household: ctx.household.id, user: ctx.user.id });
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="homeos-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
