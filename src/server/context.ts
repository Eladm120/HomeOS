import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Household, HouseholdRole, MemberWithProfile, Profile } from "@/lib/types";

export const ACTIVE_HOUSEHOLD_COOKIE = "homeos_household";

export interface HouseholdContext {
  user: User;
  profile: Profile | null;
  household: Household;
  role: HouseholdRole;
  members: MemberWithProfile[];
}

export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

/**
 * Resolves the signed-in user's active household. Authorization is still
 * enforced by RLS on every query — this only picks *which* household to show.
 */
export const getHouseholdContext = cache(async (): Promise<HouseholdContext | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await getSupabaseServer();

  const { data: memberships } = await supabase
    .from("household_memberships")
    .select("household_id, role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (!memberships?.length) return null;

  const preferred = (await cookies()).get(ACTIVE_HOUSEHOLD_COOKIE)?.value;
  const active = memberships.find((m) => m.household_id === preferred) ?? memberships[0];

  const [{ data: household }, { data: members }, { data: profile }] = await Promise.all([
    supabase.from("households").select("*").eq("id", active.household_id).single(),
    supabase
      .from("household_memberships")
      .select("id, household_id, user_id, role, created_at")
      .eq("household_id", active.household_id)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  ]);
  if (!household) return null;

  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_path")
    .in("id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return {
    user,
    profile: (profile as Profile) ?? null,
    household: household as Household,
    role: active.role as HouseholdRole,
    members: (members ?? []).map((m) => ({ ...(m as MemberWithProfile), profile: byId.get(m.user_id) ?? null })),
  };
});

/** For pages inside the app shell: guarantees a user AND a household. */
export async function requireHousehold(): Promise<HouseholdContext> {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
}

export function memberName(members: MemberWithProfile[], userId: string | null | undefined): string {
  if (!userId) return "";
  return members.find((m) => m.user_id === userId)?.profile?.display_name ?? "";
}
