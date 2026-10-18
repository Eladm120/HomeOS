import { SmartHomeView, type DeviceView } from "@/components/smart-home/smart-home-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireHousehold } from "@/server/context";
import { loadRooms } from "@/server/household-data";

export const metadata = { title: "בית חכם" };

export default async function SmartHomePage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const [{ data: conn }, { data: devices }, rooms] = await Promise.all([
    supabase.from("integration_connections").select("status, last_sync_at, last_error").eq("household_id", hid).eq("provider", "home_assistant").maybeSingle(),
    supabase.from("smart_home_devices").select("id, name, kind, online, state, attributes, capabilities, pinned, requires_confirmation, state_updated_at, room_id").eq("household_id", hid).order("name"),
    loadRooms(supabase, hid),
  ]);
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  return (
    <SmartHomeView
      householdId={hid}
      connected={!!conn && conn.status !== "disconnected"}
      devices={(devices ?? []).map((d) => ({ ...d, room: d.room_id ? (roomName.get(d.room_id) ?? null) : null })) as DeviceView[]}
      lastSync={conn?.last_sync_at ?? null}
      lastError={conn?.last_error ?? null}
      isOwner={ctx.role === "owner"}
    />
  );
}
