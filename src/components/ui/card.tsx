import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius)] border border-border/70 bg-surface shadow-soft", className)} {...props} />;
}

export function CardHeader({
  title,
  icon,
  action,
  className,
  subtitle,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-5 pt-4 pb-2", className)}>
      {icon && <div className="grid size-9 place-items-center rounded-xl bg-surface-2 text-foreground/80 [&_svg]:size-[18px]">{icon}</div>}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[15px] font-semibold">{title}</h2>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "primary" | "sage" | "amber" | "danger" | "sky" }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    primary: "bg-primary-soft text-primary",
    sage: "bg-sage-soft text-sage",
    amber: "bg-amber-soft text-amber",
    danger: "bg-danger-soft text-danger",
    sky: "bg-sky-soft text-sky",
  } as const;
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3", tones[tone], className)}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-xl bg-surface-3/70", className)} {...props} />;
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
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <div className="grid size-16 place-items-center rounded-3xl bg-primary-soft text-primary [&_svg]:size-7">{icon}</div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="mx-auto max-w-xs text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
