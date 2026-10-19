"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import type { Brief, BriefInsight } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { resolveAlert } from "@/server/actions/alerts";
import type { SetupStep } from "./types";

/**
 * The day at a glance: one sentence, then up to three things worth doing, each
 * with a real action. Built from the household's data only — on a quiet day it
 * says so instead of filling the space.
 */
export function BriefCard({ brief, chips, more = 0, preview }: { brief: Brief; chips: { key: string; text: string; href: string }[]; more?: number; preview?: boolean }) {
  const router = useRouter();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const insights = brief.insights.filter((x) => !gone.has(x.key));

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
    <section aria-label="התדריך של היום" className="brief-surface p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-full bg-[linear-gradient(140deg,var(--accent),var(--teal))] text-white shadow-sm">
          <Sparkles className="size-3.5" strokeWidth={2.5} />
        </span>
        <span className="eyebrow">התדריך של היום</span>
      </div>
      <p className="text-[21px] leading-snug font-semibold text-balance [font-family:var(--font-display)]">
        {insights.length || !brief.insights.length ? brief.headline : "טיפלתם בהכל. יום רגוע ☕"}
      </p>

      {insights.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {insights.map((x) => (
            <li key={x.key} className={cn("brief-row flex items-center gap-3 p-2 ps-2.5 transition-opacity", busy === x.key && "opacity-60")}>
              <span aria-hidden className="cat-tint grid size-9 shrink-0 place-items-center rounded-xl text-[18px]" style={{ "--h": x.hue } as React.CSSProperties}>
                {x.emoji}
              </span>
              <Link href={x.href} className="min-w-0 flex-1 active:opacity-60">
                <span className="block truncate text-[15px] font-semibold">{x.text}</span>
                {x.detail && <span className="block truncate text-[12px] text-muted">{x.detail}</span>}
              </Link>
              {x.action ? (
                <button
                  type="button"
                  disabled={busy === x.key}
                  onClick={() => act(x)}
                  className="pressable flex h-8 shrink-0 items-center rounded-full bg-primary px-3 text-[13px] font-semibold text-primary-foreground"
                >
                  {busy === x.key ? <Loader2 className="size-4 animate-spin" /> : x.action.label}
                </button>
              ) : x.cta ? (
                <Link href={x.href} className="pressable flex h-8 shrink-0 items-center rounded-full bg-primary-soft px-3 text-[13px] font-semibold text-primary">
                  {x.cta}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {insights.length > 0 && more > 0 && (
        <Link href="#attention" className="mt-2 flex items-center gap-1 px-1 text-[13px] font-semibold text-primary">
          ועוד {more} ב״דורש טיפול״ <ChevronLeft className="size-4" />
        </Link>
      )}

      {chips.length > 0 && (
        <div className="scrollbar-none -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4">
          {chips.map((c) => (
            <Link key={c.key} href={c.href} className="pressable flex h-8 shrink-0 items-center rounded-full bg-fill px-3 text-[13px] font-medium">
              {c.text}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

const STARTERS = [
  { key: "grocery", emoji: "🛒", hue: 75, title: "רשימת קניות משותפת", text: "מה חסר? מתחילים כאן", href: "/shopping" },
  { key: "inventory", emoji: "📦", hue: 55, title: "מה יש בבית", text: "המלאי מזמין לבד מה שנגמר", href: "/inventory/setup" },
  { key: "chores", emoji: "🧺", hue: 150, title: "משימות קבועות", text: "מי עושה מה, ומתי", href: "/chores?new=1" },
  { key: "recipes", emoji: "🍳", hue: 30, title: "מתכון ראשון", text: "מקישור לאינסטגרם או מצילום", href: "/recipes/new" },
] as const;

/** A brand-new household: four doors into the app instead of empty widgets. */
export function StarterCard({ householdName, setup, isAlone, onDismiss }: { householdName: string; setup: SetupStep[]; isAlone: boolean; onDismiss: () => void }) {
  const done = new Set(setup.filter((s) => s.done).map((s) => s.key));
  return (
    <section aria-label="מתחילים" className="brief-surface p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-full bg-[linear-gradient(140deg,var(--accent),var(--teal))] text-white shadow-sm">
          <Sparkles className="size-3.5" strokeWidth={2.5} />
        </span>
        <span className="eyebrow flex-1">{householdName}</span>
        <button type="button" onClick={onDismiss} className="grid size-8 place-items-center rounded-full text-muted active:bg-fill" aria-label="הסתרה">
          <X className="size-4" />
        </button>
      </div>
      <p className="text-[21px] leading-snug font-semibold [font-family:var(--font-display)]">הבית מוכן. מאיפה מתחילים?</p>
      <p className="footnote mt-0.5 text-muted">כל צעד לוקח דקה, וכל אחד מכם יכול להתחיל ממה שנוח לו.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {STARTERS.map((s) => (
          <Link key={s.key} href={s.href} className={cn("brief-row pressable flex flex-col gap-2 p-3", done.has(s.key) && "opacity-55")}>
            <span aria-hidden className="cat-tint grid size-9 place-items-center rounded-xl text-[18px]" style={{ "--h": s.hue } as React.CSSProperties}>
              {done.has(s.key) ? "✓" : s.emoji}
            </span>
            <span>
              <span className="block text-[14px] leading-tight font-semibold">{s.title}</span>
              <span className="mt-0.5 block text-[12px] leading-tight text-muted">{s.text}</span>
            </span>
          </Link>
        ))}
      </div>
      {isAlone && (
        <Link href="/household/settings" className="mt-2 flex items-center gap-2 rounded-2xl px-1 py-2 text-[14px] font-semibold text-primary">
          💌 להזמין את בן/בת הזוג לבית
          <ChevronLeft className="ms-auto size-4" />
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
