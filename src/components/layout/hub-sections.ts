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
      { href: "/appliances", label: "מכשירי חשמל", description: "אחריות, חשבוניות ותחזוקה", emoji: "🔌", hue: 235, countKey: "appliances" },
      { href: "/plants", label: "צמחים", description: "השקיה ותזכורות", emoji: "🪴", hue: 140, countKey: "plants" },
      { href: "/smart-home", label: "בית חכם", description: "מזגן, דוד ותאורה דרך Home Assistant", emoji: "💡", hue: 75 },
    ],
  },
  {
    title: "ניהול",
    items: [
      { href: "/calendar", label: "יומן הבית", description: "טכנאים, משלוחים ואורחים", emoji: "📅", hue: 30, countKey: "events" },
      { href: "/bills", label: "חשבונות", description: "חשמל, מים, ארנונה", emoji: "🧾", hue: 300, countKey: "bills" },
      { href: "/expenses", label: "הוצאות הבית", description: "חיובים קבועים ומגמות", emoji: "📊", hue: 260 },
      { href: "/documents", label: "מסמכים", description: "ביטוחים, חוזים ואחריות", emoji: "📁", hue: 260, countKey: "documents" },
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
      { href: "/settings/integrations", label: "חיבורים", description: "Home Assistant, Google, AI", emoji: "🔗", hue: 185 },
    ],
  },
];
