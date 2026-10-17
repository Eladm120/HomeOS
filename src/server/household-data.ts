import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Room } from "@/lib/types";
import type { HouseholdContext } from "@/server/context";

export interface MemberOption {
  id: string;
  name: string;
}

export function memberOptions(ctx: HouseholdContext): MemberOption[] {
  return ctx.members.map((m) => ({ id: m.user_id, name: m.profile?.display_name || "חבר/ת בית" }));
}

export async function loadRooms(supabase: SupabaseClient, householdId: string): Promise<Room[]> {
  const { data } = await supabase.from("rooms").select("*").eq("household_id", householdId).order("sort_order");
  return (data ?? []) as Room[];
}
