"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, ChevronLeft, Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { AlertItem } from "@/lib/alerts";
import { completeChore } from "@/server/actions/chores";
import { relativeDays } from "@/lib/format";
import { primeSignedUrls } from "@/lib/media";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AlertList } from "@/components/alerts/alert-list";
import { CheckCircle } from "@/components/grocery/item-row";
import { RecipeImage } from "@/components/recipes/recipes-view";

export interface DashboardTask {
  id: string;
  title: string;
  /** Days from today: negative = late, 0 = today, 1 = tomorrow. */
  days: number;
  assigneeId: string | null;
  assigneeName: string | null;
  detail: string | null;
}

export interface DashboardMeal {
  id: string;
  title: string;
  slot: string;
  href: string;
  image_path: string | null;
  image_url: string | null;
}

export interface DashboardProps {
  greeting: string;
  dateLine: string;
  householdId: string;
  members: { id: string; name: string }[];
  currentUserId: string;
  isAlone: boolean;
  isOwner: boolean;
  alerts: AlertItem[];
  tasks: DashboardTask[];
  grocery: { count: number; urgent: number; inCart: number; items: { id: string; name: string; emoji: string }[] };
  meals: DashboardMeal[];
  signedUrls: Record<string, string>;
  /** First-week setup steps; the card hides itself when all are done or dismissed. */
  setup?: { key: string; label: string; href: string; done: boolean }[];
  unreadNotifications?: number;
  /** Design preview renders without a live connection. */
  preview?: boolean;
}

function RealtimeSync({ householdId }: { householdId: string }) {
  useRealtimeRefresh("shopping_list_items", householdId);
  useRealtimeRefresh("inventory_items", householdId);
  useRealtimeRefresh("chores", householdId);
  return null;
}

export function Dashboard(p: DashboardProps) {
  useMemo(() => primeSignedUrls(p.signedUrls), [p.signedUrls]);

  const actionable = p.alerts.filter((a) => !a.handled);
  const todayTasks = p.tasks.filter((t) => t.days <= 0);
  const topAlerts = [...actionable, ...p.alerts.filter((a) => a.handled)].filter((a) => a.group !== "chore").slice(0, 4);
  const otherAlertCount = p.alerts.filter((a) => a.group !== "chore").length;

  return (
    <div className="relative pb-6">
      {!p.preview && <RealtimeSync householdId={p.householdId} />}

      <header className="pt-[calc(env(safe-area-inset-top)+1rem)] pb-5 lg:pt-10">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14px] text-muted">{p.dateLine}</p>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/search" className="pressable grid size-10 place-items-center rounded-full bg-surface text-foreground/75 shadow-[var(--card-shadow)]" aria-label="חיפוש">
              <Search className="size-[19px]" />
            </Link>
            <Link
              href="/notifications"
              className="pressable relative grid size-10 place-items-center rounded-full bg-surface text-foreground/75 shadow-[var(--card-shadow)]"
              aria-label={p.unreadNotifications ? `התראות, ${p.unreadNotifications} חדשות` : "התראות"}
            >
              <Bell className="size-[19px]" />
              {!!p.unreadNotifications && (
                <span className="num absolute -top-1 -end-1 grid h-5 min-w-5 place-items-center rounded-full bg-terracotta px-1 text-[11px] font-bold text-white">
                  {p.unreadNotifications > 9 ? "9+" : p.unreadNotifications}
                </span>
              )}
            </Link>
            <div className="lg:hidden">
              <ThemeToggle />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <h1 className="large-title animate-fade-up text-balance">{p.greeting}</h1>
          <div className="mb-1 flex shrink-0 -space-x-2 space-x-reverse" aria-label="חברי הבית">
            {p.members.slice(0, 4).map((m, i) => (
              <Avatar key={m.id} name={m.name} index={i} className="size-9 text-[15px] ring-[2.5px] ring-background" />
            ))}
          </div>
        </div>
      </header>

      <div className="space-y-7">
        {/* At a glance */}
        <div className="grid grid-cols-3 gap-2.5">
          <GlanceTile href="/shopping" emoji="🛒" value={p.grocery.count} label="לקנות" tone="honey" />
          <GlanceTile href="#tasks" emoji="🧺" value={todayTasks.length} label="משימות היום" tone="sage" />
          <GlanceTile href="/notifications" emoji="🔔" value={actionable.length} label="לטיפול" tone="terracotta" />
        </div>

        {/* Needs attention */}
        <section>
          <SectionTitle title="דורש תשומת לב" href={otherAlertCount > topAlerts.length ? "/notifications" : undefined} more={otherAlertCount} />
          {topAlerts.length ? (
            <AlertList alerts={topAlerts} preview={p.preview} />
          ) : (
            <div className="card flex items-center gap-3 p-4">
              <span className="text-[28px]" aria-hidden>
                ☕
              </span>
              <span>
                <span className="block font-semibold">הכל רגוע בבית</span>
                <span className="footnote block text-muted">אין חוסרים, תשלומים או תוקף קרוב.</span>
              </span>
            </div>
          )}
        </section>

        {/* Today's tasks */}
        <TodayTasks tasks={p.tasks} members={p.members} currentUserId={p.currentUserId} preview={p.preview} />

        {/* Shopping */}
        <section>
          <SectionTitle title="רשימת הקניות" href="/shopping" more={p.grocery.count} />
          <Link href="/shopping" className="card pressable block overflow-hidden">
            <div className="flex items-center gap-3 bg-honey-soft px-4 py-3.5">
              <span className="text-[30px] leading-none" aria-hidden>
                🛒
              </span>
              <span className="min-w-0 flex-1">
                <span className="headline block">{p.grocery.count ? `${p.grocery.count} פריטים לקנות` : "הרשימה ריקה"}</span>
                <span className="footnote block text-muted">
                  {[p.grocery.urgent ? `${p.grocery.urgent} דחופים` : null, p.grocery.inCart ? `${p.grocery.inCart} כבר בעגלה` : null].filter(Boolean).join(" · ") || "מה שנגמר במלאי נכנס לכאן לבד"}
                </span>
              </span>
              <ChevronLeft className="size-5 text-muted" />
            </div>
            {p.grocery.items.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-3.5">
                {p.grocery.items.map((g) => (
                  <span key={g.id} className="flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[14px] font-medium">
                    <span aria-hidden>{g.emoji}</span>
                    {g.name}
                  </span>
                ))}
                {p.grocery.count > p.grocery.items.length && (
                  <span className="num flex h-8 items-center rounded-full px-2 text-[14px] text-muted">+{p.grocery.count - p.grocery.items.length}</span>
                )}
              </div>
            )}
          </Link>
        </section>

        {/* Today's food */}
        <section>
          <SectionTitle title="מה אוכלים היום" href="/meals" />
          {p.meals.length ? (
            <div className="space-y-2.5">
              {p.meals.map((m) => (
                <Link key={m.id} href={m.href} className="card pressable flex items-center gap-3 overflow-hidden p-2.5">
                  <RecipeImage r={{ title: m.title, image_path: m.image_path, image_url: m.image_url }} className="size-16 shrink-0 rounded-2xl text-[30px]" />
                  <span className="min-w-0 flex-1">
                    <span className="footnote block text-muted">{m.slot}</span>
                    <span className="headline block truncate">{m.title}</span>
                  </span>
                  <ChevronLeft className="me-1 size-5 text-muted-2" />
                </Link>
              ))}
            </div>
          ) : (
            <Link href="/meals" className="card pressable flex items-center gap-3 p-4">
              <span className="text-[28px]" aria-hidden>
                🍽️
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">עוד לא תכננתם</span>
                <span className="footnote block text-muted">בחרו מתכון, ומה שחסר לו יעבור לקניות</span>
              </span>
              <span className="text-[14px] font-semibold text-primary">לתכנון</span>
            </Link>
          )}
        </section>

        <SetupCard householdId={p.householdId} setup={p.setup} />

        {p.isAlone && p.isOwner && (
          <Link href="/household/settings" className="card pressable flex items-center gap-3 p-4 text-primary">
            <UserPlus className="size-5" />
            <span className="flex-1 font-semibold">להזמין את בן/בת הזוג לבית</span>
            <ChevronLeft className="size-5" />
          </Link>
        )}
      </div>
    </div>
  );
}

const TONES = {
  honey: "bg-honey-soft [--tone:var(--honey)]",
  sage: "bg-sage-soft [--tone:var(--sage)]",
  terracotta: "bg-terracotta-soft [--tone:var(--terracotta)]",
} as const;

function GlanceTile({ href, emoji, value, label, tone }: { href: string; emoji: string; value: number; label: string; tone: keyof typeof TONES }) {
  return (
    <Link href={href} className={cn("pressable flex flex-col gap-2 rounded-[1.25rem] p-3.5", TONES[tone])}>
      <span className="text-[22px] leading-none" aria-hidden>
        {emoji}
      </span>
      <span>
        <span className="num block text-[28px] leading-none font-bold text-[var(--tone)] [font-family:var(--font-display)]">{value}</span>
        <span className="mt-1 block text-[13px] leading-tight font-medium text-foreground/70">{label}</span>
      </span>
    </Link>
  );
}

function SectionTitle({ title, href, more }: { title: string; href?: string; more?: number }) {
  return (
    <div className="mb-2.5 flex items-center justify-between px-1">
      <h2 className="text-[19px] font-semibold [font-family:var(--font-display)]">{title}</h2>
      {href && (
        <Link href={href} className="flex items-center text-[14px] font-medium text-primary">
          {more ? <span className="num">הכל · {more}</span> : "הכל"}
          <ChevronLeft className="size-4" />
        </Link>
      )}
    </div>
  );
}

export function Avatar({ name, index, className }: { name: string; index: number; className?: string }) {
  const palette = ["bg-primary text-primary-foreground", "bg-terracotta text-white", "bg-honey text-white", "bg-sky text-white"];
  return (
    <span title={name} className={cn("grid shrink-0 place-items-center rounded-full font-bold", palette[index % palette.length], className)}>
      {name.slice(0, 1) || "?"}
    </span>
  );
}

/** Today's chores as a real checklist: tick to complete, the next date is scheduled automatically. */
function TodayTasks({ tasks, members, currentUserId, preview }: { tasks: DashboardTask[]; members: { id: string; name: string }[]; currentUserId: string; preview?: boolean }) {
  const router = useRouter();
  const [mine, setMine] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [gone, setGone] = useState<Set<string>>(new Set());

  const memberIndex = (id: string | null) => members.findIndex((m) => m.id === id);
  const visible = tasks.filter((t) => !gone.has(t.id) && (!mine || t.assigneeId === currentUserId || !t.assigneeId));
  const now = visible.filter((t) => t.days <= 0);
  const tomorrow = visible.filter((t) => t.days === 1);

  async function complete(t: DashboardTask) {
    if (done.has(t.id)) return;
    setDone((s) => new Set(s).add(t.id));
    if (!preview) {
      const res = await completeChore(t.id);
      if (!res.ok) {
        setDone((s) => {
          const n = new Set(s);
          n.delete(t.id);
          return n;
        });
        return void toast.error(res.error);
      }
      toast.success(`${t.title} ✓`);
    }
    setTimeout(() => {
      setGone((s) => new Set(s).add(t.id));
      if (!preview) router.refresh();
    }, 700);
  }

  const row = (t: DashboardTask) => {
    const isDone = done.has(t.id);
    const idx = memberIndex(t.assigneeId);
    return (
      <li key={t.id} className="flex min-h-[60px] items-center gap-3 px-3.5 py-2.5">
        <CheckCircle checked={isDone} onToggle={() => complete(t)} label={`סימון ${t.title} כבוצע`} />
        <Link href={`/chores/${t.id}`} className="min-w-0 flex-1 active:opacity-60">
          <span className={cn("block truncate text-[16px] font-medium transition-colors", isDone && "text-muted line-through")}>{t.title}</span>
          {t.detail && <span className="footnote block truncate text-muted">{t.detail}</span>}
        </Link>
        {t.days < 0 && !isDone && <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-[12px] font-semibold text-danger">{relativeDays(t.days)}</span>}
        {idx >= 0 ? (
          <Avatar name={t.assigneeName ?? ""} index={idx} className="size-7 text-[12px]" />
        ) : (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-fill text-[11px] font-semibold text-muted" title="משותף">
            👥
          </span>
        )}
      </li>
    );
  };

  return (
    <section id="tasks" className="scroll-mt-6">
      <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
        <h2 className="text-[19px] font-semibold [font-family:var(--font-display)]">המשימות של היום</h2>
        <div className="flex items-center gap-1.5">
          {members.length > 1 && (
            <div className="flex rounded-full bg-fill p-0.5 text-[13px] font-semibold" role="group" aria-label="של מי">
              {[
                { v: false, l: "כולם" },
                { v: true, l: "שלי" },
              ].map((o) => (
                <button
                  key={o.l}
                  type="button"
                  aria-pressed={mine === o.v}
                  onClick={() => setMine(o.v)}
                  className={cn("h-7 rounded-full px-3 transition-colors", mine === o.v ? "bg-surface shadow-sm" : "text-muted")}
                >
                  {o.l}
                </button>
              ))}
            </div>
          )}
          <Link href="/chores?new=1" className="pressable grid size-8 place-items-center rounded-full bg-primary text-primary-foreground" aria-label="משימה חדשה">
            <Plus className="size-4" strokeWidth={2.75} />
          </Link>
        </div>
      </div>

      {now.length ? (
        <ul className="card overflow-hidden [&>*+*]:border-t [&>*+*]:border-border">{now.map(row)}</ul>
      ) : (
        <div className="card flex items-center gap-3 p-4">
          <span className="grid size-10 place-items-center rounded-full bg-sage-soft text-sage">
            <Check className="size-5" strokeWidth={3} />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">אין משימות פתוחות להיום</span>
            <Link href="/chores" className="footnote text-primary">
              לכל המשימות
            </Link>
          </span>
        </div>
      )}

      {tomorrow.length > 0 && (
        <>
          <p className="footnote mt-3 mb-1.5 px-1 font-semibold text-muted">מחר</p>
          <ul className="card overflow-hidden opacity-90 [&>*+*]:border-t [&>*+*]:border-border">{tomorrow.map(row)}</ul>
        </>
      )}
    </section>
  );
}

function SetupCard({ householdId, setup }: { householdId: string; setup?: DashboardProps["setup"] }) {
  const key = `homeos:setup-hidden:${householdId}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key]);
  const left = (setup ?? []).filter((x) => !x.done);
  if (hidden || !left.length) return null;
  const total = (setup ?? []).length;

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="headline">בואו נסדר את הבית</h2>
          <p className="footnote text-muted">
            <span className="num">
              {total - left.length}/{total}
            </span>{" "}
            · אפשר בכל קצב
          </p>
        </div>
        <button
          type="button"
          className="footnote text-muted"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(key, "1");
            } catch {
              /* ignore */
            }
          }}
        >
          הסתרה
        </button>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-fill">
        <div className="h-full rounded-full bg-primary" style={{ width: `${((total - left.length) / total) * 100}%` }} />
      </div>
      <ul className="space-y-0.5">
        {left.slice(0, 3).map((x) => (
          <li key={x.key}>
            <Link href={x.href} className="flex items-center gap-3 rounded-xl px-1 py-2 active:bg-fill">
              <span className="size-5 shrink-0 rounded-full shadow-[inset_0_0_0_2px_var(--muted-2)]" />
              <span className="flex-1 text-[15px]">{x.label}</span>
              <ChevronLeft className="size-4 text-muted-2" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
