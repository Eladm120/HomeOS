export const TIMEZONE = "Asia/Jerusalem";
export const LOCALE = "he-IL";

const numberFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 3 });
// Whole shekels without ".00"; agorot only when there are some.
const currencyFmt = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "ILS", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatQuantity(qty: number | string | null | undefined): string {
  const n = typeof qty === "string" ? Number(qty) : qty;
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  return numberFmt.format(n);
}

export function formatQuantityWithUnit(qty: number | string, unit: string): string {
  const q = formatQuantity(qty);
  return unit ? `${q} ${unit}` : q;
}

export function formatCurrency(amount: number, currency = "ILS"): string {
  if (currency === "ILS") return currencyFmt.format(amount);
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(amount);
}

/** Returns the hour (0-23) in the household timezone. */
export function hourInZone(date: Date, timeZone = TIMEZONE): number {
  const h = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(date);
  return Number(h);
}

export function greetingFor(date: Date, timeZone = TIMEZONE): string {
  const h = hourInZone(date, timeZone);
  if (h >= 5 && h < 12) return "בוקר טוב";
  if (h >= 12 && h < 17) return "צהריים טובים";
  if (h >= 17 && h < 22) return "ערב טוב";
  return "לילה טוב";
}

/** "אלעד ונעה", "אלעד, נעה ודנה" — Hebrew list joining. */
export function joinHebrewNames(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? "";
  return `${clean.slice(0, -1).join(", ")} ו${clean[clean.length - 1]}`;
}

export function formatLongDate(date: Date, timeZone = TIMEZONE): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", timeZone }).format(date);
}

export function formatHebrewCalendarDate(date: Date, timeZone = TIMEZONE): string {
  return new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { day: "numeric", month: "long", timeZone }).format(date);
}

export function formatShortDate(value: string | Date, timeZone = TIMEZONE): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone }).format(d);
}

/** YYYY-MM-DD for "today" in the household timezone. */
export function todayInZone(now = new Date(), timeZone = TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Whole days from today (in zone) until a YYYY-MM-DD date. Negative = past. */
export function daysUntil(isoDate: string, now = new Date(), timeZone = TIMEZONE): number {
  const today = Date.parse(`${todayInZone(now, timeZone)}T00:00:00Z`);
  const target = Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
  return Math.round((target - today) / 86_400_000);
}

export function relativeDays(days: number): string {
  if (days === 0) return "היום";
  if (days === 1) return "מחר";
  if (days === -1) return "אתמול";
  if (days === 2) return "בעוד יומיים";
  if (days > 0) return `בעוד ${days} ימים`;
  if (days === -2) return "לפני יומיים";
  return `לפני ${Math.abs(days)} ימים`;
}

const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

export function timeAgo(value: string | Date, now = new Date()): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const sec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return "הרגע";
  // ICU appends "(2)" / "(1)" to Hebrew dual/singular forms; strip it.
  const clean = (s: string) => s.replace(/\s*\(\d+\)/, "");
  if (abs < 3600) return clean(rtf.format(Math.round(sec / 60), "minute"));
  if (abs < 86_400) return clean(rtf.format(Math.round(sec / 3600), "hour"));
  if (abs < 86_400 * 30) return clean(rtf.format(Math.round(sec / 86_400), "day"));
  return formatShortDate(d);
}

/** Shift a YYYY-MM-DD date by whole days (calendar arithmetic, no timezone drift). */
export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO instant of a wall-clock time ("YYYY-MM-DDTHH:MM") in a timezone, DST-aware. */
export function zonedToIso(local: string, timeZone = TIMEZONE): string {
  const guess = new Date(`${local}:00Z`);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(guess);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const shown = Date.parse(`${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:00Z`);
  return new Date(guess.getTime() - (shown - guess.getTime())).toISOString();
}

/** YYYY-MM-DD plus whole years (29 Feb → 28 Feb). */
export function addYears(date: string, years: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  return `${y + years}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
