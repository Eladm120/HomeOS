"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, EyeOff, PackageCheck, X } from "lucide-react";
import type { ProductCategory, ShoppingListItem } from "@/lib/types";
import { groupByCategory } from "@/lib/grocery";
import { categoryStyle } from "@/lib/category-style";
import { formatQuantityWithUnit } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductThumb } from "./item-row";

/**
 * Supermarket mode: full screen, one hand, nothing but the shopping. Big rows
 * that toggle anywhere you tap, product pictures, aisle-by-aisle sections with
 * the current one named on top, progress, and an option to hide what's in the
 * cart. Keeps the screen awake while open (where the browser allows it).
 */
export function StoreMode({
  pending,
  done,
  categories,
  onToggle,
  onFinish,
  onClose,
}: {
  pending: ShoppingListItem[];
  done: ShoppingListItem[];
  categories: ProductCategory[];
  onToggle: (item: ShoppingListItem) => void;
  onFinish: () => void;
  onClose: () => void;
}) {
  const [hideDone, setHideDone] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const sections = useRef<Map<string, HTMLElement>>(new Map());
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const total = pending.length + done.length;
  const groups = useMemo(() => {
    const all = hideDone ? pending : [...pending, ...done];
    return groupByCategory(all, categories).map((g) => ({
      ...g,
      // What's left first; what's in the cart sinks to the bottom of its aisle.
      items: [...g.items].sort((a, b) => Number(a.status !== "pending") - Number(b.status !== "pending")),
      left: g.items.filter((i) => i.status === "pending").length,
    }));
  }, [pending, done, categories, hideDone]);

  // Lock page scroll, keep the screen on, close on Escape.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      void lock?.release().catch(() => undefined);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // "Current aisle": the section nearest the top of the screen.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setCurrent((top.target as HTMLElement).dataset.key ?? null);
      },
      { root, rootMargin: "-170px 0px -55% 0px" },
    );
    sections.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [groups]);

  const jump = (key: string) => sections.current.get(key)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const pct = total ? (done.length / total) * 100 : 0;

  return (
    <div role="dialog" aria-modal="true" aria-label="מצב סופר" className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="glass-thin z-10 border-b-[0.5px] border-border px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} aria-label="יציאה ממצב סופר" className="pressable grid size-11 shrink-0 place-items-center rounded-full bg-surface shadow-[var(--card-shadow)]">
              <X className="size-5" strokeWidth={2.5} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] leading-tight font-bold [font-family:var(--font-display)]">קניות בסופר</h1>
              <p className="truncate text-[13px] text-muted">{current ? `מחלקה: ${groups.find((g) => (g.id ?? "none") === current)?.name ?? ""}` : "המוצרים לפי מחלקות"}</p>
            </div>
            <p className="num shrink-0 text-[26px] font-bold tracking-tight">
              {done.length}
              <span className="text-[17px] font-semibold text-muted">/{total}</span>
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done.length} aria-label="התקדמות הקנייה">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="scrollbar-none -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4">
            <button
              type="button"
              aria-pressed={hideDone}
              onClick={() => setHideDone((h) => !h)}
              className={cn("pressable flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold", hideDone ? "bg-foreground text-background" : "bg-surface shadow-[var(--card-shadow)]")}
            >
              {hideDone ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              הסתרת מה שנקנה
            </button>
            {groups.map((g) => {
              const key = g.id ?? "none";
              const style = categoryStyle(g.id ? (catById.get(g.id) ?? null) : null);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => jump(key)}
                  className={cn(
                    "pressable flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium transition-colors",
                    current === key ? "bg-primary text-primary-foreground" : "bg-surface shadow-[var(--card-shadow)]",
                    g.left === 0 && current !== key && "opacity-50",
                  )}
                >
                  <span aria-hidden>{style.emoji}</span>
                  {g.name}
                  {g.left > 0 && <span className="num text-[12px] opacity-70">{g.left}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
        <div className="mx-auto max-w-2xl space-y-6">
          {pending.length === 0 && (
            <div className="hero flex flex-col items-center px-6 py-8 text-center">
              <span className="mb-3 grid size-16 animate-pop place-items-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-8" strokeWidth={3} />
              </span>
              <p className="title-2">הכל בעגלה!</p>
              <p className="hero-muted mt-1 text-[14px]">סיימו את הקנייה כדי לעדכן את המלאי בבית</p>
            </div>
          )}
          {groups.map((g) => {
            const key = g.id ?? "none";
            const category = g.id ? (catById.get(g.id) ?? null) : null;
            const style = categoryStyle(category);
            return (
              <section
                key={key}
                data-key={key}
                ref={(el) => {
                  if (el) sections.current.set(key, el);
                  else sections.current.delete(key);
                }}
                className="scroll-mt-4"
                aria-label={g.name}
              >
                <h2 className="mb-2 flex items-center gap-2.5 px-1">
                  <span aria-hidden className="cat-tint grid size-9 place-items-center rounded-xl text-[19px]" style={{ "--h": style.hue } as React.CSSProperties}>
                    {style.emoji}
                  </span>
                  <span className="text-[19px] font-bold [font-family:var(--font-display)]">{g.name}</span>
                  <span className="num text-[14px] text-muted">{g.left ? `${g.left} נשארו` : "הושלם"}</span>
                </h2>
                <ul className="space-y-2">
                  {g.items.map((it) => {
                    const inCart = it.status !== "pending";
                    const meta = [it.brand && `מותג: ${it.brand}`, it.variant, it.notes].filter(Boolean).join(" · ");
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={inCart}
                          onClick={() => {
                            if (navigator.vibrate) navigator.vibrate(10);
                            onToggle(it);
                          }}
                          className={cn("card flex min-h-[84px] w-full items-center gap-3.5 p-3 text-start transition-all duration-300 active:scale-[0.98]", inCart && "opacity-55")}
                        >
                          <span
                            className={cn(
                              "grid size-11 shrink-0 place-items-center rounded-full transition-all duration-300",
                              inCart ? "bg-primary text-primary-foreground" : "shadow-[inset_0_0_0_2.5px_var(--muted-2)]",
                            )}
                          >
                            {inCart && <Check className="size-6 animate-pop" strokeWidth={3.25} />}
                          </span>
                          <ProductThumb name={it.name} imagePath={it.image_path} category={category} dim={inCart} className="size-[60px] rounded-[18px] text-[32px]" />
                          <span className="min-w-0 flex-1">
                            <span className={cn("block text-[20px] leading-tight font-semibold", inCart && "line-through decoration-2")}>{it.name}</span>
                            <span className="num mt-1 block text-[15px] font-medium text-primary">{formatQuantityWithUnit(it.quantity, it.unit)}</span>
                            {meta && <span className="mt-0.5 block truncate text-[13px] text-muted">{meta}</span>}
                          </span>
                          {it.priority === "high" && !inCart && <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-[12px] font-bold text-danger">דחוף</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            onClick={onFinish}
            disabled={!done.length}
            className="pressable pointer-events-auto flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[17px] font-bold text-primary-foreground shadow-lift disabled:opacity-40"
          >
            <PackageCheck className="size-5" /> סיום קנייה{done.length ? ` · ${done.length} בעגלה` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
