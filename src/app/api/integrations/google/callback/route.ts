import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getHouseholdContext } from "@/server/context";
import { encryptSecret } from "@/server/crypto";
import { exchangeCode, googleGet, type GoogleProvider } from "@/server/integrations/google";
import { log } from "@/server/log";

export async function GET(req: NextRequest) {
  const back = new URL("/settings/integrations", req.nextUrl.origin);
  const jar = await cookies();
  const expected = jar.get("homeos_oauth_state")?.value;
  jar.delete({ name: "homeos_oauth_state", path: "/api/integrations/google" });
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  if (!expected || !state || state !== expected || !code) {
    back.searchParams.set("error", "google_state");
    return NextResponse.redirect(back);
  }
  const provider = state.split(".")[0] as GoogleProvider;
  const ctx = await getHouseholdContext();
  if (!ctx || ctx.role !== "owner") {
    back.searchParams.set("error", "google_owner");
    return NextResponse.redirect(back);
  }
  try {
    const tokens = await exchangeCode(code, new URL("/api/integrations/google/callback", req.nextUrl.origin).toString());
    if (!tokens.refresh_token) throw new Error("no refresh token");
    const me = await googleGet<{ email?: string }>(tokens.access_token, "https://www.googleapis.com/oauth2/v2/userinfo");
    const supabase = await getSupabaseServer();
    const { error } = await supabase.from("integration_connections").upsert(
      {
        household_id: ctx.household.id,
        provider,
        status: "connected",
        config: { account: me.email ?? null, scopes: tokens.scope ?? null, write: provider === "google_calendar" },
        secret_ciphertext: encryptSecret(tokens.refresh_token),
        last_error: null,
        connected_by: ctx.user.id,
      },
      { onConflict: "household_id,provider" },
    );
    if (error) throw error;
    back.searchParams.set("connected", provider);
  } catch (e) {
    log.error("google.callback_failed", { message: (e as Error).message });
    back.searchParams.set("error", "google_exchange");
  }
  return NextResponse.redirect(back);
}
