/**
 * What the "משק הבית" tab offers, in the order people reach for it.
 * Projects, purchase planning, the calendar, receipts and product scanning are
 * parked for now: their routes still work, they are just not on the menu.
 */
export interface HubLink {
  href: string;
  label: string;
  emoji: string;
  hue: number;
}

/** The three everyday modules. */
export const HUB_MAIN = {
  inventory: { href: "/inventory", label: "מלאי הבית", emoji: "📦", hue: 55 },
  chores: { href: "/chores", label: "משימות", emoji: "🧺", hue: 150 },
  meals: { href: "/meals", label: "תכנון ארוחות", emoji: "🍽️", hue: 30 },
} satisfies Record<string, HubLink>;

export const HUB_HOME: HubLink[] = [
  { href: "/smart-home", label: "בית חכם", emoji: "🛋️", hue: 75 },
  { href: "/appliances", label: "מכשירים", emoji: "🔌", hue: 235 },
  { href: "/plants", label: "צמחים", emoji: "🪴", hue: 140 },
];

/** One "ניהול" module: money and paperwork. */
export const HUB_MANAGE: HubLink[] = [
  { href: "/bills", label: "חשבונות", emoji: "🧾", hue: 300 },
  { href: "/expenses", label: "הוצאות הבית", emoji: "📊", hue: 260 },
  { href: "/documents", label: "מסמכים", emoji: "📁", hue: 215 },
];

export const HUB_SETTINGS: HubLink[] = [
  { href: "/household/settings", label: "הגדרות הבית", emoji: "⚙️", hue: 260 },
  { href: "/settings/notifications", label: "הגדרות התראות", emoji: "🔕", hue: 260 },
  { href: "/settings/integrations", label: "חיבורים", emoji: "🔗", hue: 185 },
];

/** Flat list for the desktop sidebar. */
export const HUB_LINKS: HubLink[] = [...Object.values(HUB_MAIN), { href: "/notifications", label: "התראות", emoji: "🔔", hue: 30 }, ...HUB_HOME, ...HUB_MANAGE];
