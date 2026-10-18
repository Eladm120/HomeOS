/** Modules reachable from the "משק הבית" tab, grouped the way people think about the home. */
export type HubCounts = Partial<Record<"inventory" | "chores" | "projects" | "planner" | "recipes" | "appliances" | "documents" | "plants" | "bills" | "events", number>>;

export interface HubItem {
  href: string;
  label: string;
  description: string;
  emoji: string;
  hue: number;
  countKey?: keyof HubCounts;
}

export const HUB_SECTIONS: { title: string; items: HubItem[] }[] = [
  {
    title: "יום יום",
    items: [
      { href: "/inventory", label: "מלאי הבית", description: "מה יש במקרר, במזווה ובארונות", emoji: "📦", hue: 55, countKey: "inventory" },
      { href: "/chores", label: "משימות בית", description: "מטלות חוזרות ומי אחראי", emoji: "🧹", hue: 185, countKey: "chores" },
      { href: "/meals", label: "תכנון ארוחות", description: "תפריט שבועי ומה חסר לו", emoji: "🍽️", hue: 140 },
    ],
  },
  {
    title: "הבית",
    items: [
      { href: "/projects", label: "פרויקטים ותיקונים", description: "תקלות, טכנאים והצעות מחיר", emoji: "🔧", hue: 30, countKey: "projects" },
      { href: "/planner", label: "תכנון רכישות", description: "רהיטים ומוצרים לפי חדר", emoji: "🛋️", hue: 100, countKey: "planner" },
    ],
  },
  {
    title: "עוזר חכם",
    items: [
      { href: "/suggestions", label: "הצעות", description: "מה שווה לשים לב אליו עכשיו", emoji: "💡", hue: 75 },
      { href: "/notifications", label: "התראות", description: "מה חדש בשבילך", emoji: "🔔", hue: 260 },
      { href: "/receipts", label: "קבלות", description: "צילום קבלה מעדכן את המלאי", emoji: "🧾", hue: 55 },
      { href: "/scan", label: "סריקת מוצר", description: "ברקוד או צילום", emoji: "📷", hue: 215 },
    ],
  },
  {
    title: "הגדרות",
    items: [
      { href: "/household/settings", label: "הגדרות הבית", description: "חברי הבית, הזמנות, חדרים וקטגוריות", emoji: "⚙️", hue: 260 },
      { href: "/settings/notifications", label: "הגדרות התראות", description: "על מה ומתי להתריע", emoji: "🔕", hue: 260 },
    ],
  },
];
