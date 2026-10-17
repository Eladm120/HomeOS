import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "./page-header";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

/** Honest placeholder for modules scheduled in a later build phase. */
export function ComingSoon({
  title,
  icon: Icon,
  phase,
  description,
  features,
  cta,
}: {
  title: string;
  icon: LucideIcon;
  phase: number;
  description: string;
  features: string[];
  cta?: { href: string; label: string };
}) {
  return (
    <>
      <PageHeader title={title} />
      <Card className="p-6 text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-primary-soft text-primary">
          <Icon className="size-8" />
        </div>
        <span className="inline-block rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">בבנייה · שלב {phase}</span>
        <p className="mx-auto mt-3 max-w-sm text-muted">{description}</p>
        <ul className="mx-auto mt-5 max-w-xs space-y-2 text-start text-sm">
          {features.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
              {f}
            </li>
          ))}
        </ul>
        {cta && (
          <Link href={cta.href} className={buttonVariants({ variant: "secondary", className: "mt-6" })}>
            {cta.label}
          </Link>
        )}
      </Card>
    </>
  );
}
