import { PageHeader } from "@/components/layout/page-header";
import { SettingsView } from "@/components/household/settings-view";
import { requireHousehold } from "@/server/context";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "הגדרות משק הבית" };

export default async function HouseholdSettingsPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;

  const [rooms, categories, locations, invitations] = await Promise.all([
    supabase.from("rooms").select("id, name").eq("household_id", hid).order("sort_order"),
    supabase.from("product_categories").select("id, name").eq("household_id", hid).order("sort_order"),
    supabase.from("inventory_locations").select("id, name").eq("household_id", hid).order("sort_order"),
    ctx.role === "owner"
      ? supabase
          .from("household_invitations")
          .select("id, email, expires_at, created_at")
          .eq("household_id", hid)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <>
      <PageHeader title="הגדרות" back={{ href: "/household", label: "משק הבית" }} />
      <SettingsView
        householdName={ctx.household.name}
        isOwner={ctx.role === "owner"}
        currentUserId={ctx.user.id}
        email={ctx.user.email ?? ""}
        displayName={ctx.profile?.display_name ?? ""}
        members={ctx.members.map((m) => ({ userId: m.user_id, role: m.role, name: m.profile?.display_name ?? "" }))}
        rooms={rooms.data ?? []}
        categories={categories.data ?? []}
        locations={locations.data ?? []}
        invitations={(invitations.data ?? []) as { id: string; email: string | null; expires_at: string }[]}
      />
    </>
  );
}
