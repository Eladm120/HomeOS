"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/shopping/mode")) return null;
  return (
    <nav
      aria-label="ניווט ראשי"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-surface/90 backdrop-blur-xl pb-safe lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-14 place-items-center rounded-full transition-all",
                    active && "bg-primary-soft",
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.9} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Sidebar({ householdName }: { householdName: string }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-border/70 bg-surface/60 px-4 py-6 lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-3 px-2">
        <span className="grid size-10 place-items-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-soft">
          H
        </span>
        <span className="min-w-0">
          <span className="block text-base font-semibold">HomeOS</span>
          <span className="block truncate text-xs text-muted">{householdName}</span>
        </span>
      </Link>
      <nav aria-label="ניווט ראשי" className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-medium transition-colors",
                active ? "bg-primary-soft text-primary" : "text-foreground/80 hover:bg-surface-2",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/inventory"
          className={cn(
            "me-0 ms-6 flex h-9 items-center gap-2 rounded-xl px-3 text-sm transition-colors",
            pathname.startsWith("/inventory") ? "text-primary" : "text-muted hover:bg-surface-2",
          )}
        >
          מלאי
        </Link>
      </nav>
      <div className="flex items-center justify-end px-2">
        <ThemeToggle />
      </div>
    </aside>
  );
}
