"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChefHat, ChevronLeft, Clock, Heart, Plus, Search } from "lucide-react";
import type { Recipe } from "@/lib/types";
import { primeSignedUrls } from "@/lib/media";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/card";
import { FilterPills } from "@/components/ui/panel";
import { SignedImage } from "@/components/media/signed-image";
import { Emoji3D } from "@/components/ui/emoji-3d";

export interface RecipeCardData extends Recipe {
  readiness: { missing: number; unclear: number; total: number };
}

const DISH_EMOJI: [RegExp, string][] = [
  [/פסטה|ספגטי|לזניה|ניוקי/, "🍝"],
  [/עוגה|עוגת|עוגיות|בראוניז|מאפין/, "🍰"],
  [/שקשוקה|ביצ|חביתה|פריטטה/, "🍳"],
  [/סלט/, "🥗"],
  [/מרק/, "🍲"],
  [/עוף|שניצל|כרעיים/, "🍗"],
  [/דג|סלמון|טונה/, "🐟"],
  [/פיצה/, "🍕"],
  [/לחם|חלה|פוקאצ/, "🥖"],
  [/אורז|ריזוטו|מג׳דרה|מג'דרה/, "🍚"],
  [/בשר|קציצ|המבורגר|סטייק/, "🥩"],
  [/פנקייק|קרפ|וופל/, "🥞"],
];

export function dishEmoji(title: string): string {
  return DISH_EMOJI.find(([re]) => re.test(title))?.[1] ?? "🍲";
}

function dishHue(title: string): number {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return [30, 55, 15, 140, 330, 75][h % 6];
}

export function RecipeImage({ r, className }: { r: Pick<Recipe, "title" | "image_path" | "image_url">; className?: string }) {
  if (r.image_path) return <SignedImage path={r.image_path} alt={r.title} className={className} />;
  if (r.image_url)
    // eslint-disable-next-line @next/next/no-img-element -- remote image from the recipe's own source
    return <img src={r.image_url} alt={r.title} loading="lazy" referrerPolicy="no-referrer" className={cn("object-cover", className)} />;
  const h = dishHue(r.title);
  return (
    <span
      aria-hidden
      className={cn("grid place-items-center text-[44px]", className)}
      style={{ background: `linear-gradient(150deg, oklch(var(--tile-l) 0.06 ${h}), oklch(calc(var(--tile-l) - 0.06) 0.08 ${h + 25}))` }}
    >
      <Emoji3D emoji={dishEmoji(r.title)} className="size-[58%] max-h-28 max-w-28" />
    </span>
  );
}

const hasPhoto = (r: Pick<Recipe, "image_path" | "image_url">) => !!(r.image_path || r.image_url);
const totalMinutes = (r: Recipe) => (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
const isReady = (r: RecipeCardData) => r.readiness.total > 0 && r.readiness.missing === 0;

function readyText(r: RecipeCardData["readiness"]): string | null {
  if (!r.total) return null;
  if (r.missing === 0 && r.unclear === 0) return "יש הכל בבית";
  if (r.missing === 0) return "כמעט הכל";
  return r.missing === 1 ? "חסר מצרך אחד" : `חסרים ${r.missing}`;
}

type Filter = "all" | "favorites" | "ready" | string;

export interface WeekDay {
  date: string;
  label: string;
  planned: number;
  isToday: boolean;
}

export function RecipesView({ recipes, signedUrls, week }: { recipes: RecipeCardData[]; signedUrls: Record<string, string>; week?: WeekDay[] }) {
  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  // Deep links such as /recipes?filter=favorites (from the meal planner).
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filter");
    if (f === "favorites" || f === "ready") setFilter(f);
  }, []);

  const categories = useMemo(() => [...new Set(recipes.map((r) => r.category).filter((c): c is string => !!c))], [recipes]);
  const ready = recipes.filter(isReady);
  const featured = useMemo(
    () => recipes.find((r) => isReady(r) && r.is_favorite) ?? ready[0] ?? recipes.find((r) => r.is_favorite) ?? recipes[0] ?? null,
    [recipes, ready],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (filter === "favorites" && !r.is_favorite) return false;
      if (filter === "ready" && !isReady(r)) return false;
      if (filter.startsWith("cat:") && r.category !== filter.slice(4)) return false;
      return !q || [r.title, r.description, r.category, ...r.tags].some((f) => f?.toLowerCase().includes(q));
    });
  }, [recipes, filter, query]);

  return (
    <>
      <PageHeader
        title="מתכונים"
        subtitle={recipes.length ? `${recipes.length} מתכונים בספר המשותף` : "ספר המתכונים המשותף"}
        actions={
          <Link href="/recipes/new" className="pressable flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-[15px] font-semibold text-primary-foreground">
            <Plus className="size-4" strokeWidth={2.75} /> מתכון
          </Link>
        }
      />

      {recipes.length === 0 ? (
        <div className="card overflow-hidden">
          <div className="flex justify-center gap-4 bg-[linear-gradient(160deg,var(--honey-soft),var(--terracotta-soft))] py-10 text-[48px]" aria-hidden>
            <span>🍝</span>
            <span>🥗</span>
            <span>🍰</span>
          </div>
          <div className="space-y-3 p-5 text-center">
            <h2 className="title-2">ספר המתכונים של הבית</h2>
            <p className="text-[15px] text-muted">הדביקו קישור ממתכון באתר, ב-TikTok או באינסטגרם — HomeOS ישלוף מצרכים ושלבים, ויגיד מה כבר יש לכם בבית.</p>
            <Link href="/recipes/new" className="pressable inline-flex h-12 items-center rounded-2xl bg-primary px-6 font-semibold text-primary-foreground">
              המתכון הראשון
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-7">
          {/* Tonight */}
          {featured && (
            <Link href={`/recipes/${featured.id}`} className="pressable relative block overflow-hidden rounded-[1.75rem] shadow-[var(--card-shadow)]">
              <RecipeImage r={featured} className="aspect-[16/11] w-full text-[88px]" />
              <div className={cn("absolute inset-0 bg-gradient-to-t to-transparent", hasPhoto(featured) ? "from-black/75 via-black/15" : "from-black/45 via-transparent")} />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <span className="mb-2 inline-flex h-7 items-center rounded-full bg-white/20 px-3 text-[13px] font-semibold backdrop-blur-md">
                  {isReady(featured) ? "✨ אפשר להכין הערב" : featured.is_favorite ? "❤️ האהוב עליכם" : "🍽️ מה מבשלים?"}
                </span>
                <h2 className="text-[28px] leading-tight font-bold [font-family:var(--font-display)] [text-shadow:0_2px_12px_rgba(0,0,0,0.35)]">{featured.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-white/90">
                  {totalMinutes(featured) > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-4" /> <span className="num">{totalMinutes(featured)}</span> דק׳
                    </span>
                  )}
                  {readyText(featured.readiness) && <span>· {readyText(featured.readiness)}</span>}
                </div>
              </div>
            </Link>
          )}

          {/* This week */}
          <Link href="/meals" className="card pressable block p-4">
            <div className="mb-3 flex items-center justify-between">
              <span>
                <span className="headline block">התפריט השבועי</span>
                <span className="footnote block text-muted">מה שחסר למתכונים עובר לקניות בלחיצה</span>
              </span>
              <ChevronLeft className="size-5 text-muted-2" />
            </div>
            <div className="grid grid-cols-7 gap-1">
              {(week ?? []).map((d) => (
                <span key={d.date} className="flex flex-col items-center gap-1.5">
                  <span className={cn("text-[12px] font-semibold", d.isToday ? "text-primary" : "text-muted")}>{d.label}</span>
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-full text-[16px]",
                      d.planned ? "bg-terracotta-soft" : "bg-fill",
                      d.isToday && "ring-2 ring-primary ring-offset-2 ring-offset-surface",
                    )}
                    aria-label={d.planned ? `${d.label}: ${d.planned} ארוחות` : `${d.label}: לא מתוכנן`}
                  >
                    {d.planned ? "🍽️" : <span className="text-muted-2">+</span>}
                  </span>
                </span>
              ))}
            </div>
          </Link>

          {/* Ready now */}
          {ready.length > 1 && (
            <section>
              <h2 className="mb-2.5 px-1 text-[19px] font-semibold [font-family:var(--font-display)]">יש הכל בבית ✨</h2>
              <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
                {ready.map((r) => (
                  <Link key={r.id} href={`/recipes/${r.id}`} className="pressable w-[150px] shrink-0">
                    <RecipeImage r={r} className="aspect-square w-full rounded-[1.25rem] text-[48px]" />
                    <span className="mt-1.5 block truncate px-0.5 text-[15px] font-semibold">{r.title}</span>
                    {totalMinutes(r) > 0 && (
                      <span className="footnote block px-0.5 text-muted">
                        <span className="num">{totalMinutes(r)}</span> דק׳
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* The book */}
          <section className="space-y-3">
            <h2 className="px-1 text-[19px] font-semibold [font-family:var(--font-display)]">כל המתכונים</h2>
            <label className="card flex h-12 items-center gap-2 px-4">
              <Search className="size-[18px] text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="מתכון, מצרך או תגית…"
                aria-label="חיפוש מתכון"
                className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-2"
              />
            </label>
            <FilterPills
              label="סינון"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "הכל", count: recipes.length },
                { value: "ready", label: "אפשר להכין", count: ready.length },
                { value: "favorites", label: "❤️ מועדפים", count: recipes.filter((r) => r.is_favorite).length },
                ...categories.map((c) => ({ value: `cat:${c}`, label: c })),
              ]}
            />
            {filtered.length === 0 ? (
              <EmptyState icon={<ChefHat />} title="אין תוצאות" description="נסו חיפוש אחר." />
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-3">
                {filtered.map((r) => (
                  <Link key={r.id} href={`/recipes/${r.id}`} className="pressable relative block overflow-hidden rounded-[1.5rem] shadow-[var(--card-shadow)]">
                    <RecipeImage r={r} className="aspect-[4/5] w-full text-[56px]" />
                    <div className={cn("absolute inset-0 bg-gradient-to-t to-transparent", hasPhoto(r) ? "from-black/70 via-black/5" : "from-black/45 via-transparent")} />
                    {r.is_favorite && (
                      <span className="absolute end-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-white/85 backdrop-blur-md">
                        <Heart className="size-4 fill-danger text-danger" />
                      </span>
                    )}
                    {isReady(r) && <span className="absolute start-2.5 top-2.5 rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-bold text-sage backdrop-blur-md">יש הכל</span>}
                    <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                      <p className="line-clamp-2 text-[16px] leading-snug font-semibold [text-shadow:0_1px_8px_rgba(0,0,0,0.4)]">{r.title}</p>
                      <p className="mt-0.5 text-[12px] text-white/85">
                        {[totalMinutes(r) > 0 ? `${totalMinutes(r)} דק׳` : null, !isReady(r) ? readyText(r.readiness) : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
