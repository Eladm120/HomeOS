import { notFound } from "next/navigation";
import { ChoreDetail } from "@/components/chores/chore-detail";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Chore, ChoreCompletion } from "@/lib/types";
import { requireHousehold } from "@/server/context";
import { loadRooms, memberOptions } from "@/server/household-data";

export default async function ChorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const { data: chore } = await supabase.from("chores").select("*").eq("id", id).eq("household_id", hid).maybeSingle();
  if (!chore) notFound();
  const [{ data: history }, rooms] = await Promise.all([
    supabase.from("chore_completions").select("*").eq("chore_id", id).eq("household_id", hid).order("completed_at", { ascending: false }).limit(50),
    loadRooms(supabase, hid),
  ]);
  return <ChoreDetail chore={chore as Chore} history={(history ?? []) as ChoreCompletion[]} rooms={rooms} members={memberOptions(ctx)} />;
}
