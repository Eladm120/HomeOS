"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  Plus,
  ShoppingCart,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { addInventoryItemToList } from "@/server/actions/grocery";
import type { ActivityEvent, InventoryItem, ShoppingListItem } from "@/lib/types";
import type { BriefLine } from "@/lib/daily-brief";
import { formatQuantityWithUnit, relativeDays, timeAgo } from "@/lib/format";
import { primeSignedUrls } from "@/lib/media";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { cn } from "@/lib/utils";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignedImage } from "@/components/media/signed-image";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface Props {
  greeting: string;
  dateLine: string;
  today: string;
  brief: BriefLine[];
  groceryCount: number;
  groceryPreview: string[];
  recentGrocery: ShoppingListItem[];
  needs: (InventoryItem & { onList: boolean })[];
  needsTotal: number;
  expiring: { id: string; name: string; days: number }[];
  inventoryCount: number;
  activity: ActivityEvent[];
  memberNames: Record<string, string>;
  currentUserId: string;
  isAlone: boolean;
  isOwner: boolean;
  signedUrls: Record<string, string>;
  householdId: string;
}

function describeActivity(e: ActivityEvent): string | null {
  const name = (e.summary.name as string | undefined) ?? "";
  switch (`${e.entity_type}:${e.action}`) {
    case "shopping_item:created":
      return `הוסיף/ה "${name}" לרשימת הקניות`;
    case "shopping_item:deleted":
      return `הסיר/ה "${name}" מהרשימה`;
    case "shopping_item:status_changed":
      return e.summary.to === "purchased" ? `קנה/תה "${name}"` : `החזיר/ה "${name}" לרשימה`;
    case "inventory_item:created":
      return `הוסיף/ה "${name}" למלאי`;
    case "inventory_item:archived":
      return `העביר/ה "${name}" לארכיון`;
    case "inventory_item:deleted":
      return `מחק/ה "${name}" מהמלאי`;
    case "household:created":
      return `יצר/ה את משק הבית`;
    case "membership:joined":
      return `הצטרף/ה למשק הבית`;
    case "invitation:created":
      return `יצר/ה הזמנה חדשה`;
    default:
      return null;
  }
}

export function Dashboard(p: Props) {
  useMemo(() => primeSignedUrls(p.signedUrls), [p.signedUrls]);
  useRealtimeRefresh("shopping_list_items", p.householdId);
  const router = useRouter();

  const briefKey = `homeos:brief-dismissed:${p.householdId}`;
  const [briefHidden, setBriefHidden] = useState(true);
  useEffect(() => {
    try {
      setBriefHidden(localStorage.getItem(briefKey) === p.today);
    } catch {
      setBriefHidden(false);
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
    const res = await addInventoryItemToList(item.id);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.data.created ? `"${item.name}" נוסף לרשימה` : `"${item.name}" כבר ברשימה`);
    router.refresh();
  }

  const nameOf = (id: string | null) => (!id ? "" : id === p.currentUserId ? "את/ה" : p.memberNames[id] || "מישהו");

  return (
    <div className="pb-6">
      <header className="flex items-start gap-3 pt-7 pb-6 lg:pt-10">
        <div className="min-w-0 flex-1 animate-fade-up">
          <p className="text-sm text-muted">{p.dateLine}</p>
          <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight lg:text-4xl">{p.greeting}</h1>
        </div>
        <div className="lg:hidden">
          <ThemeToggle />
        </div>
      </header>

      {/* Quick actions */}
      <div className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <QuickAction href="/shopping?new=1" icon={<Plus />} label="מוצר לקניות" primary />
        <QuickAction href="/shopping/mode" icon={<ShoppingCart />} label="מצב קנייה" />
        <QuickAction href="/inventory?new=1" icon={<Boxes />} label="מוצר למלאי" />
        <QuickAction href="/inventory/setup" icon={<ClipboardList />} label="הזנת מלאי" />
        {p.isAlone && p.isOwner && <QuickAction href="/household/settings" icon={<UserPlus />} label="הזמנת בן/בת זוג" />}
      </div>

      {/* Daily brief */}
      {!briefHidden && (
        <Card className="relative mb-4 overflow-hidden border-primary/15 bg-gradient-to-bl from-primary-soft via-surface to-surface p-5 animate-fade-up">
          <button type="button" onClick={dismissBrief} className="absolute end-3 top-3 grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="הסתרת הסיכום להיום">
            <X className="size-4" />
          </button>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles className="size-4" /> הסיכום של היום
          </div>
          {p.brief.length ? (
            <ul className="space-y-1.5 pe-6 text-[15px] leading-relaxed">
              {p.brief.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span>
                    {l.text}
                    {l.kind === "estimate" && <Badge className="ms-1.5">הערכה</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pe-6 text-[15px] text-foreground/85">
              {p.inventoryCount === 0 && p.groceryCount === 0
                ? "ברוכים הבאים! התחילו בהזנת המלאי או בהוספת מוצר לרשימת הקניות — ומחר בבוקר יחכה כאן סיכום אמיתי."
                : "הכול נראה מסודר היום. אין מוצרים חסרים, תוקף קרוב או קניות דחופות. ☀️"}
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted">מבוסס רק על הנתונים שהזנתם · עוזר ה-AI יגיע בשלב הבא</p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Grocery */}
        <Card>
          <CardHeader
            title="רשימת קניות"
            icon={<ShoppingCart />}
            subtitle={p.groceryCount ? `${p.groceryCount} מוצרים ממתינים` : "הרשימה ריקה"}
            action={<CardLink href="/shopping" />}
          />
          {p.recentGrocery.length ? (
            <ul className="px-3 pb-3">
              {p.recentGrocery.map((g) => (
                <li key={g.id}>
                  <Link href="/shopping" className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-2/60">
                    {g.image_path ? (
                      <SignedImage path={g.image_path} alt={g.name} className="size-10 shrink-0 rounded-xl" />
                    ) : (
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-sm font-semibold text-muted">{g.name.slice(0, 1)}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{g.name}</span>
                      <span className="block text-xs text-muted">
                        {nameOf(g.added_by)} · {timeAgo(g.created_at)}
                      </span>
                    </span>
                    <span className="num text-sm text-muted">{formatQuantityWithUnit(g.quantity, g.unit)}</span>
                  </Link>
                </li>
              ))}
              {p.groceryCount > p.recentGrocery.length && (
                <li className="px-2 pt-1 text-xs text-muted">ועוד {p.groceryCount - p.recentGrocery.length}…</li>
              )}
            </ul>
          ) : (
            <EmptyState className="py-8" icon={<ShoppingCart />} title="אין מה לקנות" description="מוצרים שתוסיפו יופיעו כאן אצל שניכם." />
          )}
        </Card>

        {/* Needs restock */}
        <Card>
          <CardHeader
            title="חסר או עומד להיגמר"
            icon={<AlertTriangle />}
            subtitle={p.inventoryCount ? (p.needsTotal ? `${p.needsTotal} מוצרים` : "הכול במלאי") : "המלאי עוד לא הוזן"}
            action={<CardLink href="/inventory" />}
          />
          {p.needs.length ? (
            <ul className="px-3 pb-3">
              {p.needs.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                  <Link href={`/inventory/${i.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    {i.image_path ? (
                      <SignedImage path={i.image_path} alt={i.name} className="size-10 shrink-0 rounded-xl" />
                    ) : (
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-sm font-semibold text-muted">{i.name.slice(0, 1)}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{i.name}</span>
                      <span className={cn("block text-xs", Number(i.quantity) <= 0 ? "text-danger" : "text-amber")}>
                        {Number(i.quantity) <= 0 ? "נגמר" : `נשארו ${formatQuantityWithUnit(i.quantity, i.unit)}`}
                        {i.stock_confidence === "estimated" && " (משוער)"}
                      </span>
                    </span>
                  </Link>
                  {i.onList ? (
                    <Badge tone="sage">ברשימה</Badge>
                  ) : (
                    <Button size="sm" variant="soft" onClick={() => addToList(i)}>
                      <Plus /> לקניות
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : p.inventoryCount === 0 ? (
            <EmptyState
              className="py-8"
              icon={<Boxes />}
              title="בואו נכיר את הבית"
              description="הזינו את המלאי הקיים כדי ש-HomeOS ידע מה עומד להיגמר."
              action={
                <Link href="/inventory/setup" className="text-sm font-medium text-primary">
                  התחלת הזנה ←
                </Link>
              }
            />
          ) : (
            <p className="px-5 pb-5 text-sm text-muted">
              אין מוצרים מתחת למינימום. הגדירו &quot;התראה כשנשאר&quot; במוצרים חשובים כדי לקבל התראה בזמן.
            </p>
          )}
        </Card>

        {/* Expiring */}
        {p.expiring.length > 0 && (
          <Card>
            <CardHeader title="תוקף קרוב" icon={<CalendarClock />} subtitle={`${p.expiring.length} מוצרים`} />
            <ul className="px-3 pb-3">
              {p.expiring.map((x) => (
                <li key={x.id}>
                  <Link href={`/inventory/${x.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-surface-2/60">
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{x.name}</span>
                    <Badge tone={x.days < 0 ? "danger" : "amber"}>{x.days < 0 ? `פג ${relativeDays(x.days)}` : relativeDays(x.days)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Activity */}
        <Card>
          <CardHeader title="מה קרה בבית" icon={<Activity />} />
          <ul className="px-5 pb-4">
            {p.activity.map((e) => {
              const text = describeActivity(e);
              if (!text) return null;
              return (
                <li key={e.id} className="flex gap-3 py-2 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-surface-3" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{nameOf(e.actor_id) || "המערכת"}</span> {text}
                    <span className="ms-1.5 text-xs text-muted">{timeAgo(e.created_at)}</span>
                  </span>
                </li>
              );
            })}
            {p.activity.length === 0 && <li className="py-2 text-sm text-muted">עדיין שקט כאן.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label, primary }: { href: string; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium shadow-soft transition active:scale-95 [&_svg]:size-4",
        primary ? "bg-primary text-primary-foreground" : "border border-border/70 bg-surface hover:bg-surface-2",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

function CardLink({ href }: { href: string }) {
  return (
    <Link href={href} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="פתיחה">
      <ChevronLeft className="size-5" />
    </Link>
  );
}
