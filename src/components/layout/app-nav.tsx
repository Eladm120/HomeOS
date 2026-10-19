"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";
import { HUB_GROUPS } from "./hub-sections";
import { QuickCreateSheet } from "./quick-create";

/**
 * Floating tab bar: a dark glass capsule where the active tab opens into an
 * accent pill (icon + label) and the others stay icon-only, plus a separate
 * round "+" that starts anything new. (The AI assistant is parked: its page
 * still works at /assistant once an API key is set, it just isn't on the bar.)
 */
export function BottomNav({ forcePath }: { forcePath?: string } = {}) {
  const routePath = usePathname();
  const pathname = forcePath ?? routePath;
  const [create, setCreate] = useState(false);
  if (pathname.startsWith("/shopping/mode")) return null;

  return (
    <nav aria-label="ניווט ראשי" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.6rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto flex max-w-md items-center gap-2.5">
        <ul className="glass pointer-events-auto flex h-[62px] flex-1 items-center justify-between rounded-full p-[7px]">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            return (
              <li key={item.href} className={cn("h-full transition-[flex-grow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]", active ? "grow-[2.2]" : "grow")}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  className={cn(
                    "flex h-full items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors duration-300 active:scale-95",
                    active ? "bg-primary px-3 text-primary-foreground shadow-[0_8px_20px_-10px_var(--accent)]" : "text-foreground/60",
                  )}
                >
                  <Icon className="size-[21px] shrink-0" strokeWidth={active ? 2.3 : 1.9} />
                  {active && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => setCreate(true)}
          aria-label="הוספה מהירה"
          className="pointer-events-auto grid size-[62px] shrink-0 place-items-center rounded-full bg-foreground text-background shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)] transition-transform active:scale-90"
        >
          <Plus className="size-7" strokeWidth={2.4} />
        </button>
      </div>
      <QuickCreateSheet open={create} onOpenChange={setCreate} />
    </nav>
  );
}

export function Sidebar({ householdName, forcePath }: { householdName: string; forcePath?: string }) {
  const routePath = usePathname();
  const pathname = forcePath ?? routePath;
  const [create, setCreate] = useState(false);
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 p-3 lg:block">
      <div className="glass flex h-full flex-col rounded-[2rem] px-3 py-5">
        <Link href="/" className="mb-5 flex items-center gap-3 px-2">
          <AppGlyph className="size-11" />
          <span className="min-w-0">
            <span className="headline block">HomeOS</span>
            <span className="footnote block truncate text-muted">{householdName}</span>
          </span>
        </Link>
        <button type="button" onClick={() => setCreate(true)} className="pressable mb-4 flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground">
          <Plus className="size-5" strokeWidth={2.4} /> הוספה
        </button>
        <nav aria-label="ניווט ראשי" className="scrollbar-none -mx-1 flex flex-1 flex-col gap-0.5 overflow-y-auto px-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item, pathname) && !HUB_GROUPS.some((g) => g.links.some((l) => pathname.startsWith(l.href)));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                  active ? "bg-primary-soft text-primary" : "text-foreground hover:bg-fill",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
          {HUB_GROUPS.map((g) => (
            <div key={g.id} className="mt-4">
              <p className="mb-1 px-3 text-[12px] font-semibold text-muted">{g.title}</p>
              {g.links.map((l) => {
                const active = pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={cn("flex h-10 items-center gap-3 rounded-xl px-2 text-[14px] transition-colors", active ? "bg-fill font-semibold" : "text-foreground/85 hover:bg-fill")}
                    style={{ "--h": l.hue } as React.CSSProperties}
                  >
                    <span aria-hidden className="mod-chip grid size-7 place-items-center rounded-[9px]">
                      <l.icon className="size-4" strokeWidth={2.1} />
                    </span>
                    {l.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="flex justify-end px-1 pt-3">
          <ThemeToggle />
        </div>
      </div>
      <QuickCreateSheet open={create} onOpenChange={setCreate} />
    </aside>
  );
}

/** The HomeOS app glyph: house inside a gradient squircle. */
export function AppGlyph({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[28%] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--accent)_70%,#fff)_0%,var(--accent)_60%,color-mix(in_oklab,var(--accent)_80%,#000)_100%)] shadow-[0_6px_18px_-6px_var(--accent),inset_0_1px_0_rgba(255,255,255,0.35)]",
        className,
      )}
    >
      <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
      <svg viewBox="0 0 24 24" className="relative size-[58%] text-white drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
        <path d="M9.5 20.5v-5.5h5v5.5" />
      </svg>
    </span>
  );
}
