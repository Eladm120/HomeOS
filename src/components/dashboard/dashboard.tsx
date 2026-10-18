"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Boxes, CalendarClock, Check, ChevronLeft, Plus, Sparkles, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { addInventoryItemToList } from "@/server/actions/grocery";
import type { ActivityEvent, InventoryItem, ProductCategory, ShoppingListItem } from "@/lib/types";
import type { BriefLine } from "@/lib/daily-brief";
import { formatQuantityWithUnit, relativeDays } from "@/lib/format";
import { categoryStyle, productEmoji } from "@/lib/category-style";
import { describeActivity } from "@/lib/activity";
import { RelativeTime } from "@/components/ui/relative-time";
import { primeSignedUrls } from "@/lib/media";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/card";
import { SignedImage } from "@/components/media/signed-image";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SuggestionCard, type SuggestionView } from "@/components/intelligence/suggestions-view";
import { getWrittenBrief } from "@/server/actions/intelligence";

export interface DashboardModuleCard {
  key: string;
  title: string;
  href: string;
  /** Tailwind text colour class for the heading. */
  tint: string;
  rows: { id: string; title: string; detail?: string; badge?: { text: string; tone: "neutral" | "primary" | "sage" | "amber" | "danger" | "sky" }; href?: string }[];
  empty?: string;
}

export interface QuickActionDef {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export interface DashboardProps {
  greeting: string;
  dateLine: string;
  today: string;
  brief: BriefLine[];
  groceryCount: number;
  urgentCount: number;
  pendingGrocery: ShoppingListItem[];
  categories: ProductCategory[];
  needs: (InventoryItem & { onList: boolean })[];
  needsTotal: number;
  expiring: { id: string; name: string; days: number }[];
  inventoryCount: number;
  activity: ActivityEvent[];
  memberNames: Record<string, string>;
  members: { id: string; name: string }[];
  currentUserId: string;
  isAlone: boolean;
  isOwner: boolean;
  signedUrls: Record<string, string>;
  householdId: string;
  /** Cards contributed by other modules (tasks, repairs, bills, events…). Empty cards are hidden. */
  modules?: DashboardModuleCard[];
  quickActions?: QuickActionDef[];
  suggestions?: SuggestionView[];
  unreadNotifications?: number;
  aiEnabled?: boolean;
  /** Design preview renders without a live connection. */
  preview?: boolean;
}

function RealtimeSync({ householdId }: { householdId: string }) {
  useRealtimeRefresh("shopping_list_items", householdId);
  useRealtimeRefresh("inventory_items", householdId);
  return null;
}

export function Dashboard(p: DashboardProps) {
  useMemo(() => primeSignedUrls(p.signedUrls), [p.signedUrls]);
  const router = useRouter();
  const [added, setAdded] = useState<Set<string>>(new Set());

  const [written, setWritten] = useState<string | null>(null);
  useEffect(() => {
    if (!p.aiEnabled || p.preview || !p.brief.length) return;
    let alive = true;
    void getWrittenBrief(p.brief).then((r) => alive && r.ok && setWritten(r.data.text));
    return () => {
      alive = false;
    };
  }, [p.aiEnabled, p.preview, p.brief]);

  const briefKey = `homeos:brief-dismissed:${p.householdId}`;
  const [briefHidden, setBriefHidden] = useState(false);
  useEffect(() => {
    try {
      setBriefHidden(localStorage.getItem(briefKey) === p.today);
    } catch {
      /* storage unavailable */
    }
  }, [briefKey, p.today]);

  function dismissBrief() {
    setBriefHidden(true);
    try {
      localStorage.setItem(briefKey, p.today);
    } catch {
      /* ignore */
    }
  }

  async function addToList(item: InventoryItem) {
    if (p.preview) return void setAdded((s) => new Set(s).add(item.id));
    const res = await addInventoryItemToList(item.id);
    if (!res.ok) return void toast.error(res.error);
    setAdded((s) => new Set(s).add(item.id));
    toast.success(res.data.created ? `${item.name} נוסף לרשימה` : `${item.name} כבר ברשימה`);
    router.refresh();
  }

  const catById = useMemo(() => new Map(p.categories.map((c) => [c.id, c])), [p.categories]);
  const tiles = useMemo(() => {
    const counts = new Map<string | null, number>();
    for (const g of p.pendingGrocery) {
      const key = g.category_id && catById.has(g.category_id) ? g.category_id : null;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, n]) => ({ id, n, cat: id ? catById.get(id)! : null }))
      .sort((a, b) => (a.cat?.sort_order ?? 999) - (b.cat?.sort_order ?? 999));
  }, [p.pendingGrocery, catById]);

  const nameOf = (id: string | null) => (!id ? "" : p.memberNames[id] || "מישהו");
  const lowCount = p.needs.filter((n) => !n.onList && !added.has(n.id)).length;
  const modules = (p.modules ?? []).filter((m) => m.rows.length > 0);

  return (
    <div className="relative pb-6">
      {!p.preview && <RealtimeSync householdId={p.householdId} />}

      <header className="relative pt-[calc(env(safe-area-inset-top)+1rem)] pb-5 lg:pt-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] text-muted">{p.dateLine}</p>
            <h1 className="large-title mt-1 animate-fade-up text-balance">{p.greeting}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex -space-x-2.5 space-x-reverse" aria-label="חברי הבית">
              {p.members.slice(0, 4).map((m, i) => (
                <span
                  key={m.id}
                  title={m.name}
                  className={cn(
                    "grid size-9 place-items-center rounded-full text-[15px] font-bold ring-[2.5px] ring-background",
                    i % 2 === 0 ? "bg-primary text-primary-foreground" : "bg-[color-mix(in_oklab,var(--accent)_55%,var(--foreground))] text-background",
                  )}
                >
                  {m.name.slice(0, 1) || "?"}
                </span>
              ))}
            </div>
            <Link href="/notifications" className="glass pressable relative grid size-10 place-items-center rounded-full text-foreground/80" aria-label={p.unreadNotifications ? `התראות, ${p.unreadNotifications} חדשות` : "התראות"}>
              <Bell className="size-5" />
              {!!p.unreadNotifications && (
                <span className="num absolute -top-0.5 -end-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">{p.unreadNotifications > 9 ? "9+" : p.unreadNotifications}</span>
              )}
            </Link>
            <div className="lg:hidden">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {/* Today: one summary + three numbers */}
        {!briefHidden && (
          <section className="relative animate-fade-up rounded-[var(--radius)] border border-border bg-surface p-[18px] shadow-[var(--glass-shadow)]">
            <button type="button" onClick={dismissBrief} className="absolute end-3 top-3 grid size-8 place-items-center rounded-full bg-fill text-muted" aria-label="הסתרת הסיכום להיום">
              <X className="size-4" strokeWidth={2.5} />
            </button>
            <h2 className="mb-2 text-[13px] font-semibold text-primary">היום בבית</h2>
            {written ? (
              <div className="pe-8">
                <p className="text-[17px] leading-relaxed">{written}</p>
                <p className="caption mt-2 flex items-center gap-1 text-muted">
                  <Sparkles className="size-3" /> נוסח בעזרת AI מהנתונים שלכם
                </p>
              </div>
            ) : p.brief.length ? (
              <ul className="space-y-1.5 pe-8 text-[17px] leading-snug">
                {p.brief.map((l, i) => (
                  <li key={i}>
                    {l.text}
                    {l.kind === "estimate" && <Badge className="ms-1.5">הערכה</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pe-8 text-[17px] leading-snug">
                {p.inventoryCount === 0 && p.groceryCount === 0
                  ? "ברוכים הבאים הביתה. הוסיפו מוצר לקניות או הזינו את המלאי, ומחר בבוקר יחכה כאן סיכום."
                  : "הכל מסודר היום. אין חוסרים, תוקף קרוב או משימות דחופות."}
              </p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat href="/shopping" value={p.groceryCount} label="לקנות" />
              <Stat href="/shopping" value={p.urgentCount} label="דחופים" tone={p.urgentCount ? "text-danger" : undefined} />
              <Stat href="#needs" value={lowCount} label="עומדים להיגמר" tone={lowCount ? "text-amber" : undefined} />
            </div>
          </section>
        )}

        {/* Quick actions */}
        {p.quickActions && p.quickActions.length > 0 && (
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
            {p.quickActions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="pressable flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-[15px] font-medium [&_svg]:size-[18px] [&_svg]:text-primary"
              >
                {a.icon}
                {a.label}
              </Link>
            ))}
            {p.isAlone && p.isOwner && (
              <Link href="/household/settings" className="pressable flex h-10 shrink-0 items-center gap-2 rounded-full bg-primary-soft px-3.5 text-[15px] font-semibold text-primary [&_svg]:size-[18px]">
                <UserPlus /> הזמנת בן/בת זוג
              </Link>
            )}
          </div>
        )}

        {p.suggestions && p.suggestions.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="headline">שווה לשים לב</h2>
              <Link href="/suggestions" className="footnote flex items-center text-primary">
                הכל <ChevronLeft className="size-4" />
              </Link>
            </div>
            <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface [&>*+*]:border-t [&>*+*]:border-border">
              {p.suggestions.slice(0, 3).map((s) => (
                <SuggestionCard key={s.id} s={s} compact />
              ))}
            </div>
          </section>
        )}

        {/* Shopping list summary */}
        <section className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface p-[18px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="headline">רשימת הקניות</h2>
              <p className="footnote text-muted">
                {p.groceryCount ? `${p.groceryCount} פריטים${p.urgentCount ? ` · ${p.urgentCount} דחופים` : ""}` : "הרשימה ריקה"}
              </p>
            </div>
            <Link href="/shopping" className="pressable flex h-10 items-center rounded-full bg-primary px-4 text-[15px] font-semibold text-primary-foreground">
              לרשימה
            </Link>
          </div>
          {tiles.length > 0 && (
            <div className="scrollbar-none -mx-[18px] mt-4 flex gap-2 overflow-x-auto px-[18px]">
              {tiles.map((t) => {
                const s = categoryStyle(t.cat);
                return (
                  <Link
                    key={t.id ?? "none"}
                    href="/shopping"
                    className="cat-tint pressable flex w-[78px] shrink-0 flex-col items-center gap-1 rounded-[18px] px-1.5 pt-2.5 pb-2"
                    style={{ "--h": s.hue } as React.CSSProperties}
                  >
                    <span aria-hidden className="text-[30px] leading-none">
                      {s.emoji}
                    </span>
                    <span className="line-clamp-2 text-center text-[12px] leading-tight font-semibold">{t.cat?.name ?? "ללא קטגוריה"}</span>
                    <span className="num text-[12px] text-muted">{t.n}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Running low */}
        <section id="needs" className="scroll-mt-6">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="headline">עומד להיגמר</h2>
            <Link href="/inventory" className="footnote flex items-center text-primary">
              למלאי <ChevronLeft className="size-4" />
            </Link>
          </div>
          {p.needs.length ? (
            <div className="scrollbar-none -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
              {p.needs.map((i) => {
                const listed = i.onList || added.has(i.id);
                const out = Number(i.quantity) <= 0;
                const cat = i.category_id ? catById.get(i.category_id) : null;
                return (
                  <div key={i.id} className="flex w-[150px] shrink-0 flex-col gap-2 rounded-[var(--radius)] border border-border bg-surface p-3.5">
                    <Link href={`/inventory/${i.id}`} className="flex flex-col gap-1.5 active:opacity-70">
                      {i.image_path ? (
                        <SignedImage path={i.image_path} alt={i.name} className="size-10 rounded-[12px]" />
                      ) : (
                        <span aria-hidden className="text-[32px] leading-none">
                          {productEmoji(i.name, cat)}
                        </span>
                      )}
                      <span className="truncate font-semibold">{i.name}</span>
                      <span className={cn("footnote", out ? "text-danger" : "text-amber")}>
                        {out ? "נגמר" : `נשארו ${formatQuantityWithUnit(i.quantity, i.unit)}`}
                        {i.stock_confidence === "estimated" && " · משוער"}
                      </span>
                    </Link>
                    <button
                      type="button"
                      disabled={listed}
                      onClick={() => addToList(i)}
                      className="pressable mt-auto flex h-9 items-center justify-center gap-1 rounded-xl bg-primary-soft text-[14px] font-semibold text-primary disabled:bg-transparent disabled:text-muted"
                    >
                      {listed ? (
                        <>
                          <Check className="size-4" /> ברשימה
                        </>
                      ) : (
                        <>
                          <Plus className="size-4" /> לרשימה
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : p.inventoryCount === 0 ? (
            <Link href="/inventory/setup" className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-surface p-4 text-[15px] text-primary">
              <span className="flex items-center gap-2">
                <Boxes className="size-5" /> הזינו את המלאי כדי לדעת מה חסר
              </span>
              <ChevronLeft className="size-5" />
            </Link>
          ) : (
            <p className="rounded-[var(--radius)] border border-border bg-surface p-4 text-[15px] text-muted">אין מוצרים מתחת למינימום.</p>
          )}
        </section>

        {p.expiring.length > 0 && (
          <ModuleCard
            card={{
              key: "expiring",
              title: "תוקף קרוב",
              href: "/inventory",
              tint: "text-danger",
              rows: p.expiring.map((x) => ({
                id: x.id,
                title: x.name,
                href: `/inventory/${x.id}`,
                badge: { text: x.days < 0 ? "פג תוקף" : relativeDays(x.days), tone: x.days < 0 ? "danger" : "amber" },
              })),
            }}
            icon={<CalendarClock className="size-4" />}
          />
        )}

        {modules.map((m) => (
          <ModuleCard key={m.key} card={m} />
        ))}

        <section>
          <h2 className="headline mb-2 px-1">מה חדש בבית</h2>
          <div className="rounded-[var(--radius)] border border-border bg-surface px-4 py-1">
            {p.activity.length ? (
              <ol className="[&>*+*]:border-t [&>*+*]:border-border">
                {p.activity
                  .map((e) => ({ e, text: describeActivity(e) }))
                  .filter((x) => x.text)
                  .slice(0, 5)
                  .map(({ e, text }) => (
                    <li key={e.id} className="flex items-center gap-3 py-3 text-[15px]">
                      <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{nameOf(e.actor_id) || "המערכת"}</span>
                        <span className="text-muted"> · </span>
                        {text}
                      </span>
                      <span className="footnote shrink-0 text-muted">
                        <RelativeTime value={e.created_at} />
                      </span>
                    </li>
                  ))}
              </ol>
            ) : (
              <p className="py-3 text-[15px] text-muted">עדיין שקט כאן.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ href, value, label, tone }: { href: string; value: number; label: string; tone?: string }) {
  return (
    <Link href={href} className="pressable flex flex-col gap-0.5 rounded-2xl bg-surface-2 px-3 py-2.5">
      <span className={cn("num text-[24px] leading-tight font-extrabold", tone)}>{value}</span>
      <span className="text-[13px] leading-tight text-muted">{label}</span>
    </Link>
  );
}

function ModuleCard({ card, icon }: { card: DashboardModuleCard; icon?: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className={cn("headline flex items-center gap-1.5", card.tint)}>
          {icon}
          {card.title}
        </h2>
        <Link href={card.href} className="footnote flex items-center text-primary" aria-label={`פתיחת ${card.title}`}>
          הכל <ChevronLeft className="size-4" />
        </Link>
      </div>
      <ul className="rounded-[var(--radius)] border border-border bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-border">
        {card.rows.map((r) => {
          const inner = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px]">{r.title}</span>
                {r.detail && <span className="footnote block truncate text-muted">{r.detail}</span>}
              </span>
              {r.badge && <Badge tone={r.badge.tone}>{r.badge.text}</Badge>}
            </>
          );
          return (
            <li key={r.id}>
              {r.href ? (
                <Link href={r.href} className="flex min-h-12 items-center gap-3 py-2.5 active:opacity-60">
                  {inner}
                </Link>
              ) : (
                <div className="flex min-h-12 items-center gap-3 py-2.5">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
