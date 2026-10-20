"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, PanelRightClose, PanelRightOpen, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";
import { HUB_GROUPS } from "./hub-sections";
import { QuickCreateSheet } from "./quick-create";

/**
 * Mobile tab bar: five destinations on a frosted bar that respects the iPhone
 * home indicator. The selected tab gets a soft accent pill behind its icon
 * (Material-3 style) and a bolder label — calm, obvious, thumb-friendly.
 */
export function BottomNav({ forcePath }: { forcePath?: string } = {}) {
  const routePath = usePathname();
  const pathname = forcePath ?? routePath;
  if (pathname.startsWith("/shopping/mode")) return null;

  return (
    <nav aria-label="ניווט ראשי" className="glass fixed inset-x-0 bottom-0 z-40 border-t-[0.5px] border-border pb-[max(0.35rem,env(safe-area-inset-bottom))] shadow-none lg:hidden">
      <ul className="mx-auto grid h-[64px] max-w-lg grid-cols-5 px-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="group flex h-full flex-col items-center justify-center gap-1 text-[11px] active:scale-95"
              >
                <span
                  className={cn(
                    "grid h-8 w-14 place-items-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                    active ? "bg-primary-soft text-primary" : "text-foreground/55",
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                </span>
                <span className={cn("leading-none transition-colors", active ? "font-bold text-foreground" : "font-medium text-foreground/55")}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const SIDEBAR_KEY = "homeos:sidebar-collapsed";

/**
 * Desktop sidebar: the five destinations, a "הוספה" button, and the household
 * modules grouped (daily · home · management) in collapsible sections. The
 * whole bar folds into an icon rail; both choices are remembered per device.
 */
export function Sidebar({ householdName, forcePath }: { householdName: string; forcePath?: string }) {
  const routePath = usePathname();
  const pathname = forcePath ?? routePath;
  const [create, setCreate] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      /* private mode */
    }
  }, []);
  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, c ? "0" : "1");
      } catch {
        /* private mode */
      }
      return !c;
    });
  }
  const inModule = HUB_GROUPS.some((g) => g.links.some((l) => pathname.startsWith(l.href)));

  return (
    <aside className={cn("sticky top-0 hidden h-dvh shrink-0 p-3 transition-[width] duration-300 lg:block", collapsed ? "w-[92px]" : "w-72")}>
      <div className="card flex h-full flex-col rounded-[1.75rem] px-3 py-4">
        <div className={cn("mb-4 flex items-center gap-3", collapsed ? "flex-col" : "px-1")}>
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-3" aria-label="HomeOS">
            <AppGlyph className="size-11" />
            {!collapsed && (
              <span className="min-w-0">
                <span className="headline block">HomeOS</span>
                <span className="footnote block truncate text-muted">{householdName}</span>
              </span>
            )}
          </Link>
          <button type="button" onClick={toggle} aria-label={collapsed ? "הרחבת התפריט" : "כיווץ התפריט"} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-fill">
            {collapsed ? <PanelRightOpen className="size-5" /> : <PanelRightClose className="size-5" />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCreate(true)}
          aria-label="הוספה"
          className={cn("pressable mb-4 flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground", collapsed && "mx-auto w-11")}
        >
          <Plus className="size-5" strokeWidth={2.4} /> {!collapsed && "הוספה"}
        </button>
        <nav aria-label="ניווט ראשי" className="scrollbar-none -mx-1 flex flex-1 flex-col gap-0.5 overflow-y-auto px-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item, pathname) && !(item.href === "/household" && inModule);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  active ? "bg-primary-soft font-semibold text-primary" : "text-foreground/85 hover:bg-fill",
                )}
              >
                <Icon className="size-5 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
          <div className="my-3 h-px bg-border" />
          {HUB_GROUPS.map((g) => (
            <details key={g.id} open={!collapsed && g.links.some((l) => pathname.startsWith(l.href)) ? true : undefined} className="group/sec">
              <summary className={cn("flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-[12px] font-semibold text-muted hover:bg-fill", collapsed && "justify-center px-0")}>
                {collapsed ? <span className="size-1.5 rounded-full bg-muted-2" aria-hidden /> : g.title}
                {!collapsed && <ChevronDown className="ms-auto size-4 transition-transform group-open/sec:rotate-180" />}
                {collapsed && <span className="sr-only">{g.title}</span>}
              </summary>
              {g.links.map((l) => {
                const active = pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    title={collapsed ? l.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn("flex h-10 items-center gap-3 rounded-xl px-2 text-[14px] transition-colors", collapsed && "justify-center px-0", active ? "bg-fill font-semibold" : "text-foreground/85 hover:bg-fill")}
                    style={{ "--h": l.hue } as React.CSSProperties}
                  >
                    <span aria-hidden className="mod-chip grid size-7 shrink-0 place-items-center rounded-[9px]">
                      <l.icon className="size-4" strokeWidth={2.1} />
                    </span>
                    {!collapsed && l.label}
                  </Link>
                );
              })}
            </details>
          ))}
        </nav>
        <div className={cn("flex pt-3", collapsed ? "justify-center" : "justify-end px-1")}>
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
