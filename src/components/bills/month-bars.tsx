"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTHS = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

/**
 * Single-series monthly totals: one hue, thin bars rounded at the data end,
 * 2px gaps, one baseline, tap/hover shows the exact value. The newest month is
 * direct-labeled; a hidden table carries the numbers for screen readers.
 */
export function MonthBars({ data, title }: { data: { month: string; total: number }[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.total));
  const label = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1];
  const shown = active ?? data.length - 1;

  return (
    <figure className="rounded-[var(--radius)] border border-border bg-surface p-4">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2">
        <span className="headline">{title}</span>
        {data[shown] && (
          <span className="text-[14px] text-muted">
            {label(data[shown].month)} {data[shown].month.slice(0, 4)}: <span className="num font-semibold text-foreground">{formatCurrency(Math.round(data[shown].total))}</span>
          </span>
        )}
      </figcaption>
      <div className="relative mt-3 flex h-36 items-end gap-[2px] border-b border-border" dir="ltr" aria-hidden>
        {data.map((d, i) => (
          <button
            key={d.month}
            type="button"
            tabIndex={-1}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            onClick={() => setActive(i)}
            className="group flex h-full flex-1 items-end"
            title={`${label(d.month)}: ${formatCurrency(Math.round(d.total))}`}
          >
            <span
              className={cn("block w-full rounded-t-[4px] transition-colors", i === shown ? "bg-primary" : "bg-primary/35 group-hover:bg-primary/60")}
              style={{ height: d.total > 0 ? `${Math.max(3, (d.total / max) * 100)}%` : "2px" }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-center text-[10px] text-muted" dir="ltr" aria-hidden>
        {data.map((d, i) => (
          <span key={d.month} className={cn("flex-1", i % 2 === 1 && data.length > 8 && "invisible")}>
            {label(d.month)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th>{d.month}</th>
              <td>{formatCurrency(Math.round(d.total))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Magnitude by category: horizontal bars in one hue, value in text ink. */
export function CategoryBars({ rows }: { rows: { key: string; label: string; emoji: string; total: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <ul className="space-y-3 rounded-[var(--radius)] border border-border bg-surface p-4">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between text-[15px]">
            <span>
              <span aria-hidden>{r.emoji}</span> {r.label}
            </span>
            <span className="num font-semibold">{formatCurrency(Math.round(r.total))}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-fill">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(r.total / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
