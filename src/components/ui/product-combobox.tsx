"use client";

import { useId, useMemo, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { suggestProducts } from "@/lib/grocery";
import { cn } from "@/lib/utils";

export interface ProductOption {
  id: string;
  name: string;
}

/**
 * Type-to-search product picker. Shows only the products whose name contains
 * what was typed (best match first), never the whole catalog, plus a
 * "new product" choice. The list renders inline so it is never clipped inside
 * a scrolling sheet.
 */
export function ProductCombobox({
  options,
  value,
  onChange,
  initialQuery,
  label,
  newLabel = "מוצר חדש במלאי",
}: {
  options: ProductOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** What to search for when nothing is selected yet (usually the item's own name). */
  initialQuery: string;
  label: string;
  newLabel?: string;
}) {
  const listId = useId();
  const selected = value ? (options.find((o) => o.id === value) ?? null) : null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => suggestProducts(query, options, 6), [query, options]);

  function start() {
    setQuery(selected?.name ?? initialQuery);
    setOpen(true);
  }

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={start}
        aria-label={label}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-2.5 text-start text-sm"
      >
        {selected ? <Check className="size-4 shrink-0 text-sage" /> : <Plus className="size-4 shrink-0 text-sky" />}
        <span className="min-w-0 flex-1 truncate">{selected ? selected.name : newLabel}</span>
        <span className="shrink-0 text-[12px] text-primary">שינוי</span>
      </button>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="flex h-9 items-center gap-2 rounded-xl border border-primary bg-surface px-2.5">
        <Search className="size-4 shrink-0 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              e.preventDefault();
              pick(matches[0]?.id ?? null);
            }
          }}
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-label={label}
          placeholder="חיפוש במלאי…"
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none focus-visible:outline-none"
        />
      </div>
      <ul id={listId} role="listbox" className="mt-1 overflow-hidden rounded-xl border border-border bg-surface text-sm">
        {matches.map((o) => (
          <li key={o.id} role="option" aria-selected={o.id === value}>
            <button type="button" onClick={() => pick(o.id)} className="flex h-10 w-full items-center gap-2 px-3 text-start active:bg-fill">
              <Check className={cn("size-4 shrink-0", o.id === value ? "text-sage" : "invisible")} />
              <Highlight text={o.name} query={query} />
            </button>
          </li>
        ))}
        {query.trim() && !matches.length && <li className="px-3 py-2 text-[13px] text-muted">לא נמצא במלאי מוצר עם ״{query.trim()}״</li>}
        <li role="option" aria-selected={value === null} className="border-t border-border">
          <button type="button" onClick={() => pick(null)} className="flex h-10 w-full items-center gap-2 px-3 text-start font-medium text-sky active:bg-fill">
            <Plus className="size-4 shrink-0" />
            {newLabel}
          </button>
        </li>
      </ul>
    </div>
  );
}

/** Bold the part of the name that matched. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  if (at < 0) return <span className="truncate">{text}</span>;
  return (
    <span className="truncate">
      {text.slice(0, at)}
      <strong className="font-bold">{text.slice(at, at + q.length)}</strong>
      {text.slice(at + q.length)}
    </span>
  );
}
