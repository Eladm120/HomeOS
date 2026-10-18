import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetch a user-supplied URL without letting it reach internal services (SSRF):
 * http(s) only, standard ports, every redirect hop re-checked, public IPs only,
 * short timeout and a hard size cap. The body is returned as text and is
 * treated as untrusted data by callers.
 */
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 4;

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  );
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateV4(ip);
  const v6 = ip.toLowerCase();
  if (v6 === "::1" || v6 === "::") return true;
  if (v6.startsWith("::ffff:")) return isPrivateV4(v6.slice(7));
  return v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("ff");
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("קישור לא תקין");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("ניתן לייבא רק קישורי http/https");
  if (url.username || url.password) throw new Error("קישור לא תקין");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("קישור לא נתמך");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("קישור לא נתמך");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) throw new Error("קישור לא נתמך");
  return url;
}

/** Link-preview crawlers get the public og: tags (title, caption, cover) that social sites publish for sharing. */
export const PREVIEW_USER_AGENT = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

export async function safeFetchText(
  raw: string,
  accept = "text/html,application/xhtml+xml,application/json",
  userAgent = "Mozilla/5.0 (compatible; HomeOS recipe importer; +https://homeos-one-psi.vercel.app)",
): Promise<{ url: string; text: string; contentType: string }> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          accept,
          "accept-language": "he-IL,he;q=0.9,en;q=0.8",
          "user-agent": userAgent,
        },
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) throw new Error("הקישור הפנה למקום לא ידוע");
      current = new URL(next, url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`האתר החזיר שגיאה (${res.status})`);
    const contentType = res.headers.get("content-type") ?? "";
    const reader = res.body?.getReader();
    if (!reader) return { url: url.toString(), text: "", contentType };
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    return { url: url.toString(), text, contentType };
  }
  throw new Error("יותר מדי הפניות");
}
