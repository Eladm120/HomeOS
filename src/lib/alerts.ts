import { addDays, daysUntil, relativeDays } from "@/lib/format";
import { expiryState, stockLevel } from "@/lib/inventory-logic";

/**
 * One feed for everything that needs a person's attention: stock, expiry,
 * chores, bills, recurring payments (rent…), plants and the leftover
 * suggestions. Computed straight from the household's data, so there is no
 * separate "suggestions" vs "notifications" list to keep in sync.
 */
export type AlertUrgency = "now" | "soon";

export type AlertAction =
  | { type: "add_to_list"; id: string }
  | { type: "complete_chore"; id: string }
  | { type: "bill_paid"; id: string }
  | { type: "charge_paid"; id: string }
  | { type: "water_plant"; id: string }
  | { type: "dismiss_suggestion"; id: string };

export interface AlertItem {
  key: string;
  group: "stock" | "expiry" | "chore" | "money" | "plant" | "other";
  emoji: string;
  hue: number;
  title: string;
  detail: string;
  urgency: AlertUrgency;
  href: string;
  action?: AlertAction & { label: string };
  /** Already handled automatically (e.g. put on the shopping list) — shown calmly. */
  handled?: string;
}

export interface AlertInputs {
  today: string;
  now: Date;
  timeZone?: string;
  inventory: { id: string; name: string; unit: string; quantity: number | string; min_threshold: number | string | null; expires_on: string | null }[];
  onListInventoryIds: Set<string>;
  chores: { id: string; title: string; next_due_on: string; assignee_name: string | null }[];
  bills: { id: string; label: string; amount: number | string; due_on: string | null }[];
  charges: { id: string; title: string; amount: number | string; next_due_on: string | null }[];
  plants: { id: string; name: string; watering_interval_days: number; last_watered_on: string | null }[];
  suggestions: { id: string; kind: string; title: string; body: string | null; href: string | null; priority: string }[];
}

const SUGGESTION_UI: Record<string, { emoji: string; hue: number }> = {
  warranty: { emoji: "🛡️", hue: 235 },
  bill_unusual: { emoji: "📈", hue: 300 },
  document_expiry: { emoji: "📄", hue: 260 },
  repair_followup: { emoji: "🔧", hue: 30 },
  device: { emoji: "💡", hue: 75 },
};
/** Kinds the feed computes itself; anything else from ai_suggestions is passed through. */
export const COMPUTED_SUGGESTION_KINDS = ["low_stock", "expiring", "overdue_chore", "chore_due", "bill_due", "plant_water"];

const money = (n: number | string) => `${Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 })} ₪`;
const qty = (n: number | string) => Number(Number(n).toFixed(2)).toString();

export function buildAlerts(i: AlertInputs): AlertItem[] {
  const out: AlertItem[] = [];
  const due = (iso: string) => daysUntil(iso, i.now, i.timeZone);

  for (const it of i.inventory) {
    const level = stockLevel({ quantity: Number(it.quantity), min_threshold: it.min_threshold == null ? null : Number(it.min_threshold) });
    if ((level === "low" || level === "out") && it.min_threshold != null) {
      const listed = i.onListInventoryIds.has(it.id);
      out.push({
        key: `stock:${it.id}`,
        group: "stock",
        emoji: level === "out" ? "🫙" : "📦",
        hue: 55,
        title: level === "out" ? `${it.name} נגמר` : `${it.name} עומד להיגמר`,
        detail: level === "out" ? `מינימום ${qty(it.min_threshold)} ${it.unit}` : `נשארו ${qty(it.quantity)} ${it.unit} · מינימום ${qty(it.min_threshold)}`,
        urgency: level === "out" ? "now" : "soon",
        href: `/inventory/${it.id}`,
        ...(listed ? { handled: "ברשימת הקניות" } : { action: { type: "add_to_list", id: it.id, label: "לרשימה" } }),
      });
    }
    const exp = expiryState(it.expires_on, i.now);
    if (exp && exp.state !== "ok") {
      out.push({
        key: `expiry:${it.id}`,
        group: "expiry",
        emoji: "⏳",
        hue: 30,
        title: exp.state === "expired" ? `${it.name} פג תוקף` : `${it.name} — תוקף ${relativeDays(exp.days)}`,
        detail: exp.state === "expired" ? "כדאי לבדוק ולזרוק" : "כדאי להשתמש בקרוב",
        urgency: exp.days <= 0 ? "now" : "soon",
        href: `/inventory/${it.id}`,
      });
    }
  }

  for (const c of i.chores) {
    const d = due(c.next_due_on);
    if (d > 0) continue;
    out.push({
      key: `chore:${c.id}`,
      group: "chore",
      emoji: "🧹",
      hue: 185,
      title: c.title,
      detail: `${d < 0 ? `באיחור · ${relativeDays(d)}` : "להיום"} · ${c.assignee_name ?? "משותף"}`,
      urgency: "now",
      href: `/chores/${c.id}`,
      action: { type: "complete_chore", id: c.id, label: "בוצע" },
    });
  }

  for (const b of i.bills) {
    const d = b.due_on ? due(b.due_on) : null;
    if (d != null && d > 7) continue;
    out.push({
      key: `bill:${b.id}`,
      group: "money",
      emoji: "🧾",
      hue: 300,
      title: `${b.label} · ${money(b.amount)}`,
      detail: d == null ? "ממתין לתשלום" : d < 0 ? `באיחור · ${relativeDays(d)}` : `לתשלום ${relativeDays(d)}`,
      urgency: d != null && d <= 2 ? "now" : "soon",
      href: `/bills/${b.id}`,
      action: { type: "bill_paid", id: b.id, label: "שולם" },
    });
  }

  for (const c of i.charges) {
    if (!c.next_due_on) continue;
    const d = due(c.next_due_on);
    if (d > 5) continue;
    out.push({
      key: `charge:${c.id}`,
      group: "money",
      emoji: "🏠",
      hue: 260,
      title: `${c.title} · ${money(c.amount)}`,
      detail: d < 0 ? `באיחור · ${relativeDays(d)}` : d === 0 ? "לתשלום היום" : `לתשלום ${relativeDays(d)}`,
      urgency: d <= 1 ? "now" : "soon",
      href: "/expenses",
      action: { type: "charge_paid", id: c.id, label: "שולם" },
    });
  }

  for (const p of i.plants) {
    const next = p.last_watered_on ? addDays(p.last_watered_on, p.watering_interval_days) : i.today;
    const d = due(next);
    if (d > 0) continue;
    out.push({
      key: `plant:${p.id}`,
      group: "plant",
      emoji: "🪴",
      hue: 140,
      title: `להשקות את ${p.name}`,
      detail: p.last_watered_on ? `הושקה לאחרונה ${relativeDays(due(p.last_watered_on))}` : "עוד לא נרשמה השקיה",
      urgency: d < 0 ? "now" : "soon",
      href: `/plants/${p.id}`,
      action: { type: "water_plant", id: p.id, label: "השקיתי" },
    });
  }

  for (const s of i.suggestions) {
    if (COMPUTED_SUGGESTION_KINDS.includes(s.kind)) continue;
    const ui = SUGGESTION_UI[s.kind] ?? { emoji: "🔔", hue: 260 };
    out.push({
      key: `sugg:${s.id}`,
      group: "other",
      emoji: ui.emoji,
      hue: ui.hue,
      title: s.title,
      detail: s.body ?? "",
      urgency: s.priority === "high" ? "now" : "soon",
      href: s.href ?? "/notifications",
      action: { type: "dismiss_suggestion", id: s.id, label: "הבנתי" },
    });
  }

  // Actionable first within each urgency; handled items sink to the bottom.
  const rank = (a: AlertItem) => (a.urgency === "now" ? 0 : 2) + (a.handled ? 1 : 0);
  return out.sort((a, b) => rank(a) - rank(b));
}
