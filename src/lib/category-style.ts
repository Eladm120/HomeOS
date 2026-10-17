/**
 * Visual identity for grocery categories and products: a soft tint (OKLCH hue,
 * rendered by the `.cat-tint` / `.cat-ink` utilities) and a product picture
 * (emoji) used whenever the household has not uploaded a real photo.
 * Also guesses the category of a newly typed product, so quick-add lands in
 * the right section without extra taps.
 */

export type CategoryKind =
  | "produce"
  | "dairy"
  | "meat"
  | "bakery"
  | "frozen"
  | "pantry"
  | "drinks"
  | "cleaning"
  | "care"
  | "home"
  | "other";

export interface CategoryStyle {
  kind: CategoryKind;
  emoji: string;
  hue: number;
}

const STYLES: Record<CategoryKind, Omit<CategoryStyle, "kind">> = {
  produce: { emoji: "🥬", hue: 140 },
  dairy: { emoji: "🥛", hue: 235 },
  meat: { emoji: "🍗", hue: 30 },
  bakery: { emoji: "🥖", hue: 75 },
  frozen: { emoji: "🧊", hue: 215 },
  pantry: { emoji: "🥫", hue: 55 },
  drinks: { emoji: "🧃", hue: 300 },
  cleaning: { emoji: "🧽", hue: 185 },
  care: { emoji: "🧴", hue: 340 },
  home: { emoji: "🏠", hue: 100 },
  other: { emoji: "🛒", hue: 260 },
};

// Category names (Hebrew defaults + common custom names) and Lucide icon names → kind.
const NAME_HINTS: [RegExp, CategoryKind][] = [
  [/ירק|פיר/, "produce"],
  [/חלב|ביצ|גבינ/, "dairy"],
  [/בשר|דג|עוף/, "meat"],
  [/מאפ|לחם/, "bakery"],
  [/קפוא/, "frozen"],
  [/מזווה|יבש|שימור/, "pantry"],
  [/משקא|שתי/, "drinks"],
  [/ניקי|כביס/, "cleaning"],
  [/טואלט|טיפוח|היגיינ|תינוק/, "care"],
  [/לבית|בית/, "home"],
];
const ICON_HINTS: Record<string, CategoryKind> = {
  apple: "produce",
  milk: "dairy",
  beef: "meat",
  croissant: "bakery",
  snowflake: "frozen",
  wheat: "pantry",
  "cup-soda": "drinks",
  "spray-can": "cleaning",
  bath: "care",
  house: "home",
};

export function categoryKind(category: { name: string; icon?: string | null } | null | undefined): CategoryKind {
  if (!category) return "other";
  if (category.icon && ICON_HINTS[category.icon]) return ICON_HINTS[category.icon];
  for (const [re, kind] of NAME_HINTS) if (re.test(category.name)) return kind;
  return "other";
}

export function categoryStyle(category: { name: string; icon?: string | null } | null | undefined): CategoryStyle {
  const kind = categoryKind(category);
  return { kind, ...STYLES[kind] };
}

// Product keywords → picture, grouped by the category they imply. Order matters:
// more specific phrases come before the words they contain ("תפוחי אדמה" before "תפוח"),
// and pantry is checked before meat so "דגני בוקר" is cereal, not fish.
const PRODUCT_HINTS: [CategoryKind, [string, string][]][] = [
  ["produce", [["תפוחי אדמה", "🥔"], ["תפוח אדמה", "🥔"], ["בטטה", "🍠"], ["עגבני", "🍅"], ["מלפפון", "🥒"], ["בננ", "🍌"], ["תפוח", "🍎"], ["אבוקדו", "🥑"], ["בצל", "🧅"], ["שום", "🧄"], ["גזר", "🥕"], ["חסה", "🥬"], ["כרוב", "🥬"], ["תרד", "🥬"], ["לימון", "🍋"], ["ענב", "🍇"], ["תותים", "🍓"], ["תות שדה", "🍓"], ["אבטיח", "🍉"], ["מלון", "🍈"], ["פלפל", "🫑"], ["תפוז", "🍊"], ["קלמנטינ", "🍊"], ["ברוקולי", "🥦"], ["כרובית", "🥦"], ["תירס", "🌽"], ["פטרי", "🍄"], ["אגס", "🍐"], ["אפרסק", "🍑"], ["דובדבן", "🍒"], ["אננס", "🍍"], ["מנגו", "🥭"], ["קיווי", "🥝"], ["חציל", "🍆"], ["פטרוזיליה", "🌿"], ["כוסברה", "🌿"], ["נענע", "🌿"], ["ירק", "🥬"], ["פירות", "🍎"]]],
  ["dairy", [["חלב", "🥛"], ["גבינ", "🧀"], ["קוטג", "🧀"], ["לבנה", "🧀"], ["יוגורט", "🥣"], ["ביצ", "🥚"], ["חמאה", "🧈"], ["שמנת", "🥛"]]],
  ["bakery", [["לחמני", "🥯"], ["לחם", "🍞"], ["פית", "🫓"], ["טורטיי", "🫓"], ["באגט", "🥖"], ["חלה", "🥖"], ["קרואסון", "🥐"], ["עוג", "🍰"], ["בורקס", "🥐"]]],
  ["frozen", [["גלידה", "🍦"], ["קפוא", "🧊"], ["פיצה", "🍕"], ["אפונה", "🫛"]]],
  ["drinks", [["מים", "💧"], ["סודה", "🥤"], ["קולה", "🥤"], ["מיץ", "🧃"], ["יין", "🍷"], ["בירה", "🍺"], ["משקה", "🥤"]]],
  ["pantry", [["פסטה", "🍝"], ["ספגטי", "🍝"], ["אטריות", "🍜"], ["אורז", "🍚"], ["שמן", "🫒"], ["זית", "🫒"], ["קפה", "☕"], ["תה", "🍵"], ["סוכר", "🍬"], ["מלח", "🧂"], ["תבלין", "🧂"], ["קמח", "🌾"], ["שיבולת", "🌾"], ["קורנפלקס", "🥣"], ["דגני", "🥣"], ["טונה", "🥫"], ["שימור", "🥫"], ["רסק", "🥫"], ["חומוס", "🥫"], ["טחינה", "🥫"], ["קטשופ", "🥫"], ["מיונז", "🥫"], ["דבש", "🍯"], ["ריבה", "🍯"], ["שוקולד", "🍫"], ["עוגיות", "🍪"], ["ביסלי", "🍪"], ["חטיף", "🍪"], ["במבה", "🥜"], ["אגוז", "🥜"], ["שקד", "🥜"], ["קרקר", "🍘"]]],
  ["meat", [["עוף", "🍗"], ["שניצל", "🍗"], ["הודו", "🍗"], ["כנפיים", "🍗"], ["בשר", "🥩"], ["טחון", "🥩"], ["סטייק", "🥩"], ["אנטריקוט", "🥩"], ["קבב", "🥩"], ["נקניק", "🌭"], ["דג", "🐟"], ["סלמון", "🐟"], ["טונה טרייה", "🐟"], ["שרימפס", "🦐"]]],
  ["cleaning", [["אבקת כביסה", "🧺"], ["ג׳ל כביסה", "🧺"], ["מרכך כביסה", "🧺"], ["כביסה", "🧺"], ["נייר טואלט", "🧻"], ["מגבות נייר", "🧻"], ["נייר", "🧻"], ["מגבונים", "🧻"], ["טבליות", "🍽️"], ["מדיח", "🍽️"], ["סבון כלים", "🧽"], ["נוזל כלים", "🧽"], ["ספוג", "🧽"], ["אקונומיקה", "🧴"], ["ניקוי", "🧽"], ["שקיות אשפה", "🛍️"], ["שקיות", "🛍️"]]],
  ["care", [["משחת שיניים", "🪥"], ["מברשת שיניים", "🪥"], ["שמפו", "🧴"], ["מרכך", "🧴"], ["דאודורנט", "🧴"], ["קרם", "🧴"], ["סבון", "🧼"], ["טיטול", "👶"], ["חיתול", "👶"], ["תחבושות", "🩹"], ["גילוח", "🪒"]]],
];

export interface ProductGuess {
  kind: CategoryKind;
  emoji: string;
}

export function guessProduct(name: string): ProductGuess | null {
  const n = name.trim();
  if (!n) return null;
  for (const [kind, hints] of PRODUCT_HINTS) {
    for (const [word, emoji] of hints) if (n.includes(word)) return { kind, emoji };
  }
  return null;
}

/** Picture for a product row: explicit keyword match, else the category's picture. */
export function productEmoji(name: string, category?: { name: string; icon?: string | null } | null): string {
  return guessProduct(name)?.emoji ?? categoryStyle(category).emoji;
}

/** Pick the household category that best fits a typed product name, if any. */
export function guessCategoryId<T extends { id: string; name: string; icon?: string | null }>(name: string, categories: T[]): string | null {
  const guess = guessProduct(name);
  if (!guess) return null;
  return categories.find((c) => categoryKind(c) === guess.kind)?.id ?? null;
}
