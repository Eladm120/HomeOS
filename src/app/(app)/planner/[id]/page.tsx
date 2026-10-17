import { notFound } from "next/navigation";
import { PurchaseDetail } from "@/components/planner/purchase-detail";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Attachment, PlannedPurchase, PurchaseAlternative } from "@/lib/types";
import { memberName, requireHousehold } from "@/server/context";
import { loadRooms } from "@/server/household-data";
import { signPaths } from "@/server/media";

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const { data: purchase } = await supabase.from("planned_purchases").select("*").eq("id", id).eq("household_id", hid).maybeSingle();
  if (!purchase) notFound();
  const [{ data: alternatives }, { data: attachments }, rooms, { data: projects }] = await Promise.all([
    supabase.from("purchase_alternatives").select("*").eq("purchase_id", id).eq("household_id", hid).order("created_at"),
    supabase.from("attachments").select("*").eq("household_id", hid).eq("entity_type", "planned_purchase").eq("entity_id", id).order("created_at"),
    loadRooms(supabase, hid),
    supabase.from("home_projects").select("id, title").eq("household_id", hid).order("created_at", { ascending: false }),
  ]);
  const alts = (alternatives ?? []) as PurchaseAlternative[];
  const files = (attachments ?? []) as Attachment[];
  const p = purchase as PlannedPurchase;
  const signedUrls = await signPaths(supabase, [p.image_path, ...alts.map((a) => a.image_path), ...files.filter((f) => f.mime_type !== "application/pdf").map((f) => f.path)]);
  return (
    <PurchaseDetail
      householdId={hid}
      purchase={p}
      alternatives={alts}
      attachments={files}
      rooms={rooms}
      projects={projects ?? []}
      addedBy={memberName(ctx.members, p.created_by) || null}
      signedUrls={signedUrls}
    />
  );
}
