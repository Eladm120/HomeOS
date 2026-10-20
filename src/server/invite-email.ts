import "server-only";

import { log } from "@/server/log";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** True when an email provider is configured (Resend). Without it, the inviter sends the link from their own mail app. */
export function inviteEmailEnabled(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.INVITE_FROM_EMAIL);
}

/**
 * Sends the partner invitation by email through Resend. The only email the app
 * itself sends. Returns false (never throws) when it isn't configured or fails,
 * so the caller can fall back to "send from your own mail app".
 */
export async function sendInviteEmail(input: { to: string; inviterName: string; householdName: string; url: string }): Promise<boolean> {
  if (!inviteEmailEnabled()) return false;
  const inviter = escapeHtml(input.inviterName || "מישהו מהבית");
  const home = escapeHtml(input.householdName);
  const html = `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#f7f3ec;font-family:Arial,sans-serif;color:#2c3527">
<div style="max-width:480px;margin:0 auto;padding:32px 24px;text-align:right">
<p style="font-size:28px;font-weight:800;margin:0 0 4px"><span style="color:#2a3a25">Home</span><span style="color:#6b8a55">OS</span></p>
<h1 style="font-size:22px;margin:24px 0 8px">${inviter} מזמין/ה אותך לבית</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 24px">הצטרפו למשק הבית <b>${home}</b> — רשימת קניות משותפת, משימות, ארוחות וכל מה שקורה בבית, במקום אחד.</p>
<a href="${escapeHtml(input.url)}" style="display:inline-block;background:#56744a;color:#fff;text-decoration:none;font-weight:700;font-size:17px;padding:14px 28px;border-radius:999px">הצטרפות לבית</a>
<p style="font-size:13px;color:#7d7868;margin:24px 0 0">הקישור תקף ל-7 ימים ולשימוש אחד.</p>
</div></body></html>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.INVITE_FROM_EMAIL, to: [input.to], subject: `הזמנה להצטרף ל${input.householdName} ב-HomeOS`, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) log.error("invite.email", { status: res.status });
    return res.ok;
  } catch (e) {
    log.error("invite.email", { message: (e as Error).message });
    return false;
  }
}
