"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/types";
import { addDays, todayInZone, zonedToIso } from "@/lib/format";
import { decryptSecret } from "@/server/crypto";
import { BILL_SENDERS, googleConfigured, googleGet, googlePost, refreshAccess, type GoogleEvent } from "@/server/integrations/google";
import { dbFail, fail, ok, withHousehold } from "@/server/action-utils";
import { importBill } from "@/server/actions/admin";
import { log } from "@/server/log";
import type { SupabaseClient } from "@supabase/supabase-js";

async function accessToken(supabase: SupabaseClient, householdId: string, provider: "google_calendar" | "gmail"): Promise<string | null> {
  const { data: secret } = await supabase.rpc("integration_secret", { p_household: householdId, p_provider: provider });
  if (!secret) return null;
  const t = await refreshAccess(decryptSecret(secret as string));
  return t.access_token;
}

async function markError(supabase: SupabaseClient, householdId: string, provider: string, message: string) {
  await supabase.from("integration_connections").update({ status: "error", last_error: message.slice(0, 450) }).eq("household_id", householdId).eq("provider", provider);
}

/**
 * Two-way, duplicate-safe calendar sync with the connected Google account's
 * primary calendar: Google events in the next 90 days are imported (keyed by
 * their Google id, cancelled ones removed); HomeOS events without a Google id
 * are created in Google once and then keep that id.
 */
export async function syncGoogleCalendar(): Promise<ActionResult<{ imported: number; exported: number }>> {
  if (!googleConfigured()) return fail("חיבור ל-Google לא הוגדר בשרת");
  return withHousehold<{ imported: number; exported: number }>(async (ctx, supabase) => {
    const hid = ctx.household.id;
    let token: string | null;
    try {
      token = await accessToken(supabase, hid, "google_calendar");
    } catch (e) {
      await markError(supabase, hid, "google_calendar", "ההרשאה ל-Google פגה. חברו מחדש.");
      log.warn("gcal.token", { message: (e as Error).message });
      return fail("ההרשאה ל-Google פגה. חברו מחדש.");
    }
    if (!token) return fail("Google Calendar לא מחובר");
    const tz = ctx.household.timezone;
    const from = new Date(Date.now() - 86_400_000).toISOString();
    const to = `${addDays(todayInZone(new Date(), tz), 90)}T23:59:59Z`;
    try {
      const list = await googleGet<{ items: GoogleEvent[] }>(
        token,
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=250&showDeleted=true&timeMin=${encodeURIComponent(from)}&timeMax=${encodeURIComponent(to)}`,
      );
      let imported = 0;
      for (const ev of list.items ?? []) {
        if (ev.status === "cancelled") {
          await supabase.from("household_events").delete().eq("household_id", hid).eq("external_source", "google").eq("external_id", ev.id);
          continue;
        }
        const allDay = !!ev.start.date;
        const starts = allDay ? zonedToIso(`${ev.start.date}T00:00`, tz) : ev.start.dateTime!;
        const ends = ev.end ? (ev.end.date ? null : ev.end.dateTime ?? null) : null;
        const { error } = await supabase.from("household_events").upsert(
          {
            household_id: hid,
            title: (ev.summary ?? "(ללא כותרת)").slice(0, 160),
            description: ev.description?.slice(0, 3000) ?? null,
            location: ev.location?.slice(0, 200) ?? null,
            starts_at: starts,
            ends_at: ends && Date.parse(ends) >= Date.parse(starts) ? ends : null,
            all_day: allDay,
            category: "other",
            external_source: "google",
            external_id: ev.id,
          },
          { onConflict: "household_id,external_source,external_id" },
        );
        if (error) log.warn("gcal.upsert", { code: error.code });
        else imported++;
      }

      const { data: conn } = await supabase.from("integration_connections").select("config").eq("household_id", hid).eq("provider", "google_calendar").maybeSingle();
      let exported = 0;
      if ((conn?.config as { write?: boolean } | null)?.write) {
        const { data: local } = await supabase.from("household_events").select("id, title, description, location, starts_at, ends_at, all_day").eq("household_id", hid).is("external_id", null).gte("starts_at", from).limit(50);
        for (const e of local ?? []) {
          const body = e.all_day
            ? { summary: e.title, description: e.description ?? undefined, location: e.location ?? undefined, start: { date: e.starts_at.slice(0, 10) }, end: { date: addDays(e.starts_at.slice(0, 10), 1) } }
            : { summary: e.title, description: e.description ?? undefined, location: e.location ?? undefined, start: { dateTime: e.starts_at }, end: { dateTime: e.ends_at ?? new Date(Date.parse(e.starts_at) + 3600_000).toISOString() } };
          try {
            const created = await googlePost<{ id: string }>(token, "https://www.googleapis.com/calendar/v3/calendars/primary/events", body);
            await supabase.from("household_events").update({ external_source: "google", external_id: created.id }).eq("id", e.id);
            exported++;
          } catch (err) {
            log.warn("gcal.export", { message: (err as Error).message });
          }
        }
      }
      await supabase.from("integration_connections").update({ status: "connected", last_sync_at: new Date().toISOString(), last_error: null }).eq("household_id", hid).eq("provider", "google_calendar");
      revalidatePath("/calendar");
      revalidatePath("/settings/integrations");
      return ok({ imported, exported });
    } catch (e) {
      await markError(supabase, hid, "google_calendar", "הסנכרון עם Google נכשל");
      log.error("gcal.sync", { message: (e as Error).message });
      return fail("הסנכרון עם Google נכשל");
    }
  });
}

interface GmailPart {
  filename?: string;
  mimeType?: string;
  body?: { attachmentId?: string; size?: number };
  parts?: GmailPart[];
}

/**
 * Read-only Gmail scan for bill PDFs from known Israeli providers (last 60
 * days). Each message is processed once (integration_sync_log), the PDF is
 * stored in the vault and imported as an unverified bill for review.
 */
export async function scanGmailForBills(): Promise<ActionResult<{ imported: number; skipped: number }>> {
  if (!googleConfigured()) return fail("חיבור ל-Google לא הוגדר בשרת");
  return withHousehold<{ imported: number; skipped: number }>(async (ctx, supabase) => {
    const hid = ctx.household.id;
    let token: string | null;
    try {
      token = await accessToken(supabase, hid, "gmail");
    } catch {
      await markError(supabase, hid, "gmail", "ההרשאה ל-Gmail פגה. חברו מחדש.");
      return fail("ההרשאה ל-Gmail פגה. חברו מחדש.");
    }
    if (!token) return fail("Gmail לא מחובר");
    const q = `has:attachment filename:pdf newer_than:60d (${BILL_SENDERS.map((d) => `from:${d}`).join(" OR ")})`;
    let imported = 0;
    let skipped = 0;
    try {
      const list = await googleGet<{ messages?: { id: string }[] }>(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=${encodeURIComponent(q)}`);
      for (const m of list.messages ?? []) {
        const { data: seen } = await supabase.from("integration_sync_log").select("id").eq("household_id", hid).eq("provider", "gmail").eq("external_id", m.id).maybeSingle();
        if (seen) {
          skipped++;
          continue;
        }
        const msg = await googleGet<{ payload: GmailPart }>(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`);
        const pdfs: GmailPart[] = [];
        const walk = (p: GmailPart) => {
          if (p.filename?.toLowerCase().endsWith(".pdf") && p.body?.attachmentId && (p.body.size ?? 0) < 10 * 1024 * 1024) pdfs.push(p);
          p.parts?.forEach(walk);
        };
        walk(msg.payload);
        let outcome: "imported" | "skipped" | "failed" = "skipped";
        let detail = "no pdf";
        for (const part of pdfs.slice(0, 1)) {
          const att = await googleGet<{ data: string }>(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}/attachments/${part.body!.attachmentId}`);
          const bytes = Buffer.from(att.data, "base64url");
          const path = `${hid}/bills/${crypto.randomUUID()}.pdf`;
          const { error: up } = await supabase.storage.from("household-media").upload(path, bytes, { contentType: "application/pdf", upsert: false });
          if (up) {
            outcome = "failed";
            detail = "upload failed";
            break;
          }
          const res = await importBill({ file_path: path, mime_type: "application/pdf", file_name: (part.filename ?? "bill.pdf").slice(0, 200), size_bytes: bytes.length });
          outcome = res.ok ? "imported" : "failed";
          detail = res.ok ? "ok" : res.error;
          if (res.ok) imported++;
        }
        await supabase.from("integration_sync_log").insert({ household_id: hid, provider: "gmail", external_id: m.id, entity_type: "utility_bill", outcome, detail: detail.slice(0, 450) });
      }
      await supabase.from("integration_connections").update({ status: "connected", last_sync_at: new Date().toISOString(), last_error: null }).eq("household_id", hid).eq("provider", "gmail");
      revalidatePath("/bills");
      return ok({ imported, skipped });
    } catch (e) {
      log.error("gmail.scan", { message: (e as Error).message });
      return dbFail("gmail.scan", e as Error);
    }
  });
}
