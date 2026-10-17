"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * iOS large-title navigation: the big title scrolls away and a compact
 * Liquid Glass bar with the inline title fades in.
 */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  className?: string;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: "-56px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div
        className={cn(
          "fixed inset-x-0 top-0 z-30 transition-all duration-300 lg:start-72",
          compact ? "glass-thin border-b-[0.5px] border-border opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="mx-auto flex h-[calc(48px+env(safe-area-inset-top))] max-w-3xl items-end px-4 pb-2.5 lg:max-w-5xl">
          <div className="w-1/4">
            {back && (
              <Link href={back.href} className="flex items-center text-[17px] text-primary">
                <ChevronRight className="size-6 -ms-2" strokeWidth={2.5} />
                <span className="truncate">{back.label}</span>
              </Link>
            )}
          </div>
          <div className="headline flex-1 truncate text-center">{title}</div>
          <div className="flex w-1/4 justify-end gap-1">{compact ? actions : null}</div>
        </div>
      </div>

      <header className={cn("pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-4 lg:pt-10", className)}>
        <div className="flex h-11 items-center justify-between">
          {back ? (
            <Link href={back.href} className="-ms-2 flex items-center text-[17px] text-primary active:opacity-60">
              <ChevronRight className="size-7" strokeWidth={2.25} />
              {back.label}
            </Link>
          ) : (
            <span />
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        <h1 className="large-title mt-1 animate-fade-up">{title}</h1>
        {subtitle && <div className="mt-1 text-[15px] text-muted">{subtitle}</div>}
        <div ref={sentinel} aria-hidden className="h-px" />
      </header>
    </>
  );
}
