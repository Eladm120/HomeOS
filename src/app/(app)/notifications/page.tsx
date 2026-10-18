import { NotificationsView, type NotificationView } from "@/components/intelligence/notifications-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireHousehold } from "@/server/context";
import { loadAlerts } from "@/server/alerts-data";

export const metadata = { title: "התראות" };

export default async function NotificationsPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const [alerts, { data }] = await Promise.all([
    loadAlerts(ctx),
    supabase
      .from("notifications")
      .select("id, category, title, body, href, important, read_at, created_at")
      .eq("household_id", ctx.household.id)
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  return <NotificationsView alerts={alerts} notifications={(data ?? []) as NotificationView[]} />;
}
