import "server-only";

/**
 * Google OAuth + Calendar/Gmail REST calls (server-only). Requires
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET from a Google Cloud OAuth client with
 * the redirect URI <site>/api/integrations/google/callback.
 */
export const GOOGLE_SCOPES = {
  google_calendar: ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/userinfo.email"],
  gmail: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/userinfo.email"],
} as const;

export type GoogleProvider = keyof typeof GOOGLE_SCOPES;

export function googleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export function googleAuthUrl(provider: GoogleProvider, redirectUri: string, state: string): string {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", GOOGLE_SCOPES[provider].join(" "));
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", state);
  return u.toString();
}

async function tokenRequest(params: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...params }),
  });
  if (!res.ok) throw new Error(`google token ${res.status}`);
  return res.json();
}

export const exchangeCode = (code: string, redirectUri: string) => tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
export const refreshAccess = (refreshToken: string) => tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });

export async function googleGet<T>(accessToken: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`google ${res.status}`);
  return res.json();
}

export async function googlePost<T>(accessToken: string, url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`google ${res.status}`);
  return res.json();
}

export interface GoogleEvent {
  id: string;
  status: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

/** Known Israeli bill senders for the Gmail scan (sender domains). */
export const BILL_SENDERS = ["iec.co.il", "mei-avivim.co.il", "hagihon.co.il", "mekorot.co.il", "tel-aviv.gov.il", "jerusalem.muni.il", "bezeq.co.il", "partner.co.il", "cellcom.co.il", "hot.net.il", "amisragas.co.il", "supergas.co.il", "pazgas.co.il"];
