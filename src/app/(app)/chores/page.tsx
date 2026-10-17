import { ChoresView } from "@/components/chores/chores-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Chore } from "@/lib/types";
import { requireHousehold } from "@/server/context";
import { loadRooms, memberOptions } from "@/server/household-data";

export const metadata = { title: "משימות בית" };

export default async function ChoresPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const [{ data: chores }, rooms] = await Promise.all([
    supabase.from("chores").select("*").eq("household_id", hid).neq("status", "archived").order("next_due_on"),
    loadRooms(supabase, hid),
  ]);
  return <ChoresView householdId={hid} chores={(chores ?? []) as Chore[]} rooms={rooms} members={memberOptions(ctx)} currentUserId={ctx.user.id} />;
}
