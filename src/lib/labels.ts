import type {
  ChoreFrequency,
  ItemPriority,
  MealSlot,
  PlannedPurchaseStatus,
  ProjectActivityKind,
  ProjectKind,
  ProjectStatus,
  RecipeSource,
} from "@/lib/types";

/** Hebrew labels for every enum the UI shows. Order of keys = display order. */
export type Tone = "neutral" | "primary" | "sage" | "amber" | "danger" | "sky";

export const PRIORITY_LABEL: Record<ItemPriority, string> = { high: "דחוף", normal: "רגיל", low: "נמוך" };

export const PURCHASE_STATUS: Record<PlannedPurchaseStatus, { label: string; tone: Tone }> = {
  idea: { label: "רעיון", tone: "neutral" },
  researching: { label: "בבירור", tone: "sky" },
  considering: { label: "בהתלבטות", tone: "amber" },
  ready: { label: "מוכן לקנייה", tone: "primary" },
  purchased: { label: "נקנה", tone: "sage" },
  canceled: { label: "בוטל", tone: "neutral" },
};

export const PROJECT_KIND: Record<ProjectKind, string> = { project: "פרויקט", repair: "תיקון" };

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: Tone }> = {
  idea: { label: "רעיון", tone: "neutral" },
  planned: { label: "מתוכנן", tone: "sky" },
  in_progress: { label: "בעבודה", tone: "primary" },
  waiting: { label: "ממתין לגורם חיצוני", tone: "amber" },
  completed: { label: "הושלם", tone: "sage" },
  canceled: { label: "בוטל", tone: "neutral" },
};

export const ACTIVITY_KIND: Record<ProjectActivityKind, string> = {
  note: "הערה",
  troubleshooting: "ניסיון פתרון",
  technician_visit: "ביקור טכנאי",
  quote: "הצעת מחיר",
  status_change: "עדכון סטטוס",
  resolution: "פתרון",
};

export const CHORE_FREQUENCY: Record<ChoreFrequency, string> = {
  once: "חד פעמי",
  daily: "כל יום",
  weekly: "כל שבוע",
  biweekly: "כל שבועיים",
  monthly: "כל חודש",
  quarterly: "כל רבעון",
  yearly: "כל שנה",
  custom: "כל X ימים",
};

export function frequencyText(freq: ChoreFrequency, intervalDays: number | null): string {
  if (freq === "custom") return intervalDays === 1 ? "כל יום" : `כל ${intervalDays ?? "?"} ימים`;
  return CHORE_FREQUENCY[freq];
}

export const RECIPE_SOURCE: Record<RecipeSource, string> = {
  manual: "הזנה ידנית",
  website: "אתר",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  photo: "תמונה",
  other: "קישור",
};

export const MEAL_SLOT: Record<MealSlot, string> = { breakfast: "בוקר", lunch: "צהריים", dinner: "ערב", snack: "נשנוש" };

export function options<T extends string>(map: Record<T, string | { label: string }>): { value: T; label: string }[] {
  return (Object.keys(map) as T[]).map((value) => {
    const v = map[value];
    return { value, label: typeof v === "string" ? v : v.label };
  });
}

export const DOCUMENT_CATEGORY: Record<string, { label: string; emoji: string }> = {
  insurance: { label: "ביטוח", emoji: "🛡️" },
  rental: { label: "שכירות", emoji: "🏠" },
  warranty: { label: "אחריות", emoji: "🧾" },
  invoice: { label: "חשבונית", emoji: "🧾" },
  utility_bill: { label: "חשבון", emoji: "💡" },
  maintenance: { label: "תחזוקה", emoji: "🔧" },
  contract: { label: "חוזה", emoji: "📝" },
  receipt: { label: "קבלה", emoji: "🧾" },
  medical: { label: "רפואי", emoji: "🩺" },
  vehicle: { label: "רכב", emoji: "🚗" },
  tax: { label: "מסים", emoji: "🏛️" },
  other: { label: "אחר", emoji: "📄" },
};

export const BILL_CATEGORY: Record<string, { label: string; emoji: string; hue: number; unit: string | null }> = {
  electricity: { label: "חשמל", emoji: "⚡", hue: 75, unit: "קוט״ש" },
  water: { label: "מים", emoji: "💧", hue: 215, unit: "מ״ק" },
  arnona: { label: "ארנונה", emoji: "🏛️", hue: 260, unit: null },
  gas: { label: "גז", emoji: "🔥", hue: 30, unit: "מ״ק" },
  internet: { label: "אינטרנט", emoji: "📶", hue: 185, unit: null },
  building: { label: "ועד בית", emoji: "🏢", hue: 100, unit: null },
  insurance: { label: "ביטוח", emoji: "🛡️", hue: 300, unit: null },
  other: { label: "אחר", emoji: "🧾", hue: 55, unit: null },
};

export const EVENT_CATEGORY: Record<string, { label: string; emoji: string; hue: number }> = {
  technician: { label: "טכנאי", emoji: "🧰", hue: 30 },
  delivery: { label: "משלוח", emoji: "📦", hue: 55 },
  guests: { label: "אורחים", emoji: "🥂", hue: 300 },
  task: { label: "משימה", emoji: "✅", hue: 140 },
  payment: { label: "תשלום", emoji: "💳", hue: 260 },
  maintenance: { label: "תחזוקה", emoji: "🔧", hue: 185 },
  family: { label: "משפחה", emoji: "👨‍👩‍👧", hue: 340 },
  other: { label: "אחר", emoji: "📌", hue: 235 },
};

export const LIGHT_LABEL: Record<string, string> = { low: "אור נמוך", medium: "אור בינוני", bright: "אור חזק עקיף", direct: "שמש ישירה" };

export const EXPENSE_CATEGORIES: Record<string, { label: string; emoji: string }> = {
  home: { label: "בית ותחזוקה", emoji: "🏠" },
  groceries: { label: "סופר", emoji: "🛒" },
  utilities: { label: "חשבונות", emoji: "💡" },
  subscriptions: { label: "מנויים", emoji: "📺" },
  insurance: { label: "ביטוחים", emoji: "🛡️" },
  repairs: { label: "תיקונים", emoji: "🔧" },
  furniture: { label: "ריהוט וציוד", emoji: "🛋️" },
  other: { label: "אחר", emoji: "🧾" },
};
