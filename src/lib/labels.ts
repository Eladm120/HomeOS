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
