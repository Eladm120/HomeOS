import { notFound } from "next/navigation";
import { ApplianceDetail } from "@/components/appliances/appliance-detail";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Appliance, ApplianceMaintenance, Attachment, HomeProject, HouseholdDocument } from "@/lib/types";
import { aiConfigured } from "@/server/ai/client";
import { requireHousehold } from "@/server/context";
import { loadRooms } from "@/server/household-data";
import { loadProviders } from "@/server/projects-data";
import { signPaths } from "@/server/media";

export default async function AppliancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const { data } = await supabase.from("appliances").select("*").eq("id", id).eq("household_id", hid).maybeSingle();
  if (!data) notFound();
  const a = data as Appliance;
  const docIds = [a.invoice_document_id, a.manual_document_id].filter(Boolean) as string[];
  const [rooms, { data: maintenance }, { data: repairs }, { data: docs }, { data: attachments }, providers] = await Promise.all([
    loadRooms(supabase, hid),
    supabase.from("appliance_maintenance").select("*").eq("appliance_id", id).eq("household_id", hid).order("performed_on", { ascending: false }),
    supabase.from("home_projects").select("id, title, status, created_at").eq("appliance_id", id).eq("household_id", hid).order("created_at", { ascending: false }),
    docIds.length ? supabase.from("documents").select("id, title, category").in("id", docIds).eq("household_id", hid) : Promise.resolve({ data: [] }),
    supabase.from("attachments").select("*").eq("household_id", hid).eq("entity_type", "appliance").eq("entity_id", id),
    loadProviders(supabase, hid),
  ]);
  const files = (attachments ?? []) as Attachment[];
  return (
    <ApplianceDetail
      householdId={hid}
      appliance={a}
      rooms={rooms}
      maintenance={(maintenance ?? []) as ApplianceMaintenance[]}
      repairs={(repairs ?? []) as Pick<HomeProject, "id" | "title" | "status" | "created_at">[]}
      documents={(docs ?? []) as Pick<HouseholdDocument, "id" | "title" | "category">[]}
      attachments={files}
      providers={providers}
      signedUrls={await signPaths(supabase, [a.image_path, ...files.map((f) => f.path)])}
      aiEnabled={aiConfigured()}
    />
  );
}
