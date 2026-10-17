import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/household/onboarding-flow";
import { getHouseholdContext, getUser } from "@/server/context";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "ברוכים הבאים" };

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/sign-in?next=/onboarding");
  const ctx = await getHouseholdContext();
  const supabase = await getSupabaseServer();
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();

  return (
    <div className="relative min-h-dvh overflow-hidden px-5 py-10">
      <div className="aurora" aria-hidden />
      <div className="relative mx-auto w-full max-w-md">
        <OnboardingFlow
          hasHousehold={!!ctx}
          isOwner={ctx?.role === "owner"}
          householdName={ctx?.household.name ?? ""}
          initialDisplayName={profile?.display_name ?? ""}
        />
      </div>
    </div>
  );
}
