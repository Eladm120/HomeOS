import { IntegrationsView, type ConnectionView } from "@/components/settings/integrations-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import { aiConfigured } from "@/server/ai/client";
import { encryptionConfigured } from "@/server/crypto";
import { requireHousehold } from "@/server/context";
import { googleConfigured } from "@/server/integrations/google";

export const metadata = { title: "חיבורים" };

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const flash = await searchParams;
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("integration_connections").select("provider, status, config, last_sync_at, last_error").eq("household_id", ctx.household.id);
  return (
    <IntegrationsView
      env={{ ai: aiConfigured(), encryption: encryptionConfigured(), google: googleConfigured(), push: !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY }}
      connections={(data ?? []) as ConnectionView[]}
      isOwner={ctx.role === "owner"}
      flash={flash}
    />
  );
}
