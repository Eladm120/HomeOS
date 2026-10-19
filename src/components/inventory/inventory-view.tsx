"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, ClipboardList, Minus, Plus, Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { applyInventoryMovement } from "@/server/actions/inventory";
import { addInventoryItemToList } from "@/server/actions/grocery";
import type { InventoryItem, InventoryLocation, ProductCategory } from "@/lib/types";
import { expiryState, stockLevel } from "@/lib/inventory-logic";
import { formatQuantity, relativeDays } from "@/lib/format";
import { primeSignedUrls } from "@/lib/media";
import { cn } from "@/lib/utils";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useOpenFromQuery } from "@/hooks/use-open-from-query";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Segmented } from "@/components/ui/field";
import { SignedImage } from "@/components/media/signed-image";
import { InventoryItemSheet } from "./inventory-item-sheet";

type Filter = "all" | "low" | "expiring";

export function InventoryView({
  householdId,
  items: initialItems,
  locations,
  categories,
  signedUrls,
}: {
  householdId: string;
  items: InventoryItem[];
  locations: InventoryLocation[];
  categories: ProductCategory[];
  signedUrls: Record<string, string>;
}) {
  useMemo(() => primeSignedUrls(signedUrls), [signedUrls]);
  useRealtimeRefresh("inventory_items", householdId);

  const [items, setItems] = useState(initialItems);
  useEffect(() => setItems(initialItems), [initialItems]);

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState<string>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  useOpenFromQuery(() => setSheetOpen(true));

  const counts = useMemo(() => {
    let low = 0;
    let expiring = 0;
    for (const i of items) {
      if (stockLevel(i) !== "ok") low++;
      const e = expiryState(i.expires_on);
      if (e && e.state !== "ok") expiring++;
    }
    return { low, expiring };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (location !== "all" && (i.location_id ?? "none") !== location) return false;
      if (q && !`${i.name} ${i.brand ?? ""}`.toLowerCase().includes(q)) return false;
      if (filter === "low" && stockLevel(i) === "ok") return false;
      if (filter === "expiring") {
        const e = expiryState(i.expires_on);
        if (!e || e.state === "ok") return false;
      }
      return true;
    });
  }, [items, query, location, filter]);

  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name;

  async function quickMove(item: InventoryItem, kind: "consume" | "add") {
    const prev = item.quantity;
    const next = kind === "consume" ? Math.max(0, Number(prev) - 1) : Number(prev) + 1;
    setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, quantity: next } : i)));
    const res = await applyInventoryMovement({ item_id: item.id, kind, quantity: 1, idempotency_key: crypto.randomUUID() });
    if (!res.ok) {
      setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, quantity: prev } : i)));
      return void toast.error(res.error);
    }
    setItems((cur) => cur.map((i) => (i.id === item.id ? res.data : i)));
    if (res.data.auto_listed) toast.success(`${item.name} ירד מתחת למינימום ונוסף לרשימת הקניות 🛒`);
  }

  async function toList(item: InventoryItem) {
    const res = await addInventoryItemToList(item.id);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.data.created ? `"${item.name}" נוסף לרשימת הקניות` : `"${item.name}" כבר ברשימה`);
  }

  return (
    <>
      <PageHeader
        title="מלאי הבית"
        subtitle={`${items.length} מוצרים`}
        back={{ href: "/household", label: "משק הבית" }}
        actions={
          <>
            <Link href="/inventory/setup" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ClipboardList /> הזנה מרוכזת
            </Link>
            <Button size="sm" onClick={() => setSheetOpen(true)}>
              <Plus /> מוצר
            </Button>
          </>
        }
      />

      <div className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        <Link href="/scan" className="pressable flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-[15px] font-medium">
          📷 סריקת מוצר
        </Link>
        <Link href="/receipts" className="pressable flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-[15px] font-medium">
          🧾 קבלה מהסופר
        </Link>
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Boxes />}
            title="המלאי עדיין ריק"
            description="הדביקו רשימה של מה שיש בבית — מקרר, מזווה, ניקיון — ו-HomeOS יתחיל לעקוב."
            action={
              <Link href="/inventory/setup" className={buttonVariants()}>
                <ClipboardList /> התחלת הזנה ראשונית
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש"
              aria-label="חיפוש במלאי"
              className="h-10 w-full rounded-xl bg-fill ps-10 pe-3 text-[17px] outline-none placeholder:text-muted focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <Segmented
            label="סינון"
            className="mb-3"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "הכול" },
              { value: "low", label: "חסר", count: counts.low },
              { value: "expiring", label: "תוקף", count: counts.expiring },
            ]}
          />
          <div className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {[{ id: "all", name: "כל המיקומים" }, ...locations, { id: "none", name: "ללא מיקום" }].map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLocation(l.id)}
                aria-pressed={location === l.id}
                className={cn(
                  "pressable h-8 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                  location === l.id ? "bg-primary text-primary-foreground" : "bg-fill text-foreground/75",
                )}
              >
                {l.name}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">אין מוצרים שמתאימים לסינון</p>
          ) : (
            <Card className="hairline-list-inset [--separator-inset:4.5rem]">
              {filtered.map((item) => {
                const level = stockLevel(item);
                const exp = expiryState(item.expires_on);
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Link href={`/inventory/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      {item.image_path ? (
                        <SignedImage path={item.image_path} alt={item.name} className="size-11 shrink-0 rounded-[12px]" />
                      ) : (
                        <div className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-fill text-[17px] font-semibold text-muted">{item.name.slice(0, 1)}</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[17px]">{item.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          {locName(item.location_id) && <span>{locName(item.location_id)}</span>}
                          {item.min_threshold != null ? (
                            <span className="num">מינימום {formatQuantity(item.min_threshold)}</span>
                          ) : (
                            <span className="text-muted-2">בלי מינימום</span>
                          )}
                          {level === "out" && <Badge tone="danger">נגמר</Badge>}
                          {level === "low" && <Badge tone="amber">נמוך</Badge>}
                          {exp?.state === "expired" && <Badge tone="danger">פג תוקף</Badge>}
                          {exp?.state === "soon" && <Badge tone="amber">תוקף {relativeDays(exp.days)}</Badge>}
                          {item.stock_confidence === "estimated" && <Badge>משוער</Badge>}
                        </div>
                      </div>
                    </Link>
                    {level !== "ok" && (
                      <Button size="icon-sm" variant="soft" aria-label={`הוספת ${item.name} לרשימת הקניות`} onClick={() => toList(item)}>
                        <ShoppingCart />
                      </Button>
                    )}
                    <div className="flex shrink-0 items-center rounded-full bg-fill">
                      <button
                        type="button"
                        onClick={() => quickMove(item, "consume")}
                        disabled={Number(item.quantity) <= 0}
                        className="grid size-9 place-items-center rounded-full text-muted transition hover:text-foreground active:scale-90 disabled:opacity-30"
                        aria-label={`השתמשנו ב-1 ${item.unit} ${item.name}`}
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="num min-w-12 text-center text-sm font-semibold">
                        {formatQuantity(item.quantity)}
                        <span className="ms-0.5 text-[10px] font-normal text-muted">{item.unit}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => quickMove(item, "add")}
                        className="grid size-9 place-items-center rounded-full text-muted transition hover:text-foreground active:scale-90"
                        aria-label={`הוספת 1 ${item.unit} ${item.name}`}
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}

      <InventoryItemSheet open={sheetOpen} onOpenChange={setSheetOpen} householdId={householdId} item={null} categories={categories} locations={locations} />
    </>
  );
}
