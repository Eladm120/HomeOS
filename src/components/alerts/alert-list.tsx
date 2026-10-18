"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AlertItem } from "@/lib/alerts";
import { resolveAlert } from "@/server/actions/alerts";
import { cn } from "@/lib/utils";

/**
 * Attention rows with one obvious button each. Acting removes the row
 * immediately (the server catches up behind it).
 */
export function AlertList({ alerts, preview, className }: { alerts: AlertItem[]; preview?: boolean; className?: string }) {
  const router = useRouter();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  async function act(a: AlertItem) {
    if (!a.action) return;
    if (preview) return void setGone((s) => new Set(s).add(a.key));
    setBusy(a.key);
    const res = await resolveAlert({ type: a.action.type, id: a.action.id });
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    setGone((s) => new Set(s).add(a.key));
    toast.success(res.data.message);
    router.refresh();
  }

  const shown = alerts.filter((a) => !gone.has(a.key));
  if (!shown.length) return null;

  return (
    <ul className={cn("card overflow-hidden [&>*+*]:border-t [&>*+*]:border-border", className)}>
      {shown.map((a) => (
        <li key={a.key} className={cn("flex items-center gap-3 px-3.5 py-3 transition-opacity", busy === a.key && "opacity-60")}>
          <Link href={a.href} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-60">
            <span
              aria-hidden
              className="cat-tint relative grid size-11 shrink-0 place-items-center rounded-2xl text-[22px]"
              style={{ "--h": a.hue } as React.CSSProperties}
            >
              {a.emoji}
              {a.urgency === "now" && !a.handled && <span className="absolute -top-0.5 -end-0.5 size-3 rounded-full bg-terracotta ring-2 ring-surface" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-semibold">{a.title}</span>
              <span className="footnote block truncate text-muted">{a.detail}</span>
            </span>
          </Link>
          {a.handled ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-sage-soft px-2.5 py-1 text-[12px] font-semibold text-sage">
              <Check className="size-3.5" strokeWidth={3} /> {a.handled}
            </span>
          ) : a.action ? (
            <button
              type="button"
              disabled={busy === a.key}
              onClick={() => act(a)}
              className="pressable flex h-9 shrink-0 items-center gap-1 rounded-full bg-primary-soft px-3.5 text-[14px] font-semibold text-primary"
            >
              {busy === a.key ? <Loader2 className="size-4 animate-spin" /> : a.action.label}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
