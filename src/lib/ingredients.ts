/**
 * Recipe ingredient ↔ household inventory matching. Deterministic on purpose:
 * no AI is needed to decide whether "2 כוסות קמח" is covered by "קמח 1 ק״ג".
 *
 * - Hebrew names are normalised (final letters, plural endings, descriptors).
 * - Quantities are compared only inside one dimension (mass, volume, count).
 *   Cups/spoons convert to millilitres; nothing converts volume to mass, because
 *   that needs a density we do not have. Such cases are reported as "unclear".
 */

export type Dimension = "mass" | "volume" | "count";

const UNIT_TABLE: [string[], Dimension, number][] = [
  [["גרם", "גר׳", "גר", "ג׳", "g", "gr"], "mass", 1],
  [["ק״ג", "ק\"ג", "קג", "קילו", "קילוגרם", "kg"], "mass", 1000],
  [["מ״ג", "מ\"ג", "mg"], "mass", 0.001],
  [["מ״ל", "מ\"ל", "מל", "ml", "סמ״ק"], "volume", 1],
  [["ליטר", "ל׳", "l", "liter"], "volume", 1000],
  [["כוס", "כוסות", "cup", "cups"], "volume", 240],
  [["כף", "כפות", "tbsp"], "volume", 15],
  [["כפית", "כפיות", "tsp"], "volume", 5],
  [["יח׳", "יח'", "יחידה", "יחידות", "יח", "pcs"], "count", 1],
  [["זוג", "זוגות"], "count", 2],
  [["תריסר"], "count", 12],
];

export function unitInfo(unit: string | null | undefined): { dimension: Dimension; factor: number } | null {
  const u = (unit ?? "").trim().toLowerCase();
  if (!u) return { dimension: "count", factor: 1 };
  for (const [names, dimension, factor] of UNIT_TABLE) if (names.includes(u)) return { dimension, factor };
  return null; // package-like units (חבילה, בקבוק, קופסה…) are not convertible
}

/** Convert `qty unit` into `toUnit`. Null when the dimensions differ or are unknown. */
export function convert(qty: number, unit: string | null | undefined, toUnit: string | null | undefined): number | null {
  const sameName = (unit ?? "").trim() === (toUnit ?? "").trim();
  if (sameName) return qty;
  const from = unitInfo(unit);
  const to = unitInfo(toUnit);
  if (!from || !to || from.dimension !== to.dimension) return null;
  return (qty * from.factor) / to.factor;
}

const FINALS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };
const DESCRIPTORS = new Set([
  "טרי", "טריה", "טריים", "טריות", "קצוץ", "קצוצה", "קצוצים", "קצוצות", "פרוס", "פרוסה", "פרוסים", "מגורד", "מגורדת",
  "גדול", "גדולה", "גדולים", "גדולות", "בינוני", "בינונית", "בינוניים", "קטן", "קטנה", "קטנים", "קטנות", "שלם", "שלמה",
  "מבושל", "מבושלת", "מבושלים", "מומס", "מומסת", "רך", "רכה", "קר", "קרה", "חם", "חמה", "איכותי", "איכותית",
  "לבן", "לבנה", "לבנים", "יבש", "יבשה", "יבשים", "כתוש", "כתושה", "טחון", "טחונה", "של", "או", "עם", "ללא", "בערך",
]);

function stem(word: string): string {
  let w = word.replace(/[ךםןףץ]/g, (c) => FINALS[c]);
  for (const suffix of ["יות", "ימ", "ות"]) {
    if (w.length > suffix.length + 2 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  while (w.length > 3 && (w.endsWith("ה") || w.endsWith("י"))) w = w.slice(0, -1);
  return w;
}

/** Stable key for an ingredient or product name ("עגבניות שרי טריות" → "עגבני שרי"). */
export function ingredientKey(name: string): string {
  return tokens(name).join(" ");
}

export function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/["'׳״%.,()\-–/\\:;!?]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !/^\d+$/.test(t) && !DESCRIPTORS.has(t))
    .map(stem)
    .filter(Boolean);
}

/** 0 = unrelated … 1 = same product. Every token of the shorter name must appear in the longer one. */
export function nameScore(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const hits = short.filter((t) => long.includes(t)).length;
  if (hits < short.length) return 0;
  return short.length / long.length;
}

export interface StockItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  stock_confidence?: "confirmed" | "estimated";
}

export interface IngredientNeed {
  name: string;
  quantity: number | null;
  unit: string | null;
  optional?: boolean;
  inventory_item_id?: string | null;
}

export type IngredientStatus = "available" | "insufficient" | "missing" | "unclear";

export interface IngredientCheck {
  ingredient: IngredientNeed;
  status: IngredientStatus;
  match: StockItem | null;
  /** Other inventory products that could also be this ingredient. */
  alternatives: StockItem[];
  /** Needed amount expressed in the matched product's unit, when convertible. */
  needInStockUnit: number | null;
  /** Amount to buy (in the stock unit when known, else the recipe unit). */
  shortfall: { quantity: number; unit: string } | null;
  reason: string;
}

/**
 * Compare a recipe's ingredients with stock. `servingsFactor` scales quantities
 * (e.g. 1.5 for 6 servings of a 4-serving recipe). `mappings` are learned links
 * from ingredient key to inventory item id.
 */
export function checkIngredients(
  ingredients: IngredientNeed[],
  stock: StockItem[],
  { servingsFactor = 1, mappings = {} }: { servingsFactor?: number; mappings?: Record<string, string> } = {},
): IngredientCheck[] {
  const byId = new Map(stock.map((s) => [s.id, s]));
  return ingredients.map((ing) => {
    const need = ing.quantity != null ? ing.quantity * servingsFactor : null;
    const pinnedId = ing.inventory_item_id ?? mappings[ingredientKey(ing.name)];
    const pinned = pinnedId ? byId.get(pinnedId) : undefined;

    const scored = stock
      .map((s) => ({ s, score: nameScore(ing.name, s.name) }))
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score);

    const match = pinned ?? scored[0]?.s ?? null;
    const alternatives = scored.map((x) => x.s).filter((s) => s.id !== match?.id).slice(0, 4);
    const ambiguousName = !pinned && scored.length > 1 && scored[0].score === scored[1].score;

    const base = { ingredient: ing, match, alternatives };
    if (!match) {
      return {
        ...base,
        status: "missing",
        needInStockUnit: null,
        shortfall: need != null ? { quantity: round(need), unit: ing.unit ?? "יח׳" } : { quantity: 1, unit: ing.unit ?? "יח׳" },
        reason: "לא נמצא במלאי",
      };
    }
    if (ambiguousName) {
      return { ...base, status: "unclear", needInStockUnit: null, shortfall: null, reason: "יש כמה מוצרים מתאימים במלאי" };
    }

    const have = Number(match.quantity);
    if (need == null) {
      return {
        ...base,
        status: have > 0 ? "available" : "missing",
        needInStockUnit: null,
        shortfall: have > 0 ? null : { quantity: 1, unit: match.unit },
        reason: have > 0 ? "יש במלאי" : "נגמר במלאי",
      };
    }

    const needInStockUnit = convert(need, ing.unit, match.unit);
    if (needInStockUnit == null) {
      if (have <= 0) {
        return { ...base, status: "missing", needInStockUnit: null, shortfall: { quantity: 1, unit: match.unit }, reason: "נגמר במלאי" };
      }
      return {
        ...base,
        status: "unclear",
        needInStockUnit: null,
        shortfall: null,
        reason: `יש ${round(have)} ${match.unit}, אבל אי אפשר להשוות ל-${ing.unit ?? "יחידות"}`,
      };
    }
    if (have >= needInStockUnit) {
      return { ...base, status: "available", needInStockUnit, shortfall: null, reason: "יש מספיק" };
    }
    return {
      ...base,
      status: have > 0 ? "insufficient" : "missing",
      needInStockUnit,
      shortfall: { quantity: roundUp(needInStockUnit - have, match.unit), unit: match.unit },
      reason: have > 0 ? `יש ${round(have)} ${match.unit}, צריך ${round(needInStockUnit)}` : "נגמר במלאי",
    };
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Count-like units round up to whole items; measured units keep two decimals. */
function roundUp(n: number, unit: string): number {
  const info = unitInfo(unit);
  if (!info || info.dimension === "count") return Math.ceil(n - 1e-9);
  return Math.ceil(n * 100 - 1e-6) / 100;
}

export interface ShoppingProposal {
  key: string;
  name: string;
  quantity: number;
  unit: string;
  inventory_item_id: string | null;
  sources: string[];
}

/**
 * Merge shortfalls from several checks (e.g. a week of meals) into one list,
 * adding quantities only when the units are compatible.
 */
export function aggregateShortfalls(groups: { source: string; checks: IngredientCheck[] }[]): ShoppingProposal[] {
  const out = new Map<string, ShoppingProposal>();
  for (const { source, checks } of groups) {
    for (const c of checks) {
      if (!c.shortfall || c.ingredient.optional) continue;
      const name = c.match?.name ?? c.ingredient.name;
      const key = c.match ? `inv:${c.match.id}` : `ing:${ingredientKey(c.ingredient.name)}`;
      const prev = out.get(key);
      if (!prev) {
        out.set(key, { key, name, quantity: c.shortfall.quantity, unit: c.shortfall.unit, inventory_item_id: c.match?.id ?? null, sources: [source] });
        continue;
      }
      const add = convert(c.shortfall.quantity, c.shortfall.unit, prev.unit);
      if (add == null) {
        // incompatible units for the same product: keep a separate line
        const altKey = `${key}:${c.shortfall.unit}`;
        const alt = out.get(altKey);
        if (alt) alt.quantity = round(alt.quantity + c.shortfall.quantity);
        else out.set(altKey, { ...prev, key: altKey, quantity: c.shortfall.quantity, unit: c.shortfall.unit, sources: [source] });
      } else {
        prev.quantity = round(prev.quantity + add);
        if (!prev.sources.includes(source)) prev.sources.push(source);
      }
    }
  }
  return [...out.values()];
}

/**
 * Parse one free-text ingredient line: "2 כוסות קמח", "קמח - 500 גרם",
 * "1/2 כפית מלח", "ביצה". Unknown units stay part of the name.
 */
export function parseIngredientLine(raw: string): IngredientNeed | null {
  const line = raw.replace(/^[\s•*·\-–]+|\s+$/g, "").replace(/^\d+[.)]\s+/, "");
  if (!line) return null;
  const fraction = (s: string): number | null => {
    const t = s.replace("½", "1/2").replace("¼", "1/4").replace("¾", "3/4");
    const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    const frac = t.match(/^(\d+)\/(\d+)$/);
    if (frac) return Number(frac[1]) / Number(frac[2]);
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const qtyRe = /(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾])/;
  const words = line.split(/\s+/);
  let qty: number | null = null;
  let unit: string | null = null;
  const nameWords: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const pair = i + 1 < words.length ? `${w} ${words[i + 1]}` : "";
    if (qty == null && pair && /^\d+\s+\d+\/\d+$/.test(pair)) {
      qty = fraction(pair);
      i++;
      continue;
    }
    if (qty == null && qtyRe.test(w) && w.match(qtyRe)?.[0] === w) {
      qty = fraction(w);
      continue;
    }
    if (qty != null && !unit && unitInfo(w) && w !== "") {
      unit = w;
      continue;
    }
    if (w === "-" || w === "–") continue;
    nameWords.push(w);
  }
  const name = nameWords.join(" ").replace(/^ל|^של /, (m) => (m === "ל" ? "ל" : "")).trim();
  if (!name) return null;
  return { name, quantity: qty, unit };
}
