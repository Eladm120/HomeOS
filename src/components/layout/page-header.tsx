import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
  return (
    <header className={cn("flex items-end gap-3 pt-6 pb-5 lg:pt-10", className)}>
      <div className="min-w-0 flex-1">
        {back && (
          <Link
            href={back.href}
            className="mb-2 -ms-1 inline-flex items-center gap-0.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            <ChevronRight className="size-4" />
            {back.label}
          </Link>
        )}
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight lg:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
