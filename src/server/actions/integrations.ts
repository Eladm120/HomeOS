"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/types";
import { capabilities, commandReflected, deviceKind, needsConfirmation, toServiceCall, type DeviceCapabilities, type DeviceCommand, type DeviceKind } from "@/lib/home-assistant";
import { decryptSecret, encryptSecret, encryptionConfigured } from "@/server/crypto";
import { HomeAssistantError, haCallService, haPing, haServices, haState, haStates } from "@/server/integrations/home-assistant";
import { dbFail, fail, ok, withHousehold } from "@/server/action-utils";
import type { HouseholdContext } from "@/server/context";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/server/log";

const uuid = z.uuid();

function ownerOnly(ctx: HouseholdContext) {
  return ctx.role === "owner" ? null : fail("רק מנהל/ת הבית יכול/ה לחבר או לנתק שירותים");
}

async function haCredentials(supabase: SupabaseClient, householdId: string): Promise<{ url: string; token: string; connectionId: string } | null> {
  const [{ data: conn }, { data: secret }] = await Promise.all([
    supabase.from("integration_connections").select("id, config, status").eq("household_id", householdId).eq("provider", "home_assistant").maybeSingle(),
    supabase.rpc("integration_secret", { p_household: householdId, p_provider: "home_assistant" }),
  ]);
  if (!conn || !secret || conn.status === "disconnected") return null;
  return { url: (conn.config as { base_url: string }).base_url, token: decryptSecret(secret as string), connectionId: conn.id as string };
}

// ---- Home Assistant connection -----------------------------------------------------

export async function connectHomeAssistant(input: { base_url: string; token: string }): Promise<ActionResult<{ devices: number }>> {
  const p = z.object({ base_url: z.string().trim().url().max(300), token: z.string().trim().min(20).max(1000) }).safeParse(input);
  if (!p.success) return fail("כתובת או טוקן לא תקינים");
  if (!encryptionConfigured()) return fail("חסר מפתח הצפנה בשרת (INTEGRATION_ENCRYPTION_KEY). בלי זה לא נשמור טוקנים.");
  return withHousehold<{ devices: number }>(async (ctx, supabase) => {
    const denied = ownerOnly(ctx);
    if (denied) return denied;
    const base = p.data.base_url.replace(/\/+$/, "");
    try {
      await haPing(base, p.data.token);
    } catch (e) {
      return fail(e instanceof HomeAssistantError ? e.message : "החיבור נכשל");
    }
    const { error } = await supabase.from("integration_connections").upsert(
      { household_id: ctx.household.id, provider: "home_assistant", status: "connected", config: { base_url: base }, secret_ciphertext: encryptSecret(p.data.token), last_error: null, connected_by: ctx.user.id },
      { onConflict: "household_id,provider" },
    );
    if (error) return dbFail("ha.connect", error);
    const sync = await syncSmartHome();
    revalidatePath("/settings/integrations");
    return ok({ devices: sync.ok ? sync.data.devices : 0 });
  });
}

export async function disconnectIntegration(provider: "home_assistant" | "google_calendar" | "gmail"): Promise<ActionResult<null>> {
  if (!["home_assistant", "google_calendar", "gmail"].includes(provider)) return fail("שירות לא מוכר");
  return withHousehold(async (ctx, supabase) => {
    const denied = ownerOnly(ctx);
    if (denied) return denied;
    // Deleting the connection removes the stored token (and, for HA, the device cache).
    const { error } = await supabase.from("integration_connections").delete().eq("household_id", ctx.household.id).eq("provider", provider);
    if (error) return dbFail("integrations.disconnect", error);
    revalidatePath("/settings/integrations");
    revalidatePath("/smart-home");
    return ok(null);
  });
}

/** Pull entity states from Home Assistant into the device cache. */
export async function syncSmartHome(): Promise<ActionResult<{ devices: number }>> {
  return withHousehold<{ devices: number }>(async (ctx, supabase) => {
    let creds;
    try {
      creds = await haCredentials(supabase, ctx.household.id);
    } catch {
      return fail("לא ניתן לפענח את פרטי החיבור. חברו את Home Assistant מחדש.");
    }
    if (!creds) return fail("Home Assistant לא מחובר");
    try {
      const [states, services] = await Promise.all([haStates(creds.url, creds.token), haServices(creds.url, creds.token).catch(() => new Set<string>())]);
      const { data: existing } = await supabase.from("smart_home_devices").select("entity_id, pinned").eq("household_id", ctx.household.id);
      const known = new Map((existing ?? []).map((d) => [d.entity_id as string, d.pinned as boolean]));
      const rows = states
        .map((s) => ({ s, kind: deviceKind(s) }))
        .filter((x): x is { s: typeof x.s; kind: DeviceKind } => !!x.kind && /^[a-z_]+\.[a-z0-9_]+$/.test(x.s.entity_id))
        .slice(0, 300)
        .map(({ s, kind }) => ({
          household_id: ctx.household.id,
          connection_id: creds!.connectionId,
          entity_id: s.entity_id,
          name: String(s.attributes.friendly_name ?? s.entity_id).slice(0, 120),
          kind,
          online: s.state !== "unavailable",
          state: String(s.state).slice(0, 100),
          attributes: Object.fromEntries(
            ["temperature", "current_temperature", "hvac_modes", "fan_modes", "fan_mode", "min_temp", "max_temp", "unit_of_measurement", "device_class", "brightness"].filter((k) => k in s.attributes).map((k) => [k, s.attributes[k]]),
          ),
          capabilities: capabilities(s, services),
          // climate and boilers are shown by default; everything else the member chooses
          pinned: known.get(s.entity_id) ?? (kind === "climate" || kind === "water_heater"),
          requires_confirmation: kind === "water_heater",
          state_updated_at: s.last_updated ?? new Date().toISOString(),
        }));
      if (rows.length) {
        const { error } = await supabase.from("smart_home_devices").upsert(rows, { onConflict: "household_id,entity_id" });
        if (error) return dbFail("ha.sync", error);
      }
      await supabase.from("integration_connections").update({ status: "connected", last_sync_at: new Date().toISOString(), last_error: null }).eq("id", creds.connectionId);
      revalidatePath("/smart-home");
      return ok({ devices: rows.length });
    } catch (e) {
      const message = e instanceof HomeAssistantError ? e.message : "הסנכרון נכשל";
      await supabase.from("integration_connections").update({ status: "error", last_error: message }).eq("id", creds.connectionId);
      return fail(message);
    }
  });
}

export async function updateDevice(id: string, patch: { pinned?: boolean; room_id?: string | null; requires_confirmation?: boolean }): Promise<ActionResult<null>> {
  const p = z.object({ pinned: z.boolean().optional(), room_id: z.uuid().nullable().optional(), requires_confirmation: z.boolean().optional() }).safeParse(patch);
  if (!uuid.safeParse(id).success || !p.success) return fail("קלט לא תקין");
  return withHousehold(async (ctx, supabase) => {
    const { error } = await supabase.from("smart_home_devices").update(p.data).eq("id", id).eq("household_id", ctx.household.id);
    if (error) return dbFail("ha.device", error);
    revalidatePath("/smart-home");
    return ok(null);
  });
}

const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("power"), on: z.boolean() }),
  z.object({ type: z.literal("set_temperature"), value: z.number().min(5).max(40) }),
  z.object({ type: z.literal("set_hvac_mode"), value: z.string().max(40) }),
  z.object({ type: z.literal("set_fan_mode"), value: z.string().max(40) }),
  z.object({ type: z.literal("on_with_timer"), minutes: z.number().int().min(1).max(150) }),
]);

export interface CommandResult {
  status: "succeeded" | "unconfirmed" | "failed" | "needs_confirmation";
  message: string;
  state?: string;
}

/**
 * Send a command and report what really happened: the result is "succeeded"
 * only when Home Assistant's new state reflects it; otherwise "unconfirmed".
 * Sensitive commands are refused until the member confirms in the UI.
 */
export async function sendDeviceCommand(deviceId: string, command: DeviceCommand, confirmed: boolean, via: "app" | "assistant" = "app"): Promise<ActionResult<CommandResult>> {
  const cmd = commandSchema.safeParse(command);
  if (!uuid.safeParse(deviceId).success || !cmd.success) return fail("פקודה לא תקינה");
  return withHousehold<CommandResult>(async (ctx, supabase) => {
    const { data: device } = await supabase.from("smart_home_devices").select("*").eq("id", deviceId).eq("household_id", ctx.household.id).maybeSingle();
    if (!device) return fail("המכשיר לא נמצא");
    if (needsConfirmation(device.kind as DeviceKind, cmd.data, device.requires_confirmation as boolean) && !confirmed) {
      return ok({ status: "needs_confirmation", message: "הפעולה דורשת אישור" });
    }
    const call = toServiceCall(device.entity_id as string, device.capabilities as DeviceCapabilities, cmd.data);
    const logRow = (status: "succeeded" | "failed" | "unconfirmed", detail: string) =>
      supabase.from("device_command_log").insert({ household_id: ctx.household.id, device_id: deviceId, command: cmd.data.type, params: cmd.data, requested_by: ctx.user.id, via, status, detail: detail.slice(0, 500) });
    if ("error" in call) {
      await logRow("failed", call.error);
      return ok({ status: "failed", message: call.error });
    }
    let creds;
    try {
      creds = await haCredentials(supabase, ctx.household.id);
    } catch {
      return fail("לא ניתן לפענח את פרטי החיבור. חברו מחדש.");
    }
    if (!creds) return fail("Home Assistant לא מחובר");
    try {
      await haCallService(creds.url, creds.token, call.domain, call.service, call.data);
      // Give the device a moment, then read back the real state.
      await new Promise((r) => setTimeout(r, 1200));
      const after = await haState(creds.url, creds.token, device.entity_id as string).catch(() => null);
      const reflected = commandReflected(cmd.data, after);
      if (after) {
        await supabase
          .from("smart_home_devices")
          .update({ state: String(after.state).slice(0, 100), online: after.state !== "unavailable", state_updated_at: after.last_updated ?? new Date().toISOString(), attributes: { ...(device.attributes as object), temperature: after.attributes.temperature, current_temperature: after.attributes.current_temperature, fan_mode: after.attributes.fan_mode } })
          .eq("id", deviceId);
      }
      revalidatePath("/smart-home");
      if (reflected) {
        await logRow("succeeded", `state=${after?.state}`);
        return ok({ status: "succeeded", message: "בוצע", state: after?.state });
      }
      await logRow("unconfirmed", `state=${after?.state ?? "unknown"}`);
      return ok({ status: "unconfirmed", message: "הפקודה נשלחה, אבל המכשיר עוד לא דיווח על השינוי. בדקו שוב בעוד רגע.", state: after?.state });
    } catch (e) {
      const message = e instanceof HomeAssistantError ? e.message : "הפקודה נכשלה";
      log.warn("ha.command_failed", { message });
      await logRow("failed", message);
      return ok({ status: "failed", message });
    }
  });
}

export async function integrationEnvStatus(): Promise<{ encryption: boolean; google: boolean; push: boolean }> {
  return {
    encryption: encryptionConfigured(),
    google: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
    push: !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY,
  };
}
