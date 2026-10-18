import { PlantsView } from "@/components/plants/plants-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Plant } from "@/lib/types";
import { aiConfigured } from "@/server/ai/client";
import { requireHousehold } from "@/server/context";
import { loadRooms } from "@/server/household-data";
import { signPaths } from "@/server/media";

export const metadata = { title: "צמחים" };

export default async function PlantsPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const [{ data }, rooms] = await Promise.all([supabase.from("plants").select("*").eq("household_id", ctx.household.id).order("name"), loadRooms(supabase, ctx.household.id)]);
  const plants = (data ?? []) as Plant[];
  return <PlantsView householdId={ctx.household.id} plants={plants} rooms={rooms} signedUrls={await signPaths(supabase, plants.map((p) => p.image_path))} aiEnabled={aiConfigured()} />;
}
