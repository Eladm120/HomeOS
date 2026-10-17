import { PlannerView } from "@/components/planner/planner-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { PlannedPurchase } from "@/lib/types";
import { requireHousehold } from "@/server/context";
import { loadRooms } from "@/server/household-data";
import { signPaths } from "@/server/media";

export const metadata = { title: "תכנון רכישות" };

export default async function PlannerPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const [{ data: purchases }, rooms, { data: projects }] = await Promise.all([
    supabase.from("planned_purchases").select("*").eq("household_id", hid).order("priority").order("created_at", { ascending: false }),
    loadRooms(supabase, hid),
    supabase.from("home_projects").select("id, title").eq("household_id", hid).not("status", "in", "(completed,canceled)").order("created_at", { ascending: false }),
  ]);
  const list = (purchases ?? []) as PlannedPurchase[];
  const signedUrls = await signPaths(supabase, list.map((p) => p.image_path));
  return <PlannerView householdId={hid} purchases={list} rooms={rooms} projects={projects ?? []} signedUrls={signedUrls} />;
}
