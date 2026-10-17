"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  Plus,
  ShoppingBasket,
  ShoppingCart,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { addInventoryItemToList } from "@/server/actions/grocery";
import type { ActivityEvent, InventoryItem, ShoppingListItem } from "@/lib/types";
import type { BriefLine } from "@/lib/daily-brief";
import { formatQuantityWithUnit, relativeDays } from "@/lib/format";
import { RelativeTime } from "@/components/ui/relative-time";
import { primeSignedUrls } from "@/lib/media";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/card";
import { SignedImage } from "@/components/media/signed-image";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ActivityRings } from "./activity-rings";

export interface DashboardProps {
  greeting: string;
  dateLine: string;
  today: string;
  brief: BriefLine[];
  groceryCount: number;
  urgentCount: number;
  recentGrocery: ShoppingListItem[];
  needs: (InventoryItem & { onList: boolean })[];
  needsTotal: number;
  expiring: { id: string; name: string; days: number }[];
  inventoryCount: number;
  health: { stock: number | null; verified: number | null; fresh: number | null };
  activity: ActivityEvent[];
  memberNames: Record<string, string>;
  members: { id: string; name: string }[];
  currentUserId: string;
  isAlone: boolean;
  isOwner: boolean;
  signedUrls: Record<string, string>;
  householdId: string;
  /** Design preview renders without a live connection. */
  preview?: boolean;
}

function describeActivity(e: ActivityEvent): string | null {
  const name = (e.summary.name as string | undefined) ?? "";
  switch (`${e.entity_type}:${e.action}`) {
    case "shopping_item:created":
      return `הוסיף/ה ${name} לקניות`;
    case "shopping_item:deleted":
      return `הסיר/ה ${name} מהרשימה`;
    case "shopping_item:status_changed":
      return e.summary.to === "purchased" ? `קנה/תה ${name}` : `החזיר/ה ${name} לרשימה`;
    case "inventory_item:created":
      return `הוסיף/ה ${name} למלאי`;
    case "inventory_item:archived":
      return `העביר/ה ${name} לארכיון`;
    case "inventory_item:deleted":
      return `מחק/ה ${name} מהמלאי`;
    case "household:created":
      return "יצר/ה את משק הבית";
    case "membership:joined":
      return "הצטרף/ה לבית";
    case "invitation:created":
      return "יצר/ה הזמנה";
    default:
      return null;
  }
}

const AVATAR_TINTS = ["from-[#ff9500] to-[#ff2d55]", "from-[#5856d6] to-[#007aff]", "from-[#34c759] to-[#30b0c7]", "from-[#af52de] to-[#ff2d55]"];

function RealtimeSync({ householdId }: { householdId: string }) {
  useRealtimeRefresh("shopping_list_items", householdId);
  useRealtimeRefresh("inventory_items", householdId);
  return null;
}

export function Dashboard(p: DashboardProps) {
  useMemo(() => primeSignedUrls(p.signedUrls), [p.signedUrls]);
  const router = useRouter();

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
    if (p.preview) return;
    const res = await addInventoryItemToList(item.id);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.data.created ? `${item.name} נוסף לקניות` : `${item.name} כבר ברשימה`);
    router.refresh();
  }

  const nameOf = (id: string | null) => (!id ? "" : id === p.currentUserId ? "את/ה" : p.memberNames[id] || "מישהו");
  const rings = [
    { label: "במלאי", value: p.health.stock, color: "#ff2d55", track: "rgba(255,45,85,0.22)" },
    { label: "נספר", value: p.health.verified, color: "#a6ff00", track: "rgba(166,255,0,0.2)" },
    { label: "טרי", value: p.health.fresh, color: "#00e5ff", track: "rgba(0,229,255,0.2)" },
  ];
  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

  return (
    <div className="relative pb-6">
      {!p.preview && <RealtimeSync householdId={p.householdId} />}
      <div className="aurora -mx-4 h-[420px] [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />

      {/* Header */}
      <header className="relative pt-[calc(env(safe-area-inset-top)+1rem)] pb-5 lg:pt-10">
        <div className="flex h-10 items-center justify-between">
          <div className="flex -space-x-2 space-x-reverse">
            {p.members.slice(0, 4).map((m, i) => (
              <span
                key={m.id}
                title={m.name}
                className={cn("grid size-9 place-items-center rounded-full bg-gradient-to-br text-[15px] font-semibold text-white ring-[2.5px] ring-background", AVATAR_TINTS[i % AVATAR_TINTS.length])}
              >
                {m.name.slice(0, 1) || "?"}
              </span>
            ))}
          </div>
          <div className="lg:hidden">
            <ThemeToggle />
          </div>
        </div>
        <p className="mt-4 text-[13px] font-semibold tracking-wide text-muted uppercase">{p.dateLine}</p>
        <h1 className="large-title mt-0.5 animate-fade-up">{p.greeting}</h1>
      </header>

      {/* Quick actions — Control Center style */}
      <div className="scrollbar-none relative -mx-4 mb-6 flex gap-4 overflow-x-auto px-4 pb-1">
        <QuickAction href="/shopping?new=1" icon={<Plus />} label="לקניות" tint="bg-primary text-white" />
        <QuickAction href="/shopping/mode" icon={<ShoppingCart />} label="מצב קנייה" tint="glass text-sage" />
        <QuickAction href="/inventory?new=1" icon={<Boxes />} label="למלאי" tint="glass text-amber" />
        <QuickAction href="/inventory/setup" icon={<ClipboardList />} label="הזנת מלאי" tint="glass text-sky" />
        {p.isAlone && p.isOwner && <QuickAction href="/household/settings" icon={<UserPlus />} label="הזמנה" tint="glass text-pink" />}
      </div>

      {/* Daily brief — Apple Intelligence glow */}
      {!briefHidden && (
        <section className="ai-glow relative mb-5 animate-fade-up rounded-[1.75rem] bg-surface p-5">
          <button type="button" onClick={dismissBrief} className="absolute end-3 top-3 grid size-8 place-items-center rounded-full bg-fill text-muted" aria-label="הסתרת הסיכום להיום">
            <X className="size-4" strokeWidth={2.5} />
          </button>
          <div className="mb-2.5 flex items-center gap-2">
            <Sparkles className="size-[18px] text-purple" />
            <span className="bg-gradient-to-l from-[#ff9500] via-[#ff2d55] to-[#5856d6] bg-clip-text text-[15px] font-semibold text-transparent">הסיכום של היום</span>
          </div>
          {p.brief.length ? (
            <ul className="space-y-2 pe-6 text-[17px] leading-snug">
              {p.brief.map((l, i) => (
                <li key={i}>
                  {l.text}
                  {l.kind === "estimate" && <Badge className="ms-1.5">הערכה</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="pe-6 text-[17px] leading-snug">
              {p.inventoryCount === 0 && p.groceryCount === 0
                ? "ברוכים הבאים הביתה. הוסיפו מוצר לקניות או הזינו את המלאי, ומחר בבוקר יחכה כאן סיכום."
                : "הכול מסודר היום. אין חוסרים, תוקף קרוב או קניות דחופות."}
            </p>
          )}
          <p className="caption mt-3 text-muted">מבוסס רק על הנתונים שלכם</p>
        </section>
      )}

      {/* Widgets */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Grocery count widget */}
        <Link href="/shopping" className="pressable col-span-1 flex aspect-square flex-col justify-between rounded-[1.75rem] bg-gradient-to-br from-[#0a84ff] to-[#5856d6] p-4 text-white shadow-[0_12px_32px_-12px_rgba(10,132,255,0.6)]">
          <div className="flex items-center justify-between">
            <ShoppingBasket className="size-6" />
            {p.urgentCount > 0 && <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-semibold">{p.urgentCount} דחוף</span>}
          </div>
          <div>
            <div className="num text-[44px] leading-none font-bold tracking-tight">{p.groceryCount}</div>
            <div className="mt-1 text-[15px] font-medium text-white/85">{p.groceryCount === 1 ? "מוצר לקנות" : "מוצרים לקנות"}</div>
          </div>
        </Link>

        {/* Inventory health rings widget */}
        <Link href="/inventory" className="pressable col-span-1 flex aspect-square flex-col rounded-[1.75rem] bg-black p-4 text-white">
          <div className="text-[13px] font-semibold text-white/70">בריאות המלאי</div>
          <div className="flex flex-1 items-center justify-center gap-3">
            <ActivityRings rings={rings} size={92} />
            <dl className="space-y-1 text-[11px] leading-tight">
              {rings.map((r) => (
                <div key={r.label}>
                  <dt className="text-white/60">{r.label}</dt>
                  <dd className="num text-[15px] font-bold" style={{ color: r.color }}>
                    {pct(r.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Link>

        {/* Recently added to grocery */}
        <Widget className="col-span-2" title="נוסף לאחרונה לקניות" href="/shopping" tint="text-primary">
          {p.recentGrocery.length ? (
            <ul className="hairline-list-inset [--separator-inset:3.75rem]">
              {p.recentGrocery.map((g) => (
                <li key={g.id}>
                  <Link href="/shopping" className="flex items-center gap-3 py-2 active:opacity-60">
                    <Thumb path={g.image_path} name={g.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px]">{g.name}</span>
                      <span className="footnote block text-muted">
                        {nameOf(g.added_by)} · <RelativeTime value={g.created_at} />
                      </span>
                    </span>
                    <span className="num text-[15px] text-muted">{formatQuantityWithUnit(g.quantity, g.unit)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-[15px] text-muted">הרשימה ריקה. מה שתוסיפו יופיע כאן אצל שניכם.</p>
          )}
        </Widget>

        {/* Running low */}
        <Widget
          className="col-span-2"
          title="עומד להיגמר"
          href="/inventory"
          tint="text-amber"
          trailing={p.needsTotal ? <span className="num">{p.needsTotal}</span> : undefined}
        >
          {p.needs.length ? (
            <ul className="hairline-list-inset [--separator-inset:3.75rem]">
              {p.needs.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2">
                  <Link href={`/inventory/${i.id}`} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-60">
                    <Thumb path={i.image_path} name={i.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px]">{i.name}</span>
                      <span className={cn("footnote block", Number(i.quantity) <= 0 ? "text-danger" : "text-amber")}>
                        {Number(i.quantity) <= 0 ? "נגמר" : `נשארו ${formatQuantityWithUnit(i.quantity, i.unit)}`}
                        {i.stock_confidence === "estimated" && " · משוער"}
                      </span>
                    </span>
                  </Link>
                  {i.onList ? (
                    <Badge tone="sage">ברשימה</Badge>
                  ) : (
                    <button type="button" onClick={() => addToList(i)} className="pressable grid size-8 place-items-center rounded-full bg-primary text-white" aria-label={`הוספת ${i.name} לקניות`}>
                      <Plus className="size-[18px]" strokeWidth={2.75} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : p.inventoryCount === 0 ? (
            <Link href="/inventory/setup" className="flex items-center justify-between py-3 text-[15px] text-primary">
              הזינו את המלאי כדי לדעת מה חסר
              <ChevronLeft className="size-5" />
            </Link>
          ) : (
            <p className="py-3 text-[15px] text-muted">אין מוצרים מתחת למינימום.</p>
          )}
        </Widget>

        {p.expiring.length > 0 && (
          <Widget className="col-span-2 lg:col-span-2" title="תוקף קרוב" icon={<CalendarClock className="size-4" />} tint="text-danger">
            <ul className="hairline-list">
              {p.expiring.map((x) => (
                <li key={x.id}>
                  <Link href={`/inventory/${x.id}`} className="flex items-center justify-between py-2.5 active:opacity-60">
                    <span className="truncate text-[17px]">{x.name}</span>
                    <Badge tone={x.days < 0 ? "danger" : "amber"}>{x.days < 0 ? `פג ${relativeDays(x.days)}` : relativeDays(x.days)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Widget>
        )}

        <Widget className="col-span-2 lg:col-span-2" title="מה קרה בבית" tint="text-muted">
          <ol className="relative space-y-3 py-1 before:absolute before:inset-y-2 before:start-[5px] before:w-px before:bg-border">
            {p.activity.map((e) => {
              const text = describeActivity(e);
              if (!text) return null;
              return (
                <li key={e.id} className="relative flex gap-3 ps-0 text-[15px]">
                  <span className="relative z-10 mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-surface bg-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{nameOf(e.actor_id) || "המערכת"}</span> {text}
                    <span className="footnote ms-1.5 text-muted"><RelativeTime value={e.created_at} /></span>
                  </span>
                </li>
              );
            })}
            {p.activity.length === 0 && <li className="text-[15px] text-muted">עדיין שקט כאן.</li>}
          </ol>
        </Widget>
      </div>
    </div>
  );
}

function Widget({
  title,
  href,
  tint,
  icon,
  trailing,
  className,
  children,
}: {
  title: string;
  href?: string;
  tint: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-[1.75rem] bg-surface px-4 pt-3.5 pb-2", className)}>
      <div className="mb-1 flex items-center justify-between">
        <h2 className={cn("flex items-center gap-1.5 text-[15px] font-semibold", tint)}>
          {icon}
          {title}
          {trailing && <span className="text-muted">· {trailing}</span>}
        </h2>
        {href && (
          <Link href={href} className="-me-1 grid size-8 place-items-center rounded-full text-muted-2 active:bg-fill" aria-label={`פתיחת ${title}`}>
            <ChevronLeft className="size-5" strokeWidth={2.5} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Thumb({ path, name }: { path: string | null; name: string }) {
  return path ? (
    <SignedImage path={path} alt={name} className="size-11 shrink-0 rounded-[12px]" />
  ) : (
    <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-fill text-[17px] font-semibold text-muted">{name.slice(0, 1)}</span>
  );
}

function QuickAction({ href, icon, label, tint }: { href: string; icon: React.ReactNode; label: string; tint: string }) {
  return (
    <Link href={href} className="flex w-[68px] shrink-0 flex-col items-center gap-1.5 active:opacity-70">
      <span className={cn("pressable grid size-[60px] place-items-center rounded-full [&_svg]:size-6", tint)}>{icon}</span>
      <span className="truncate text-[12px] font-medium text-foreground/80">{label}</span>
    </Link>
  );
}
