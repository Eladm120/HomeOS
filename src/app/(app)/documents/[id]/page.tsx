import { notFound } from "next/navigation";
import { DocumentDetail } from "@/components/documents/document-detail";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { HouseholdDocument } from "@/lib/types";
import { aiConfigured } from "@/server/ai/client";
import { requireHousehold } from "@/server/context";

const LINK_PATH: Record<string, string> = { appliance: "/appliances", project: "/projects", utility_bill: "/bills", planned_purchase: "/planner", event: "/calendar", plant: "/plants" };
const LINK_TABLE: Record<string, { table: string; label: string }> = {
  appliance: { table: "appliances", label: "name" },
  project: { table: "home_projects", label: "title" },
  utility_bill: { table: "utility_bills", label: "provider_name" },
  planned_purchase: { table: "planned_purchases", label: "name" },
  event: { table: "household_events", label: "title" },
  plant: { table: "plants", label: "name" },
};

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const { data } = await supabase.from("documents").select("*").eq("id", id).eq("household_id", hid).maybeSingle();
  if (!data) notFound();
  const doc = data as HouseholdDocument;

  // Version chain (walk back through previous versions, and forward to newer ones)
  const chain: Pick<HouseholdDocument, "id" | "version" | "created_at">[] = [{ id: doc.id, version: doc.version, created_at: doc.created_at }];
  let prev = doc.previous_version_id;
  for (let i = 0; prev && i < 20; i++) {
    const { data: p } = await supabase.from("documents").select("id, version, created_at, previous_version_id").eq("id", prev).maybeSingle();
    if (!p) break;
    chain.push(p);
    prev = p.previous_version_id;
  }
  const { data: newer } = await supabase.from("documents").select("id, version, created_at").eq("previous_version_id", doc.id);
  chain.unshift(...(newer ?? []));

  const { data: rawLinks } = await supabase.from("document_links").select("entity_type, entity_id").eq("document_id", id);
  const links: { label: string; href: string }[] = [];
  for (const l of rawLinks ?? []) {
    const t = LINK_TABLE[l.entity_type as string];
    if (!t) continue;
    const { data: row } = await supabase.from(t.table).select(`id, ${t.label}`).eq("id", l.entity_id).maybeSingle();
    if (row) links.push({ label: String((row as unknown as Record<string, unknown>)[t.label] ?? "רשומה"), href: `${LINK_PATH[l.entity_type as string]}/${l.entity_id}` });
  }

  return (
    <DocumentDetail
      householdId={hid}
      doc={doc}
      versions={chain.sort((a, b) => b.version - a.version)}
      links={links}
      aiEnabled={aiConfigured()}
      canDelete={!doc.sensitive || doc.created_by === ctx.user.id}
    />
  );
}
