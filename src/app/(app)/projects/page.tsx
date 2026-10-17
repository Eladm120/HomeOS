import { ProjectsView } from "@/components/projects/projects-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { HomeProject } from "@/lib/types";
import { requireHousehold } from "@/server/context";
import { loadRooms, memberOptions } from "@/server/household-data";
import { loadApplianceOptions, loadProviders } from "@/server/projects-data";

export const metadata = { title: "פרויקטים ותיקונים" };

export default async function ProjectsPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const [{ data: projects }, { data: tasks }, rooms, providers, appliances] = await Promise.all([
    supabase.from("home_projects").select("*").eq("household_id", hid).order("updated_at", { ascending: false }),
    supabase.from("project_tasks").select("project_id, done").eq("household_id", hid),
    loadRooms(supabase, hid),
    loadProviders(supabase, hid),
    loadApplianceOptions(supabase, hid),
  ]);
  const taskStats: Record<string, { done: number; total: number }> = {};
  for (const t of tasks ?? []) {
    const s = (taskStats[t.project_id as string] ??= { done: 0, total: 0 });
    s.total++;
    if (t.done) s.done++;
  }
  return (
    <ProjectsView
      householdId={hid}
      projects={(projects ?? []) as HomeProject[]}
      taskStats={taskStats}
      rooms={rooms}
      members={memberOptions(ctx)}
      providers={providers}
      appliances={appliances}
    />
  );
}
