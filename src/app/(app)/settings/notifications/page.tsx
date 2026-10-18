import { NotificationSettings } from "@/components/intelligence/notification-settings";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireHousehold } from "@/server/context";

export const metadata = { title: "הגדרות התראות" };

export default async function NotificationSettingsPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("household_preferences").select("key, value").eq("household_id", ctx.household.id).eq("user_id", ctx.user.id).like("key", "notify.%");
  return <NotificationSettings prefs={Object.fromEntries((data ?? []).map((p) => [p.key, p.value]))} />;
}
