import type { AlertItem } from "@/lib/alerts";

/**
 * Pure dashboard logic: which widgets exist, how a member's saved layout is
 * applied, how far along the household is, and the daily brief. The brief is
 * built only from the household's own data — when there is nothing to say,
 * it says so instead of inventing insights.
 */

export const WIDGETS = [
  { id: "grocery", label: "רשימת קניות", emoji: "🛒" },
  { id: "tasks", label: "משימות היום", emoji: "🧺" },
  { id: "meals", label: "ארוחות ומתכונים", emoji: "🍽️" },
  { id: "attention", label: "דורש טיפול", emoji: "🔔" },
  { id: "smarthome", label: "בית חכם", emoji: "💡" },
  { id: "projects", label: "פרויקטים וקניות לבית", emoji: "🛠️" },
] as const;

export type WidgetId = (typeof WIDGETS)[number]["id"];
export const WIDGET_IDS = WIDGETS.map((w) => w.id) as WidgetId[];
export const LAYOUT_PREF_KEY = "dashboard.layout";

export interface DashboardLayout {
  order: WidgetId[];
  hidden: WidgetId[];
}

export const DEFAULT_LAYOUT: DashboardLayout = { order: [...WIDGET_IDS], hidden: [] };

const isWidget = (v: unknown): v is WidgetId => typeof v === "string" && (WIDGET_IDS as string[]).includes(v);

/** Read a stored layout defensively: unknown ids are dropped, new widgets are appended. */
export function normalizeLayout(raw: unknown): DashboardLayout {
  const r = (raw && typeof raw === "object" ? raw : {}) as { order?: unknown; hidden?: unknown };
  const order = Array.isArray(r.order) ? [...new Set(r.order.filter(isWidget))] : [];
  for (const id of WIDGET_IDS) if (!order.includes(id)) order.push(id);
  const hidden = Array.isArray(r.hidden) ? [...new Set(r.hidden.filter(isWidget))] : [];
  return { order, hidden };
}

export function moveWidget(layout: DashboardLayout, id: WidgetId, delta: -1 | 1): DashboardLayout {
  const order = [...layout.order];
  const at = order.indexOf(id);
  const to = at + delta;
  if (at < 0 || to < 0 || to >= order.length) return layout;
  [order[at], order[to]] = [order[to], order[at]];
  return { ...layout, order };
}

export function toggleWidget(layout: DashboardLayout, id: WidgetId): DashboardLayout {
  const hidden = layout.hidden.includes(id) ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id];
  return { ...layout, hidden };
}

// ---- Household stage ---------------------------------------------------------

export type HouseholdStage = "new" | "partial" | "active";

/** New: nothing entered yet. Partial: some modules in use. Active: the everyday loop runs. */
export function householdStage(c: { inventory: number; chores: number; recipes: number; groceryEver: number }): HouseholdStage {
  const used = [c.inventory > 0, c.chores > 0, c.recipes > 0, c.groceryEver > 0].filter(Boolean).length;
  if (used === 0) return "new";
  if (used >= 3 || (c.inventory > 0 && c.chores > 0)) return "active";
  return "partial";
}

// ---- Daily brief -------------------------------------------------------------

export interface BriefInsight {
  key: string;
  emoji: string;
  hue: number;
  text: string;
  detail?: string;
  href: string;
  /** A one-tap action (same server path as the alerts feed). */
  action?: AlertItem["action"];
  /** Otherwise a link-style call to action. */
  cta?: string;
}

export interface BriefInput {
  alerts: AlertItem[];
  tasks: { id: string; title: string; days: number }[];
  grocery: { count: number; urgent: number };
  meals: { title: string; slot: string; href: string }[];
  readyRecipe: { title: string; href: string } | null;
}

export interface Brief {
  headline: string;
  insights: BriefInsight[];
  /** Alert keys the brief already shows, so the attention widget does not repeat them. */
  usedAlertKeys: string[];
  calm: boolean;
}

const URGENCY_RANK = { now: 0, soon: 1 } as const;
const GROUP_RANK: Record<AlertItem["group"], number> = { money: 0, stock: 1, expiry: 2, plant: 3, other: 4, chore: 5 };

/** Count a Hebrew noun: 1 → "דבר אחד", n → "n דברים". */
const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

export function buildBrief(i: BriefInput): Brief {
  const insights: BriefInsight[] = [];
  const used: string[] = [];

  const overdue = i.tasks.filter((t) => t.days < 0);
  const today = i.tasks.filter((t) => t.days === 0);
  if (overdue.length) {
    insights.push({
      key: "tasks:overdue",
      emoji: "⏰",
      hue: 25,
      text: overdue.length === 1 ? `${overdue[0].title} באיחור` : `${overdue.length} משימות באיחור`,
      detail: overdue.length > 1 ? `הראשונה: ${overdue[0].title}` : undefined,
      href: "#tasks",
      cta: "לרשימה",
    });
  }

  const actionable = i.alerts
    .filter((a) => !a.handled && a.group !== "chore")
    .sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || GROUP_RANK[a.group] - GROUP_RANK[b.group]);
  for (const a of actionable) {
    if (insights.length >= 3) break;
    if (a.urgency !== "now" && insights.length >= 2) break;
    used.push(a.key);
    insights.push({ key: a.key, emoji: a.emoji, hue: a.hue, text: a.title, detail: a.detail, href: a.href, action: a.action });
  }

  if (insights.length < 3 && i.grocery.urgent > 0) {
    insights.push({
      key: "grocery:urgent",
      emoji: "🛒",
      hue: 75,
      text: i.grocery.urgent === 1 ? "מוצר דחוף ברשימת הקניות" : `${i.grocery.urgent} מוצרים דחופים ברשימת הקניות`,
      href: "/shopping",
      cta: "לרשימה",
    });
  }

  if (insights.length < 3 && !i.meals.length && i.readyRecipe) {
    insights.push({
      key: "meal:ready",
      emoji: "🍳",
      hue: 40,
      text: `אפשר להכין היום ${i.readyRecipe.title}`,
      detail: "לפי המלאי יש את כל המצרכים",
      href: i.readyRecipe.href,
      cta: "למתכון",
    });
  }

  const needs = overdue.length + actionable.filter((a) => a.urgency === "now").length;
  const headline =
    needs > 0
      ? `${count(needs, "דבר אחד", "דברים")} ${needs === 1 ? "מחכה" : "מחכים"} לכם היום`
      : today.length
        ? `${count(today.length, "משימה אחת", "משימות")} להיום, וחוץ מזה הכל רגוע`
        : insights.length
          ? "יום רגוע. כמה דברים שכדאי לדעת:"
          : "הכל רגוע בבית היום";

  return { headline, insights, usedAlertKeys: used, calm: needs === 0 };
}
