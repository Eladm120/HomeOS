import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceProvider } from "@/lib/types";

export async function loadProviders(supabase: SupabaseClient, householdId: string): Promise<ServiceProvider[]> {
  const { data } = await supabase.from("service_providers").select("*").eq("household_id", householdId).order("name");
  return (data ?? []) as ServiceProvider[];
}

/** Appliances exist from Phase 4; until that migration runs, return an empty list. */
export async function loadApplianceOptions(supabase: SupabaseClient, householdId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from("appliances").select("id, name").eq("household_id", householdId).order("name");
  if (error) return [];
  return (data ?? []) as { id: string; name: string }[];
}
