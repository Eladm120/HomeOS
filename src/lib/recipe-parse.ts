import type { RecipeSource } from "@/lib/types";
import { parseIngredientLine, type IngredientNeed } from "@/lib/ingredients";

/**
 * Pure parsing of recipe pages: schema.org Recipe JSON-LD first (most food
 * blogs publish it), Open Graph tags as a fallback. Everything extracted here
 * is a draft the user reviews before saving.
 */
export interface RecipeDraft {
  title: string;
  description: string | null;
  image_url: string | null;
  source_url: string;
  source_platform: RecipeSource;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  ingredients: IngredientNeed[];
  steps: string[];
  /** How complete the extraction is, so the UI can say what is missing. */
  completeness: "full" | "partial" | "link-only";
  notice: string | null;
}

export function detectPlatform(url: string): RecipeSource {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "other";
  }
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.endsWith("tiktok.com")) return "tiktok";
  if (host.endsWith("youtube.com") || host === "youtu.be") return "youtube";
  if (host.endsWith("facebook.com") || host === "fb.watch") return "facebook";
  return "website";
}

/** ISO-8601 duration ("PT1H20M") → minutes. */
export function isoDurationMinutes(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = v.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!m) return null;
  const minutes = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Math.round(Number(m[4] ?? 0) / 60);
  return minutes > 0 ? minutes : null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z#0-9]+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? m);
}

function clean(s: unknown, max = 3000): string | null {
  if (typeof s !== "string") return null;
  const t = decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

function firstImage(v: unknown): string | null {
  const pick = (x: unknown): string | null => {
    if (typeof x === "string") return x;
    if (x && typeof x === "object" && "url" in x && typeof (x as { url: unknown }).url === "string") return (x as { url: string }).url;
    return null;
  };
  const url = Array.isArray(v) ? v.map(pick).find(Boolean) ?? null : pick(v);
  return url && /^https:\/\//i.test(url) ? url.slice(0, 2000) : null;
}

function servingsOf(v: unknown): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  const n = typeof s === "number" ? s : typeof s === "string" ? Number(s.match(/\d+(?:\.\d+)?/)?.[0]) : NaN;
  return Number.isFinite(n) && n > 0 && n < 1000 ? n : null;
}

function stepsOf(v: unknown): string[] {
  const out: string[] = [];
  const walk = (x: unknown) => {
    if (!x) return;
    if (typeof x === "string") {
      for (const line of x.split(/\r?\n|(?<=\.)\s+(?=\d+\.)/)) {
        const c = clean(line);
        if (c) out.push(c.replace(/^\d+[.)]\s*/, ""));
      }
      return;
    }
    if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x === "object") {
      const o = x as Record<string, unknown>;
      if (o.itemListElement) return walk(o.itemListElement);
      const t = clean(o.text ?? o.name);
      if (t) out.push(t);
    }
  };
  walk(v);
  return out.slice(0, 100);
}

function findRecipeNode(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findRecipeNode(n);
      if (hit) return hit;
    }
    return null;
  }
  const o = node as Record<string, unknown>;
  const type = o["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) return o;
  if (o["@graph"]) return findRecipeNode(o["@graph"]);
  if (o.mainEntity) return findRecipeNode(o.mainEntity);
  return null;
}

function metaContent(html: string, key: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? clean(content) : null;
}

export function parseRecipeHtml(html: string, sourceUrl: string): RecipeDraft {
  const platform = detectPlatform(sourceUrl);
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  for (const raw of scripts) {
    let json: unknown;
    try {
      json = JSON.parse(raw.trim());
    } catch {
      continue;
    }
    const r = findRecipeNode(json);
    if (!r) continue;
    const ingredients = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : [])
      .map((x) => (typeof x === "string" ? parseIngredientLine(decodeEntities(x)) : null))
      .filter((x): x is IngredientNeed => !!x)
      .slice(0, 150);
    const steps = stepsOf(r.recipeInstructions);
    return {
      title: clean(r.name, 200) ?? metaContent(html, "og:title") ?? "מתכון",
      description: clean(r.description),
      image_url: firstImage(r.image) ?? (metaContent(html, "og:image")?.startsWith("https://") ? metaContent(html, "og:image") : null),
      source_url: sourceUrl,
      source_platform: platform,
      prep_minutes: isoDurationMinutes(r.prepTime),
      cook_minutes: isoDurationMinutes(r.cookTime),
      servings: servingsOf(r.recipeYield),
      ingredients,
      steps,
      completeness: ingredients.length && steps.length ? "full" : "partial",
      notice: ingredients.length && steps.length ? null : "חלק מהפרטים לא נמצאו בעמוד. השלימו אותם לפני השמירה.",
    };
  }

  const title = metaContent(html, "og:title") ?? clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 200);
  const image = metaContent(html, "og:image");
  return {
    title: title ?? "מתכון מקישור",
    description: metaContent(html, "og:description") ?? metaContent(html, "description"),
    image_url: image && image.startsWith("https://") ? image : null,
    source_url: sourceUrl,
    source_platform: platform,
    prep_minutes: null,
    cook_minutes: null,
    servings: null,
    ingredients: [],
    steps: [],
    completeness: title ? "partial" : "link-only",
    notice: "לא נמצא מתכון מובנה בעמוד. שמרנו את הקישור והתיאור; הוסיפו מצרכים והוראות בעצמכם.",
  };
}

/** Video platforms: caption text often contains the ingredient list. */
export function draftFromCaption(caption: string, sourceUrl: string, title: string | null, image: string | null): RecipeDraft {
  const lines = caption.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const ingredients = lines
    .filter((l) => /^[•\-*·]|\d/.test(l) && l.length < 120)
    .map(parseIngredientLine)
    .filter((x): x is IngredientNeed => !!x && x.quantity != null)
    .slice(0, 60);
  return {
    title: (title ?? lines[0] ?? "מתכון מסרטון").slice(0, 200),
    description: caption.slice(0, 3000) || null,
    image_url: image && image.startsWith("https://") ? image : null,
    source_url: sourceUrl,
    source_platform: detectPlatform(sourceUrl),
    prep_minutes: null,
    cook_minutes: null,
    servings: null,
    ingredients,
    steps: [],
    completeness: ingredients.length ? "partial" : "link-only",
    notice: ingredients.length
      ? "זיהינו מצרכים מתוך תיאור הסרטון. בדקו אותם והוסיפו הוראות הכנה."
      : "מהסרטון אפשר לשמור רק את הקישור והתיאור. הוסיפו מצרכים והוראות בעצמכם.",
  };
}
