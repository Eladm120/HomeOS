import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getHouseholdContext } from "@/server/context";
import { encryptionConfigured } from "@/server/crypto";
import { googleAuthUrl, googleConfigured, type GoogleProvider } from "@/server/integrations/google";

/** Owner-only: start Google OAuth for Calendar or Gmail (state stored in an httpOnly cookie). */
export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider") as GoogleProvider | null;
  const back = new URL("/settings/integrations", req.nextUrl.origin);
  if (provider !== "google_calendar" && provider !== "gmail") return NextResponse.redirect(back);
  const ctx = await getHouseholdContext();
  if (!ctx || ctx.role !== "owner" || !googleConfigured() || !encryptionConfigured()) {
    back.searchParams.set("error", "google_unavailable");
    return NextResponse.redirect(back);
  }
  const state = `${provider}.${randomBytes(24).toString("base64url")}`;
  (await cookies()).set("homeos_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/integrations/google", maxAge: 600 });
  return NextResponse.redirect(googleAuthUrl(provider, new URL("/api/integrations/google/callback", req.nextUrl.origin).toString(), state));
}
