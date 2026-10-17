import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bordered surface with full-width dividers between children — the "clear
 * separation" list style used across modules.
 */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("overflow-hidden rounded-[var(--radius)] border border-border bg-surface [&>*+*]:border-t [&>*+*]:border-border", className)}
      {...props}
    />
  );
}

export function PanelHeading({
  title,
  count,
  action,
  className,
}: {
  title: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2 flex items-center justify-between gap-3 px-1", className)}>
      <h2 className="headline flex items-baseline gap-2">
        {title}
        {count !== undefined && <span className="num footnote font-normal text-muted">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

/** One tappable row inside a Panel. */
export function PanelRow({
  href,
  onClick,
  leading,
  title,
  subtitle,
  trailing,
  chevron,
  className,
}: {
  href?: string;
  onClick?: () => void;
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  className?: string;
}) {
  const inner = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium">{title}</span>
        {subtitle && <span className="footnote mt-0.5 block truncate text-muted">{subtitle}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
      {(chevron ?? !!href) && <ChevronLeft className="size-[18px] shrink-0 text-muted-2" strokeWidth={2.5} />}
    </>
  );
  const cls = cn("flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start transition-colors active:bg-fill", className);
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

/** Horizontal filter pills (one active). */
export function FilterPills<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; count?: number }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "pressable flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[15px] font-medium transition-colors",
              active ? "border-transparent bg-foreground text-background" : "border-border bg-surface text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cn("num text-[12px]", active ? "opacity-70" : "text-muted")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Big round "+" in the page header. */
export function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="pressable flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[15px] font-semibold text-primary-foreground">
      <span aria-hidden className="text-[20px] leading-none">+</span>
      {label}
    </button>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-11 w-full rounded-xl border-0 bg-fill px-3.5 text-[17px] outline-none placeholder:text-muted-2 focus:ring-2 focus:ring-primary/40"
    />
  );
}
