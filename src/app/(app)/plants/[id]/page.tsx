import { notFound } from "next/navigation";
import { PlantDetail } from "@/components/plants/plants-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Plant, PlantCareEvent } from "@/lib/types";
import { aiConfigured } from "@/server/ai/client";
import { requireHousehold } from "@/server/context";
import { loadRooms, memberOptions } from "@/server/household-data";
import { signPaths } from "@/server/media";

export default async function PlantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("plants").select("*").eq("id", id).eq("household_id", ctx.household.id).maybeSingle();
  if (!data) notFound();
  const [{ data: history }, rooms] = await Promise.all([
    supabase.from("plant_care_events").select("*").eq("plant_id", id).eq("household_id", ctx.household.id).order("performed_on", { ascending: false }).limit(40),
    loadRooms(supabase, ctx.household.id),
  ]);
  await signPaths(supabase, [data.image_path]);
  return <PlantDetail householdId={ctx.household.id} plant={data as Plant} history={(history ?? []) as PlantCareEvent[]} rooms={rooms} aiEnabled={aiConfigured()} members={memberOptions(ctx)} />;
}
