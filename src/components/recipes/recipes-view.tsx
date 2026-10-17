"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChefHat, Clock, Heart, Plus } from "lucide-react";
import type { Recipe } from "@/lib/types";
import { primeSignedUrls } from "@/lib/media";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, EmptyState } from "@/components/ui/card";
import { FilterPills, SearchField } from "@/components/ui/panel";
import { SignedImage } from "@/components/media/signed-image";

export interface RecipeCardData extends Recipe {
  readiness: { missing: number; unclear: number; total: number };
}

export function RecipeImage({ r, className }: { r: Pick<Recipe, "title" | "image_path" | "image_url">; className?: string }) {
  if (r.image_path) return <SignedImage path={r.image_path} alt={r.title} className={className} />;
  if (r.image_url)
    // eslint-disable-next-line @next/next/no-img-element -- remote image from the recipe's own source
    return <img src={r.image_url} alt={r.title} loading="lazy" referrerPolicy="no-referrer" className={cn("object-cover", className)} />;
  return (
    <span aria-hidden className={cn("cat-tint grid place-items-center text-[40px]", className)} style={{ "--h": 55 } as React.CSSProperties}>
      🍲
    </span>
  );
}

function ReadyBadge({ r }: { r: RecipeCardData["readiness"] }) {
  if (!r.total) return null;
  if (r.missing === 0 && r.unclear === 0) return <Badge tone="sage">יש הכל</Badge>;
  if (r.missing === 0) return <Badge tone="amber">כמעט הכל</Badge>;
  return <Badge>{r.missing === 1 ? "חסר מצרך" : `חסרים ${r.missing}`}</Badge>;
}

type Filter = "all" | "favorites" | "ready" | string;

export function RecipesView({ recipes, signedUrls }: { recipes: RecipeCardData[]; signedUrls: Record<string, string> }) {
  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const categories = useMemo(() => [...new Set(recipes.map((r) => r.category).filter((c): c is string => !!c))], [recipes]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (filter === "favorites" && !r.is_favorite) return false;
      if (filter === "ready" && !(r.readiness.total && r.readiness.missing === 0)) return false;
      if (filter.startsWith("cat:") && r.category !== filter.slice(4)) return false;
      return !q || [r.title, r.description, r.category, ...r.tags].some((f) => f?.toLowerCase().includes(q));
    });
  }, [recipes, filter, query]);
  const readyCount = recipes.filter((r) => r.readiness.total && r.readiness.missing === 0).length;

  return (
    <>
      <PageHeader
        title="מתכונים"
        subtitle={recipes.length ? `${recipes.length} מתכונים${readyCount ? ` · ${readyCount} אפשר להכין עכשיו` : ""}` : "ספר המתכונים המשותף"}
        actions={
          <Link href="/recipes/new" className="pressable flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[15px] font-semibold text-primary-foreground">
            <Plus className="size-4" /> מתכון
          </Link>
        }
      />
      <Link href="/meals" className="pressable mb-4 flex items-center justify-between rounded-[var(--radius)] border border-border bg-surface p-4">
        <span className="flex items-center gap-3">
          <span className="cat-tint grid size-11 place-items-center rounded-[14px]" style={{ "--h": 140 } as React.CSSProperties}>
            <CalendarDays className="size-5 cat-ink" />
          </span>
          <span>
            <span className="headline block">תכנון ארוחות לשבוע</span>
            <span className="footnote block text-muted">מה אוכלים, ומה חסר לזה בבית</span>
          </span>
        </span>
        <span className="text-muted-2">‹</span>
      </Link>

      {recipes.length > 0 && (
        <div className="mb-4 flex flex-col gap-3">
          <SearchField value={query} onChange={setQuery} placeholder="חיפוש מתכון, מצרך או תגית…" />
          <FilterPills
            label="סינון"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "הכל", count: recipes.length },
              { value: "ready", label: "אפשר להכין עכשיו", count: readyCount },
              { value: "favorites", label: "מועדפים", count: recipes.filter((r) => r.is_favorite).length },
              ...categories.map((c) => ({ value: `cat:${c}`, label: c })),
            ]}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ChefHat />}
          title={recipes.length ? "אין תוצאות" : "עוד אין מתכונים"}
          description={recipes.length ? "נסו חיפוש אחר." : "הדביקו קישור ממתכון באתר, ב-TikTok או באינסטגרם, או כתבו מתכון משלכם."}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((r) => (
            <Link key={r.id} href={`/recipes/${r.id}`} className="pressable overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
              <div className="relative">
                <RecipeImage r={r} className="aspect-[4/3] w-full" />
                {r.is_favorite && (
                  <span className="absolute end-2 top-2 grid size-7 place-items-center rounded-full bg-surface/90">
                    <Heart className="size-4 fill-danger text-danger" />
                  </span>
                )}
              </div>
              <div className="space-y-1.5 p-3">
                <p className="line-clamp-2 font-semibold leading-snug">{r.title}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(r.prep_minutes || r.cook_minutes) && (
                    <span className="footnote flex items-center gap-1 text-muted">
                      <Clock className="size-3.5" />
                      <span className="num">{(r.prep_minutes ?? 0) + (r.cook_minutes ?? 0)}</span> דק׳
                    </span>
                  )}
                  <ReadyBadge r={r.readiness} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
