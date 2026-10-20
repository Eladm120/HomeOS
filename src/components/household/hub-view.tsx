"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronLeft, ListChecks, Plus, Search, ShoppingCart, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel, PanelRow } from "@/components/ui/panel";
import { Emoji3D } from "@/components/ui/emoji-3d";
import { QuickCreateSheet } from "@/components/layout/quick-create";
import { HUB_GROUPS, HUB_SETTINGS, type HubGroup, type HubLink } from "@/components/layout/hub-sections";
import { HomeHero } from "@/components/dashboard/home-hero";
import type { DayPeriod } from "@/components/dashboard/house-scene";
import { Avatar } from "@/components/dashboard/widgets";

export interface HubCounts {
  inventory: number;
  low: number;
  choresToday: number;
  choresTotal: number;
  meals: number;
  appliances: number;
  plants: number;
  bills: number;
  documents: number;
  devices: number;
  projects: number;
  purchases: number;
  /** Pending items on the shopping list. */
  grocery?: number;
  /** Meals planned for today. */
  mealsToday?: number;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

/** The number on a tile's corner: only things worth a look. */
function badgeFor(href: string, c: HubCounts, alerts: number): number {
  switch (href) {
    case "/chores":
      return c.choresToday;
    case "/inventory":
      return c.low;
    case "/meals":
      return c.meals;
    case "/notifications":
      return alerts;
    case "/bills":
      return c.bills;
    case "/projects":
      return c.projects;
    default:
      return 0;
  }
}

/** A short live line for the wider tiles and the "הצג הכל" rows. */
function lineFor(href: string, c: HubCounts, alerts: number): string {
  switch (href) {
    case "/inventory":
      return c.low ? `${c.low} נמוכים` : c.inventory ? `${c.inventory} מוצרים` : "מקרר, מזווה וארונות";
    case "/chores":
      return c.choresToday ? `${c.choresToday} להיום` : c.choresTotal ? "הכל בוצע היום" : "מי עושה מה, ומתי";
    case "/meals":
      return c.meals ? `${c.meals} ארוחות השבוע` : "מה אוכלים השבוע";
    case "/notifications":
      return alerts ? `${alerts} מחכים לך` : "הכל מטופל";
    case "/smart-home":
      return c.devices ? plural(c.devices, "מכשיר מחובר", "מכשירים מחוברים") : "מזגן, דוד ותאורה";
    case "/appliances":
      return c.appliances ? plural(c.appliances, "מכשיר אחד", "מכשירים") : "אחריות ותיקונים";
    case "/plants":
      return c.plants ? plural(c.plants, "צמח אחד", "צמחים") : "השקיה ותזכורות";
    case "/planner":
      return c.purchases ? plural(c.purchases, "פריט אחד", "פריטים") : "רהיטים ומכשירים";
    case "/documents":
      return c.documents ? plural(c.documents, "מסמך אחד", "מסמכים") : "ביטוחים וחוזים";
    case "/bills":
      return c.bills ? `${c.bills} לתשלום` : "חשמל, מים, ארנונה";
    case "/projects":
      return c.projects ? plural(c.projects, "פרויקט פעיל", "פרויקטים פעילים") : "תיקונים ושיפוצים";
    case "/expenses":
      return "שכירות וחיובים קבועים";
    default:
      return "";
  }
}

const tint = (hue: number) => ({ "--h": hue, background: `linear-gradient(160deg, oklch(calc(var(--tile-l) + 0.015) 0.025 ${hue}) 0%, oklch(calc(var(--tile-l) - 0.03) 0.05 ${hue}) 100%)` }) as React.CSSProperties;

/**
 * "משק הבית": a warm home for every module. A personal header, search with a
 * round "+", the house itself with today's numbers, then three illustrated
 * sections — everyday life, our home (a bento with smart home as the big
 * tile), and running the home. Each section shows three tiles and opens the
 * rest with "הצג הכל".
 */
export function HubView({
  counts,
  alerts,
  householdId,
  householdName,
  userName,
  coverPath = null,
  period = "day",
}: {
  counts: HubCounts;
  alerts: number;
  householdId: string;
  householdName: string;
  userName: string;
  coverPath?: string | null;
  period?: DayPeriod;
}) {
  const [create, setCreate] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const stats = [
    { key: "g", icon: ShoppingCart, value: counts.grocery ?? 0, label: "לקנייה", href: "/shopping" },
    { key: "t", icon: ListChecks, value: counts.choresToday, label: "משימות היום", href: "/chores" },
    { key: "m", icon: UtensilsCrossed, value: counts.mealsToday ?? 0, label: (counts.mealsToday ?? 0) === 1 ? "ארוחה היום" : "ארוחות היום", href: "/meals" },
  ];

  return (
    <div className="space-y-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-4 lg:pt-8">
      {/* Header: me · title · notifications */}
      <header className="flex items-center gap-3">
        <Link href="/household/settings" aria-label="הפרופיל והבית">
          <Avatar name={userName} index={0} className="size-12 text-[18px] shadow-[var(--card-shadow)] ring-[3px] ring-surface" />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.02em]">משק הבית</h1>
          <p className="truncate text-[14px] text-muted">כל מה שקשור לבית, מסודר במקום אחד</p>
        </div>
        <Link
          href="/notifications"
          aria-label={alerts ? `התראות, ${alerts} חדשות` : "התראות"}
          className="pressable relative grid size-12 shrink-0 place-items-center rounded-full bg-surface shadow-[var(--card-shadow)]"
        >
          <Bell className="size-[22px]" strokeWidth={1.9} />
          {alerts > 0 && <span className="absolute top-2.5 end-3 size-2.5 rounded-full bg-terracotta ring-2 ring-surface" />}
        </Link>
      </header>

      {/* Search + add */}
      <div className="flex items-center gap-3">
        <Link href="/search" className="flex h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-full bg-surface px-5 text-[16px] text-muted shadow-[var(--card-shadow)]">
          <Search className="size-5 shrink-0" />
          <span className="truncate">חיפוש בכל משק הבית...</span>
        </Link>
        <button
          type="button"
          onClick={() => setCreate(true)}
          aria-label="הוספה"
          className="pressable grid size-[52px] shrink-0 place-items-center rounded-full bg-[linear-gradient(160deg,color-mix(in_oklab,var(--accent)_80%,#fff),var(--accent))] text-primary-foreground shadow-[0_10px_22px_-10px_var(--accent)]"
        >
          <Plus className="size-7" strokeWidth={2.4} />
        </button>
      </div>

      <HomeHero householdId={householdId} householdName={householdName} coverPath={coverPath} canEdit={false} stats={stats} period={period} />

      {HUB_GROUPS.map((g) => (
        <HubSection key={g.id} group={g} counts={counts} alerts={alerts} open={!!open[g.id]} onToggle={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))} />
      ))}

      <section aria-labelledby="hub-settings">
        <h2 id="hub-settings" className="mb-2.5 px-1 text-[20px] font-extrabold">
          מערכת
        </h2>
        <Panel>
          {HUB_SETTINGS.map((l) => (
            <PanelRow
              key={l.href}
              href={l.href}
              leading={
                <span aria-hidden className="mod-chip grid size-9 shrink-0 place-items-center rounded-xl" style={{ "--h": l.hue } as React.CSSProperties}>
                  <l.icon className="size-[18px]" strokeWidth={2.1} />
                </span>
              }
              title={l.label}
            />
          ))}
        </Panel>
      </section>

      <QuickCreateSheet open={create} onOpenChange={setCreate} />
    </div>
  );
}

function HubSection({ group: g, counts, alerts, open, onToggle }: { group: HubGroup; counts: HubCounts; alerts: number; open: boolean; onToggle: () => void }) {
  const featured = g.links.slice(0, 3);
  const rest = g.links.slice(3);
  return (
    <section aria-labelledby={`hub-${g.id}`}>
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 id={`hub-${g.id}`} className="text-[21px] font-extrabold">
          {g.title}
        </h2>
        {rest.length > 0 && (
          <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-center gap-0.5 text-[14px] text-muted">
            {open ? "פחות" : "הצג הכל"}
            <ChevronLeft className={cn("size-4 transition-transform", open && "-rotate-90")} />
          </button>
        )}
      </div>

      {g.id === "home" ? (
        // Bento: two wide tiles on one side, the smart home as a tall feature tile on the other.
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-3">
            {featured.slice(1).map((l) => (
              <WideTile key={l.href} link={l} line={lineFor(l.href, counts, alerts)} />
            ))}
          </div>
          <FeatureTile link={featured[0]} line={lineFor(featured[0].href, counts, alerts)} />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {featured.map((l) => (
            <ArtTile key={l.href} link={l} badge={badgeFor(l.href, counts, alerts)} />
          ))}
        </div>
      )}

      {open && rest.length > 0 && (
        <div className="mt-3 space-y-2 animate-fade-up">
          {rest.map((l) => (
            <Link key={l.href} href={l.href} className="card pressable flex items-center gap-3 p-3 pe-4" style={{ "--h": l.hue } as React.CSSProperties}>
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl" style={tint(l.hue)}>
                <Emoji3D emoji={l.art} className="size-9" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold">{l.label}</span>
                <span className="block truncate text-[13px] text-muted">{lineFor(l.href, counts, alerts)}</span>
              </span>
              {badgeFor(l.href, counts, alerts) > 0 && <Badge hue={l.hue} n={badgeFor(l.href, counts, alerts)} />}
              <ChevronLeft className="size-5 text-muted-2" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Badge({ hue, n, className }: { hue: number; n: number; className?: string }) {
  return (
    <span
      className={cn("num grid size-8 shrink-0 place-items-center rounded-full text-[15px] font-bold text-white shadow-[0_4px_10px_-4px_rgba(0,0,0,0.35)]", className)}
      style={{ background: `oklch(0.62 0.16 ${hue})` }}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** Square tile: a big 3D picture on a soft halo, the module name, and a count in the corner. */
function ArtTile({ link: l, badge }: { link: HubLink; badge: number }) {
  return (
    <Link href={l.href} className="pressable relative flex aspect-[0.82] flex-col overflow-hidden rounded-[1.375rem] p-2.5 pb-3 shadow-[var(--card-shadow)]" style={tint(l.hue)}>
      {badge > 0 && <Badge hue={l.hue} n={badge} className="absolute top-2 end-2 z-10 size-7 text-[13px]" />}
      <span className="grid flex-1 place-items-center">
        <span className="grid size-[72px] place-items-center rounded-full" style={{ background: `oklch(calc(var(--tile-l) - 0.06) 0.06 ${l.hue} / 0.7)` }}>
          <Emoji3D emoji={l.art} className="size-[60px]" />
        </span>
      </span>
      <span className="flex items-end justify-between gap-0.5">
        <span className="text-[14px] leading-[1.15] font-bold">{l.label}</span>
        <ChevronLeft className="size-4 shrink-0 text-muted" />
      </span>
    </Link>
  );
}

/** Wide tile for the bento: name and chevron on one side, the picture on the other. */
function WideTile({ link: l, line }: { link: HubLink; line: string }) {
  return (
    <Link href={l.href} className="pressable relative flex h-[104px] items-center gap-2 overflow-hidden rounded-[1.375rem] ps-4 shadow-[var(--card-shadow)]" style={tint(l.hue)}>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[16px] font-bold">
          {l.label}
          <ChevronLeft className="size-4 text-muted" />
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-muted">{line}</span>
      </span>
      <Emoji3D emoji={l.art} className="-me-2 size-[84px] shrink-0" />
    </Link>
  );
}

/** The tall feature tile (smart home): a cozy corner with the bulb chip and the name. */
function FeatureTile({ link: l, line }: { link: HubLink; line: string }) {
  return (
    <Link href={l.href} className="pressable relative flex min-h-[220px] flex-col overflow-hidden rounded-[1.375rem] p-4 shadow-[var(--card-shadow)]" style={tint(l.hue)}>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/3" style={{ background: `radial-gradient(90% 80% at 30% 100%, oklch(calc(var(--tile-l) - 0.02) 0.06 70 / 0.9), transparent 70%)` }} />
      <span className="relative grid size-14 place-items-center rounded-full bg-surface/80 shadow-sm">
        <Emoji3D emoji={l.art} className="size-11" />
      </span>
      <span className="relative mt-2 flex items-center gap-1 text-[17px] font-bold">
        {l.label}
        <ChevronLeft className="size-4 text-muted" />
      </span>
      <span className="relative block text-[12px] text-muted">{line}</span>
      <Emoji3D emoji="🛋️" className="absolute -bottom-3 -start-3 size-[150px] opacity-95" />
    </Link>
  );
}
