"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, Search, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { sortCatalog, type CatalogEntry, type CatalogSort } from "@/lib/catalog";
import { categoryStyle, productEmoji } from "@/lib/category-style";
import { normalizeProductName } from "@/lib/grocery";
import { primeSignedUrls } from "@/lib/media";
import type { ProductCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { addShoppingItem } from "@/server/actions/grocery";
import { SignedImage } from "@/components/media/signed-image";
import { Emoji3D } from "@/components/ui/emoji-3d";

type Screen = { kind: "home" } | { kind: "categories" } | { kind: "items"; categoryId: string | null };

const SORTS: { id: CatalogSort; label: string }[] = [
  { id: "popular", label: "הכי נקנים" },
  { id: "recent", label: "אחרונים" },
  { id: "missing", label: "חסר בבית" },
];

const NONE = "__none__";

/**
 * The supermarket catalog: every product the household ever bought, shown like
 * a grocery app — illustrated categories, big product cards, one tap to put a
 * product on the shared list. Home → all categories → one category's items.
 */
export function CatalogView({
  householdName,
  entries,
  categories,
  signedUrls,
  preview,
}: {
  householdName: string;
  entries: CatalogEntry[];
  categories: ProductCategory[];
  signedUrls: Record<string, string>;
  preview?: boolean;
}) {
  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [sort, setSort] = useState<CatalogSort>("popular");
  const [query, setQuery] = useState("");
  const [added, setAdded] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const onList = (e: CatalogEntry) => e.onList + (added[e.key] ?? 0);
  const cartCount = entries.filter((e) => onList(e) > 0).length;

  // Categories that actually hold products first, in the household's order.
  const usedCats = useMemo(() => {
    const used = new Set(entries.map((e) => e.categoryId ?? NONE));
    const list = categories.filter((c) => used.has(c.id)).map((c) => ({ id: c.id as string | null, name: c.name, cat: c as ProductCategory | null }));
    const rest = categories.filter((c) => !used.has(c.id)).map((c) => ({ id: c.id as string | null, name: c.name, cat: c as ProductCategory | null }));
    if (used.has(NONE)) list.push({ id: null, name: "שונות", cat: null });
    return [...list, ...rest];
  }, [entries, categories]);

  const q = normalizeProductName(query);
  const searching = q.length > 0;
  const shown = useMemo(() => {
    if (searching) return sortCatalog(entries.filter((e) => normalizeProductName(`${e.name} ${e.brand ?? ""}`).includes(q)), "popular");
    if (screen.kind === "items") return sortCatalog(entries.filter((e) => (e.categoryId ?? null) === screen.categoryId), "popular");
    return sortCatalog(entries, sort);
  }, [entries, screen, sort, q, searching]);

  async function add(e: { key: string; name: string; unit: string; brand: string | null; categoryId: string | null; catalogId: string | null; imagePath: string | null }) {
    if (busy) return;
    setBusy(e.key);
    const res = preview
      ? ({ ok: true, data: { merged: false } } as const)
      : await addShoppingItem({ name: e.name, quantity: 1, unit: e.unit, brand: e.brand, category_id: e.categoryId, catalog_product_id: e.catalogId, image_path: e.imagePath, save_to_catalog: true });
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    setAdded((a) => ({ ...a, [e.key]: (a[e.key] ?? 0) + 1 }));
    toast.success(res.data.merged ? `${e.name}: עוד אחד ברשימה` : `${e.name} ברשימה`, { action: { label: "לרשימה", onClick: () => router.push("/shopping") } });
  }

  const cartPill = (
    <Link href="/shopping" aria-label={`לרשימת הקניות, ${cartCount} מוצרים`} className="pressable flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-sage-soft px-4 text-sage">
      <ShoppingBag className="size-[22px]" strokeWidth={2.4} />
      <span className="num text-[24px] leading-none font-black tracking-tight">{String(cartCount).padStart(2, "0")}</span>
    </Link>
  );

  const title = screen.kind === "categories" ? "קטגוריות" : screen.kind === "items" ? "פריטים" : null;

  return (
    <div className="pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-6 lg:pt-8">
      {/* Top bar: who/where + what's waiting on the list */}
      {title ? (
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setScreen(screen.kind === "items" ? { kind: "categories" } : { kind: "home" })} className="pressable h-12 rounded-full bg-sage-soft px-5 text-[18px] font-black text-sage">
            חזרה
          </button>
          <h1 className="text-[19px] font-semibold">{title}</h1>
          {cartPill}
        </div>
      ) : (
        <div className="card flex items-center gap-3 rounded-full p-1.5 ps-5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] leading-tight font-bold">{householdName}</span>
            <span className="block text-[13px] text-muted">הקטלוג של הבית · {entries.length} מוצרים</span>
          </span>
          {cartPill}
        </div>
      )}

      {screen.kind !== "items" && (
        <label className="card mt-4 flex h-14 items-center gap-3 rounded-2xl px-5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש מוצר"
            aria-label="חיפוש בקטלוג"
            type="search"
            className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted"
          />
          <Search className="size-6 text-muted" strokeWidth={1.8} />
        </label>
      )}

      {searching ? (
        <section className="mt-6">
          <ProductGrid entries={shown} catById={catById} onList={onList} busy={busy} onAdd={add} />
          {!entries.some((e) => normalizeProductName(e.name) === q) && (
            <button
              type="button"
              onClick={async () => {
                await add({ key: `new:${q}`, name: query.trim(), unit: "יח׳", brand: null, categoryId: null, catalogId: null, imagePath: null });
                setQuery("");
              }}
              className="card pressable mt-3 flex w-full items-center gap-3 p-4 text-start"
            >
              <span className="grid size-11 place-items-center rounded-full bg-foreground text-background">
                <Plus className="size-5" strokeWidth={2.5} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">הוספת ״{query.trim()}״ לרשימה</span>
                <span className="block text-[13px] text-muted">מוצר חדש — יישמר בקטלוג לפעם הבאה</span>
              </span>
            </button>
          )}
        </section>
      ) : screen.kind === "home" ? (
        <>
          <div className="mt-7 mb-3 flex items-end justify-between">
            <h2 className="text-[22px] font-bold">קטגוריות</h2>
            <button type="button" onClick={() => setScreen({ kind: "categories" })} className="text-[16px] text-muted">
              הכל
            </button>
          </div>
          <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pt-3 pb-2">
            {usedCats.slice(0, 8).map((c) => (
              <CategoryTile key={c.id ?? NONE} name={c.name} category={c.cat} small onClick={() => setScreen({ kind: "items", categoryId: c.id })} />
            ))}
          </div>

          <BigTabs value={sort} onChange={setSort} options={SORTS} />
          {shown.length ? (
            <ProductGrid entries={shown} catById={catById} onList={onList} busy={busy} onAdd={add} />
          ) : (
            <EmptyCatalog sort={sort} total={entries.length} />
          )}
        </>
      ) : screen.kind === "categories" ? (
        <div className="mt-6 grid grid-cols-3 gap-3 pt-3">
          {usedCats.map((c) => (
            <CategoryTile key={c.id ?? NONE} name={c.name} category={c.cat} onClick={() => setScreen({ kind: "items", categoryId: c.id })} />
          ))}
        </div>
      ) : (
        <>
          <BigTabs
            value={screen.categoryId ?? NONE}
            onChange={(id) => setScreen({ kind: "items", categoryId: id === NONE ? null : id })}
            options={usedCats.map((c) => ({ id: c.id ?? NONE, label: c.name }))}
          />
          {shown.length ? <ProductGrid entries={shown} catById={catById} onList={onList} busy={busy} onAdd={add} /> : <EmptyCatalog sort="popular" total={0} />}
        </>
      )}
    </div>
  );
}

/** Oversized condensed tabs ("Popular / New arrivals"): the active one dark, the rest faded. */
function BigTabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  return (
    <div role="tablist" className="scrollbar-none -mx-4 my-5 flex items-baseline gap-5 overflow-x-auto px-4">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            ref={(el) => {
              if (active && el) el.scrollIntoView({ block: "nearest", inline: "center" });
            }}
            className={cn("shrink-0 text-[34px] leading-none font-black tracking-[-0.04em] whitespace-nowrap transition-colors", active ? "text-foreground" : "text-foreground/15")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Illustrated category: a tall soft gradient of the category's colour with its 3D picture bleeding off the top. */
function CategoryTile({ name, category, small, onClick }: { name: string; category: Pick<ProductCategory, "name" | "icon"> | null; small?: boolean; onClick: () => void }) {
  const style = categoryStyle(category);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("pressable relative flex shrink-0 snap-start flex-col items-center justify-end overflow-hidden rounded-[1.375rem] pb-2.5 shadow-[var(--card-shadow)]", small ? "h-[118px] w-[100px]" : "aspect-[0.92]")}
      style={{ background: `linear-gradient(180deg, oklch(0.78 0.14 ${style.hue}) 0%, oklch(0.88 0.08 ${style.hue}) 38%, var(--surface) 78%)` }}
    >
      <Emoji3D emoji={style.emoji} className={cn("absolute", small ? "-top-2 size-[84px]" : "-top-3 size-[96%] max-h-[78%]")} />
      <span className={cn("relative font-medium", small ? "text-[14px]" : "text-[16px]")}>{name}</span>
    </button>
  );
}

function ProductGrid({
  entries,
  catById,
  onList,
  busy,
  onAdd,
}: {
  entries: CatalogEntry[];
  catById: Map<string, ProductCategory>;
  onList: (e: CatalogEntry) => number;
  busy: string | null;
  onAdd: (e: CatalogEntry) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {entries.map((e) => {
        const qty = onList(e);
        const category = e.categoryId ? (catById.get(e.categoryId) ?? null) : null;
        const sub = [e.brand, e.unit].filter(Boolean).join(" · ");
        return (
          <div key={e.key} className="card flex flex-col rounded-[1.375rem] p-4 pb-3.5">
            <div className="mx-auto grid h-[118px] w-full place-items-center">
              {e.imagePath ? (
                <SignedImage path={e.imagePath} alt={e.name} className="h-full w-full rounded-2xl object-cover" />
              ) : (
                <Emoji3D emoji={productEmoji(e.name, category)} className="size-[104px] text-[72px]" />
              )}
            </div>
            <p className="mt-3 truncate text-[17px] leading-tight font-medium">{e.name}</p>
            <p className="truncate text-[14px] text-muted">{sub}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="min-w-0 text-[15px] leading-tight font-bold">
                {e.low ? <span className="text-terracotta">נגמר בבית</span> : e.timesBought ? <span>{e.timesBought === 1 ? "נקנה פעם אחת" : <><span className="num">{e.timesBought}</span> קניות</>}</span> : <span className="font-medium text-muted">חדש</span>}
              </span>
              <button
                type="button"
                disabled={busy === e.key}
                onClick={() => onAdd(e)}
                aria-label={qty ? `עוד ${e.name} לרשימה (כבר ${qty})` : `${e.name} לרשימה`}
                className={cn(
                  "pressable relative grid size-10 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-60",
                  qty ? "bg-primary text-primary-foreground" : "bg-foreground/80 text-background",
                )}
              >
                {qty ? <Check className="size-5" strokeWidth={3} /> : <Plus className="size-5" strokeWidth={2.75} />}
                {qty > 1 && <span className="num absolute -top-1 -end-1 grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1 text-[11px] font-bold text-background">{qty}</span>}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyCatalog({ sort, total }: { sort: CatalogSort; total: number }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <Emoji3D emoji="🛒" className="mb-3 size-20 text-[56px]" />
      <p className="title-2">{sort === "missing" && total ? "לא חסר כלום בבית" : "הקטלוג עוד ריק"}</p>
      <p className="mt-1 max-w-xs text-[14px] text-muted">
        {sort === "missing" && total ? "מוצרים שיורדים מתחת למינימום במלאי יופיעו כאן." : "כל מוצר שנכנס לרשימת הקניות נשמר כאן אוטומטית — בפעם הבאה מוסיפים בלחיצה."}
      </p>
    </div>
  );
}
