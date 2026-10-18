import "server-only";

import type { HaState } from "@/lib/home-assistant";
import { assertPublicUrl } from "@/server/safe-fetch";

/**
 * Minimal Home Assistant REST client (server-only; the long-lived token never
 * reaches the browser). The base URL must be publicly reachable over HTTPS —
 * e.g. Home Assistant Cloud (Nabu Casa) or your own reverse proxy — because the
 * app server cannot reach a home LAN.
 */
export class HomeAssistantError extends Error {}

export async function haRequest<T>(baseUrl: string, token: string, path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:") throw new HomeAssistantError("כתובת Home Assistant חייבת להתחיל ב-https://");
  await assertPublicUrl(base.toString());
  const url = new URL(path, base);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      redirect: "error",
      signal: ctrl.signal,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch (e) {
    throw new HomeAssistantError((e as Error).name === "AbortError" ? "Home Assistant לא הגיב בזמן" : "לא ניתן להתחבר ל-Home Assistant");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401) throw new HomeAssistantError("הטוקן של Home Assistant לא תקין או פג תוקף");
  if (!res.ok) throw new HomeAssistantError(`Home Assistant החזיר שגיאה (${res.status})`);
  return (await res.json()) as T;
}

export async function haPing(baseUrl: string, token: string): Promise<void> {
  const r = await haRequest<{ message?: string }>(baseUrl, token, "/api/");
  if (!r?.message) throw new HomeAssistantError("זה לא נראה כמו שרת Home Assistant");
}

export const haStates = (baseUrl: string, token: string) => haRequest<HaState[]>(baseUrl, token, "/api/states");
export const haState = (baseUrl: string, token: string, entityId: string) => haRequest<HaState>(baseUrl, token, `/api/states/${encodeURIComponent(entityId)}`);

export async function haServices(baseUrl: string, token: string): Promise<Set<string>> {
  const list = await haRequest<{ domain: string; services: Record<string, unknown> }[]>(baseUrl, token, "/api/services");
  return new Set(list.flatMap((d) => Object.keys(d.services ?? {}).map((s) => `${d.domain}.${s}`)));
}

export const haCallService = (baseUrl: string, token: string, domain: string, service: string, data: Record<string, unknown>) =>
  haRequest<HaState[]>(baseUrl, token, `/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`, { method: "POST", body: data });
