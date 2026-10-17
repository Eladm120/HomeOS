import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Inset-grouped container (iOS Settings style). */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-hidden rounded-[var(--radius)] bg-surface", className)} {...props} />;
}

export function CardHeader({
  title,
  icon,
  action,
  className,
  subtitle,
  tint = "bg-primary",
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
  tint?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-4 pt-4 pb-2", className)}>
      {icon && <IconTile className={tint}>{icon}</IconTile>}
      <div className="min-w-0 flex-1">
        <h2 className="headline truncate">{title}</h2>
        {subtitle && <p className="footnote truncate text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Rounded-square SF-Symbols-style icon tile. */
export function IconTile({ className, children, size = "md" }: { className?: string; children: React.ReactNode; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-7 rounded-[7px] [&_svg]:size-4", md: "size-8 rounded-[8px] [&_svg]:size-[18px]", lg: "size-11 rounded-[12px] [&_svg]:size-6" };
  return <span className={cn("grid shrink-0 place-items-center text-white", sizes[size], className)}>{children}</span>;
}

export function SectionLabel({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-1.5 flex items-end justify-between px-4", className)}>
      <h2 className="footnote font-normal text-muted">{children}</h2>
      {action}
    </div>
  );
}

/** A single row inside an inset-grouped list. */
export function ListRow({
  href,
  onClick,
  icon,
  title,
  subtitle,
  trailing,
  chevron,
  className,
  destructive,
}: {
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  className?: string;
  destructive?: boolean;
}) {
  const inner = (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[17px]", destructive && "text-danger")}>{title}</span>
        {subtitle && <span className="footnote block truncate text-muted">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-[17px] text-muted">{trailing}</span>}
      {(chevron ?? !!href) && <ChevronLeft className="size-[18px] shrink-0 text-muted-2" strokeWidth={2.5} />}
    </>
  );
  const cls = cn("flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-start transition-colors active:bg-fill", className);
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "primary" | "sage" | "amber" | "danger" | "sky" }) {
  const tones = {
    neutral: "bg-fill text-muted",
    primary: "bg-primary-soft text-primary",
    sage: "bg-sage-soft text-sage",
    amber: "bg-amber-soft text-amber",
    danger: "bg-danger-soft text-danger",
    sky: "bg-sky-soft text-sky",
  } as const;
  return (
    <span
      className={cn("inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-[12px] font-semibold [&_svg]:size-3", tones[tone], className)}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-xl bg-fill", className)} {...props} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-8 py-12 text-center", className)}>
      <div className="text-muted-2 [&_svg]:size-14 [&_svg]:stroke-[1.25]">{icon}</div>
      <div className="space-y-1">
        <h3 className="title-2">{title}</h3>
        {description && <p className="mx-auto max-w-xs text-[15px] text-muted">{description}</p>}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
