"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChefHat, ChevronLeft, ListChecks, Loader2, Moon, Package, ShoppingBasket, Sparkles, Sun, Sunrise, Sunset, UserPlus, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import type { Brief, BriefInsight } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { resolveAlert } from "@/server/actions/alerts";
import type { SetupStep } from "./types";

export interface BriefChip {
  key: string;
  icon: LucideIcon;
  text: string;
  href: string;
}

/** Time-of-day glyph for the hero, from the greeting already computed in the household's timezone. */
function periodIcon(greeting: string): LucideIcon {
  if (greeting.includes("בוקר")) return Sunrise;
  if (greeting.includes("צהריים")) return Sun;
  if (greeting.includes("ערב")) return Sunset;
  return Moon;
}

/**
 * The day at a glance, on the screen's one dark surface: a sentence, then up to
 * three things worth doing, each with a real action. Built from the household's
 * data only — on a quiet day it says so instead of filling the space.
 */
export function BriefCard({ brief, chips, more = 0, greeting, preview }: { brief: Brief; chips: BriefChip[]; more?: number; greeting: string; preview?: boolean }) {
  const router = useRouter();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const insights = brief.insights.filter((x) => !gone.has(x.key));
  const Period = periodIcon(greeting);
  const allHandled = brief.insights.length > 0 && !insights.length;

  async function act(x: BriefInsight) {
    if (!x.action) return;
    if (preview) return void setGone((s) => new Set(s).add(x.key));
    setBusy(x.key);
    const res = await resolveAlert({ type: x.action.type, id: x.action.id });
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    setGone((s) => new Set(s).add(x.key));
    toast.success(res.data.message);
    router.refresh();
  }

  return (
    <section aria-label="התדריך של היום" className="hero p-5">
      <div className="flex items-center gap-2">
        <span className="hero-chip flex h-7 items-center gap-1.5 rounded-full ps-2 pe-2.5 text-[12px] font-semibold">
          <Period className="size-3.5 text-[var(--accent-glow)]" strokeWidth={2.5} />
          התדריך של היום
        </span>
      </div>

      <p className="mt-3 text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] text-balance [font-family:var(--font-display)]">
        {allHandled ? "טיפלתם בהכל. יום רגוע." : brief.headline}
      </p>
      {!brief.insights.length && <p className="hero-muted mt-1.5 text-[14px]">אין חוסרים במלאי, משימות באיחור או תשלומים קרובים.</p>}

      {insights.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {insights.map((x) => (
            <li key={x.key} className={cn("hero-row flex items-center gap-3 p-2 ps-2.5 transition-opacity", busy === x.key && "opacity-50")}>
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/8 text-[17px]">
                {x.emoji}
              </span>
              <Link href={x.href} className="min-w-0 flex-1 active:opacity-60">
                <span className="line-clamp-2 block text-[15px] leading-snug font-semibold">{x.text}</span>
                {x.detail && <span className="hero-muted block truncate text-[12px]">{x.detail}</span>}
              </Link>
              {x.action ? (
                <button
                  type="button"
                  disabled={busy === x.key}
                  onClick={() => act(x)}
                  className="pressable flex h-8 min-w-14 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] px-3 text-[13px] font-bold text-[var(--accent-ink)]"
                >
                  {busy === x.key ? <Loader2 className="size-4 animate-spin" /> : x.action.label}
                </button>
              ) : x.cta ? (
                <Link href={x.href} className="hero-chip pressable flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-semibold">
                  {x.cta}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {insights.length > 0 && more > 0 && (
        <Link href="#attention" className="hero-muted mt-2.5 flex items-center gap-1 px-1 text-[13px] font-medium">
          ועוד {more} דברים ב״דורש טיפול״ <ChevronLeft className="size-4" />
        </Link>
      )}

      {chips.length > 0 && (
        <div className="scrollbar-none -mx-5 mt-4 flex gap-1.5 overflow-x-auto px-5">
          {chips.map((c) => (
            <Link key={c.key} href={c.href} className="hero-chip pressable flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium">
              <c.icon className="size-3.5 opacity-70" />
              {c.text}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

const STARTERS: { key: string; icon: LucideIcon; title: string; text: string; href: string }[] = [
  { key: "grocery", icon: ShoppingBasket, title: "רשימת קניות", text: "משותפת, בזמן אמת", href: "/shopping" },
  { key: "inventory", icon: Package, title: "מה יש בבית", text: "מה שנגמר — נכנס לרשימה", href: "/inventory/setup" },
  { key: "chores", icon: ListChecks, title: "משימות קבועות", text: "מי עושה מה, ומתי", href: "/chores?new=1" },
  { key: "recipes", icon: ChefHat, title: "מתכון ראשון", text: "מאינסטגרם, אתר או צילום", href: "/recipes/new" },
];

/** A brand-new household: four doors into the app instead of empty widgets. */
export function StarterCard({ householdName, setup, isAlone, onDismiss }: { householdName: string; setup: SetupStep[]; isAlone: boolean; onDismiss: () => void }) {
  const done = new Set(setup.filter((s) => s.done).map((s) => s.key));
  return (
    <section aria-label="מתחילים" className="hero p-5">
      <div className="flex items-center gap-2">
        <span className="hero-chip flex h-7 items-center gap-1.5 rounded-full ps-2 pe-2.5 text-[12px] font-semibold">
          <Sparkles className="size-3.5 text-[var(--accent-glow)]" strokeWidth={2.5} />
          {householdName}
        </span>
        <span className="flex-1" />
        <button type="button" onClick={onDismiss} className="hero-muted grid size-8 place-items-center rounded-full active:bg-white/10" aria-label="הסתרה">
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-3 text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] [font-family:var(--font-display)]">הבית מוכן. מאיפה מתחילים?</p>
      <p className="hero-muted mt-1 text-[14px]">כל צעד לוקח דקה. אפשר להתחיל מכל אחד.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {STARTERS.map((s) => {
          const isDone = done.has(s.key);
          return (
            <Link key={s.key} href={s.href} className={cn("hero-row pressable flex flex-col gap-3 p-3", isDone && "opacity-50")}>
              <span aria-hidden className={cn("grid size-9 place-items-center rounded-xl", isDone ? "bg-white/10" : "bg-[var(--accent)] text-[var(--accent-ink)]")}>
                {isDone ? <Check className="size-[18px]" strokeWidth={2.75} /> : <s.icon className="size-[18px]" strokeWidth={2.25} />}
              </span>
              <span>
                <span className="block text-[14px] leading-tight font-semibold">{s.title}</span>
                <span className="hero-muted mt-0.5 block text-[12px] leading-tight">{s.text}</span>
              </span>
            </Link>
          );
        })}
      </div>
      {isAlone && (
        <Link href="/household/settings" className="hero-row pressable mt-2 flex items-center gap-3 p-3 text-[14px] font-semibold">
          <UserPlus className="size-[18px] text-[var(--accent-glow)]" />
          להזמין את בן/בת הזוג לבית
          <ChevronLeft className="hero-muted ms-auto size-4" />
        </Link>
      )}
    </section>
  );
}

/** Partially set up: one slim, dismissible line pointing at the next step. */
export function SetupStrip({ setup, onDismiss }: { setup: SetupStep[]; onDismiss: () => void }) {
  const left = setup.filter((s) => !s.done);
  if (!left.length) return null;
  const done = setup.length - left.length;
  const pct = (done / setup.length) * 100;
  return (
    <div className="widget flex items-center gap-3 p-2.5 ps-3">
      <span className="relative grid size-10 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--primary) ${pct}%, var(--fill-strong) 0)` }} aria-hidden>
        <span className="num grid size-8 place-items-center rounded-full bg-surface text-[11px] font-bold">
          {done}/{setup.length}
        </span>
      </span>
      <Link href={left[0].href} className="min-w-0 flex-1 active:opacity-60">
        <span className="eyebrow block">הצעד הבא בהקמת הבית</span>
        <span className="block truncate text-[15px] font-semibold">{left[0].label}</span>
      </Link>
      <button type="button" onClick={onDismiss} className="grid size-8 shrink-0 place-items-center rounded-full text-muted active:bg-fill" aria-label="הסתרה">
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Per-device "don't show again" for onboarding helpers. Starts hidden to avoid a flash. */
export function useDismissed(key: string): [boolean, () => void] {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key]);
  return [
    hidden,
    () => {
      setHidden(true);
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* private mode: hidden for this visit only */
      }
    },
  ];
}
