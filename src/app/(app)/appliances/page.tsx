import { AppliancesView } from "@/components/appliances/appliances-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Appliance } from "@/lib/types";
import { requireHousehold } from "@/server/context";
import { loadRooms } from "@/server/household-data";
import { signPaths } from "@/server/media";

export const metadata = { title: "מכשירי חשמל" };

export default async function AppliancesPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const [{ data }, rooms] = await Promise.all([supabase.from("appliances").select("*").eq("household_id", ctx.household.id).order("name"), loadRooms(supabase, ctx.household.id)]);
  const list = (data ?? []) as Appliance[];
  return <AppliancesView householdId={ctx.household.id} appliances={list} rooms={rooms} signedUrls={await signPaths(supabase, list.map((a) => a.image_path))} />;
}
