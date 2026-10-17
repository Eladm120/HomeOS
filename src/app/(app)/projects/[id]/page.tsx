import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/projects/project-detail";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Attachment, HomeProject, PlannedPurchase, ProjectActivity, ProjectTask } from "@/lib/types";
import { requireHousehold } from "@/server/context";
import { loadRooms, memberOptions } from "@/server/household-data";
import { loadApplianceOptions, loadProviders } from "@/server/projects-data";
import { signPaths } from "@/server/media";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const { data: project } = await supabase.from("home_projects").select("*").eq("id", id).eq("household_id", hid).maybeSingle();
  if (!project) notFound();
  const [{ data: tasks }, { data: activities }, { data: purchases }, { data: attachments }, rooms, providers, appliances] = await Promise.all([
    supabase.from("project_tasks").select("*").eq("project_id", id).eq("household_id", hid).order("sort_order"),
    supabase.from("project_activities").select("*").eq("project_id", id).eq("household_id", hid).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("planned_purchases").select("*").eq("project_id", id).eq("household_id", hid).order("created_at"),
    supabase.from("attachments").select("*").eq("household_id", hid).eq("entity_type", "project").eq("entity_id", id).order("created_at"),
    loadRooms(supabase, hid),
    loadProviders(supabase, hid),
    loadApplianceOptions(supabase, hid),
  ]);
  const files = (attachments ?? []) as Attachment[];
  const linked = (purchases ?? []) as PlannedPurchase[];
  const signedUrls = await signPaths(supabase, [...files.filter((f) => f.mime_type !== "application/pdf").map((f) => f.path), ...linked.map((x) => x.image_path)]);
  return (
    <ProjectDetail
      householdId={hid}
      project={project as HomeProject}
      tasks={(tasks ?? []) as ProjectTask[]}
      activities={(activities ?? []) as ProjectActivity[]}
      purchases={linked}
      attachments={files}
      rooms={rooms}
      members={memberOptions(ctx)}
      providers={providers}
      appliances={appliances}
      signedUrls={signedUrls}
    />
  );
}
