"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ASSISTANT_ITEM, NAV_ITEMS, isActive } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";
import { HUB_SECTIONS } from "./hub-sections";

const SIDEBAR_LINKS = HUB_SECTIONS.flatMap((s) => s.items).map((i) => ({ href: i.href, label: i.label }));

/**
 * Floating Liquid Glass tab bar (iOS 26 style): a glass capsule with a sliding
 * lens behind the active tab, plus a separate glowing AI button.
 */
export function BottomNav({ forcePath }: { forcePath?: string } = {}) {
  const routePath = usePathname();
  const pathname = forcePath ?? routePath;
  if (pathname.startsWith("/shopping/mode")) return null;
  const activeIdx = NAV_ITEMS.findIndex((i) => isActive(i, pathname));
  const aiActive = isActive(ASSISTANT_ITEM, pathname);

  return (
    <nav aria-label="ניווט ראשי" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto flex max-w-md items-center gap-2.5">
        <ul className="glass pointer-events-auto relative grid h-[62px] flex-1 grid-cols-4 rounded-full p-1">
          {activeIdx >= 0 && (
            <span
              aria-hidden
              className="absolute inset-y-1 rounded-full bg-fill transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ width: "calc((100% - 8px) / 4)", insetInlineStart: 4, transform: `translateX(calc(${activeIdx} * -100%))` }}
            />
          )}
          {NAV_ITEMS.map((item, i) => {
            const active = i === activeIdx;
            const Icon = item.icon;
            return (
              <li key={item.href} className="relative z-10">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold transition-colors active:scale-95",
                    active ? "text-primary" : "text-foreground/75",
                  )}
                >
                  <Icon className="size-[23px]" strokeWidth={active ? 2.25 : 1.85} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href={ASSISTANT_ITEM.href}
          aria-label={ASSISTANT_ITEM.label}
          aria-current={aiActive ? "page" : undefined}
          className="glass ai-glow pressable pointer-events-auto grid size-[62px] shrink-0 place-items-center rounded-full"
        >
          <ASSISTANT_ITEM.icon className={cn("size-6", aiActive ? "text-primary" : "text-foreground/80")} strokeWidth={2} />
        </Link>
      </div>
    </nav>
  );
}

export function Sidebar({ householdName, forcePath }: { householdName: string; forcePath?: string }) {
  const routePath = usePathname();
  const pathname = forcePath ?? routePath;
  const items = [...NAV_ITEMS, ASSISTANT_ITEM];
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 p-3 lg:block">
      <div className="glass flex h-full flex-col rounded-[2rem] px-3 py-5">
        <Link href="/" className="mb-7 flex items-center gap-3 px-2">
          <AppGlyph className="size-11" />
          <span className="min-w-0">
            <span className="headline block">HomeOS</span>
            <span className="footnote block truncate text-muted">{householdName}</span>
          </span>
        </Link>
        <nav aria-label="ניווט ראשי" className="flex flex-1 flex-col gap-0.5">
          {items.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-fill",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
          {SIDEBAR_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "ms-8 flex h-9 items-center rounded-lg px-3 text-[14px] transition-colors",
                pathname.startsWith(l.href) ? "font-semibold text-primary" : "text-muted hover:bg-fill",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex justify-end px-1">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

/** The HomeOS app glyph: house inside a gradient squircle. */
export function AppGlyph({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[28%] bg-[linear-gradient(145deg,#6aa985_0%,#3b7657_55%,#2f6447_100%)] shadow-[0_8px_24px_rgba(59,118,87,0.3),inset_0_1px_0_rgba(255,255,255,0.35)]",
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
