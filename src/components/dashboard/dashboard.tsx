"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChefHat, Hammer, Lightbulb, ListChecks, Search, ShoppingBasket, SlidersHorizontal, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { buildBrief, DEFAULT_LAYOUT, type DashboardLayout, type WidgetId } from "@/lib/dashboard";
import { primeSignedUrls } from "@/lib/media";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { saveDashboardLayout } from "@/server/actions/dashboard";
import { BriefCard, SetupStrip, StarterCard, useDismissed, type BriefChip } from "./brief";
import { CustomizeSheet } from "./customize-sheet";
import { QuickActions } from "./quick-actions";
import { HomeHero, STAT_ICONS, type HeroStat } from "./home-hero";
import { periodFromGreeting } from "./house-scene";
import { AttentionWidget, Avatar, BillsWidget, EmptyTile, GroceryWidget, LowStockWidget, MealsWidget, ProjectsWidget, SmartHomeWidget, TasksWidget, WidgetError, type EmptyTileProps } from "./widgets";
import type { AlertItem } from "@/lib/alerts";
import type { DashboardProps } from "./types";

export type { DashboardMeal, DashboardProps, DashboardTask } from "./types";
export { Avatar } from "./widgets";

function RealtimeSync({ householdId }: { householdId: string }) {
  useRealtimeRefresh("shopping_list_items", householdId);
  useRealtimeRefresh("inventory_items", householdId);
  useRealtimeRefresh("chores", householdId);
  useRealtimeRefresh("smart_home_devices", householdId);
  return null;
}

const WIDGET_TITLE: Record<WidgetId, string> = {
  grocery: "רשימת הקניות",
  tasks: "משימות",
  meals: "ארוחות",
  lowstock: "מלאי נמוך",
  bills: "תשלומים קרובים",
  attention: "דורש טיפול",
  smarthome: "בית חכם",
  projects: "פרויקטים",
};

/**
 * The home screen: who and when, the day's brief, four quick starts, then the
 * member's own widgets in their own order. Widgets with nothing to show fold
 * into small tiles instead of taking half the screen.
 */
export function Dashboard(p: DashboardProps) {
  useMemo(() => primeSignedUrls(p.signedUrls), [p.signedUrls]);
  const router = useRouter();

  // ---- Layout (personal, saved in the background) ----
  const [layout, setLayout] = useState<DashboardLayout>(p.layout);
  const [customize, setCustomize] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);
  useEffect(() => () => void (saveTimer.current && clearTimeout(saveTimer.current)), []);
  function changeLayout(next: DashboardLayout) {
    setLayout(next);
    if (p.preview) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = window.setTimeout(async () => {
      const res = await saveDashboardLayout(next);
      setSaving(false);
      if (!res.ok) toast.error(res.error);
    }, 500);
  }

  // ---- Brief ----
  const ready = p.hasStock ? (p.readyRecipes[0] ?? null) : null;
  const brief = useMemo(
    () =>
      buildBrief({
        alerts: p.alerts,
        tasks: p.tasks,
        grocery: p.grocery,
        meals: p.meals,
        readyRecipe: ready ? { title: ready.title, href: `/recipes/${ready.id}` } : null,
      }),
    [p.alerts, p.tasks, p.grocery, p.meals, ready],
  );
  const todayOpen = p.tasks.filter((t) => t.days <= 0).length;
  // The brief's next steps: always the same three doors, the most relevant first.
  const chips: BriefChip[] = [
    { key: "g", icon: ShoppingBasket, text: "הוספה לסופר", href: "/shopping" },
    { key: "m", icon: UtensilsCrossed, text: p.meals.length ? "לתפריט השבוע" : "תכנון ארוחה", href: "/meals" },
    { key: "t", icon: ListChecks, text: todayOpen ? `משימות (${todayOpen})` : "משימות", href: todayOpen ? "#tasks" : "/chores" },
  ];
  // "אלעד ונעה": everyone at home, first names, me first.
  const firstNames = [...p.members].sort((a, b) => Number(b.id === p.currentUserId) - Number(a.id === p.currentUserId)).map((m) => m.name.trim().split(/\s+/)[0]).filter(Boolean);
  const names = firstNames.length > 1 ? `${firstNames.slice(0, -1).join(", ")} ו${firstNames[firstNames.length - 1]}` : (firstNames[0] ?? p.userName.trim().split(/\s+/)[0] ?? "");
  const heroStats: HeroStat[] = [
    { key: "g", icon: STAT_ICONS.grocery, value: p.grocery.count, label: "לקנות", href: "/shopping" },
    { key: "t", icon: STAT_ICONS.tasks, value: todayOpen, label: "משימות היום", href: "/chores" },
    { key: "m", icon: STAT_ICONS.meals, value: p.meals.length, label: p.meals.length === 1 ? "ארוחה היום" : "ארוחות היום", href: "/meals" },
  ];

  const [starterHidden, hideStarter] = useDismissed(`homeos:starter-hidden:${p.householdId}`);
  const [setupHidden, hideSetup] = useDismissed(`homeos:setup-hidden:${p.householdId}`);
  const recipesSaved = p.setup.find((s) => s.key === "recipes")?.done ?? false;

  // Stock and payments get their own widgets (when shown); chores live in the tasks
  // widget; attention keeps the rest that the brief did not already raise.
  const rank = { now: 0, soon: 1 };
  const byUrgency = (a: AlertItem, b: AlertItem) => Number(!!a.handled) - Number(!!b.handled) || rank[a.urgency] - rank[b.urgency];
  const stockAlerts = useMemo(() => p.alerts.filter((a) => a.group === "stock" || a.group === "expiry").sort(byUrgency), [p.alerts]); // eslint-disable-line react-hooks/exhaustive-deps
  const moneyAlerts = useMemo(() => p.alerts.filter((a) => a.group === "money").sort(byUrgency), [p.alerts]); // eslint-disable-line react-hooks/exhaustive-deps
  const ownWidget = (g: AlertItem["group"]) => ((g === "stock" || g === "expiry") && !layout.hidden.includes("lowstock")) || (g === "money" && !layout.hidden.includes("bills"));
  const attention = useMemo(
    () => p.alerts.filter((a) => a.group !== "chore" && !ownWidget(a.group) && !brief.usedAlertKeys.includes(a.key)).sort(byUrgency),
    [p.alerts, brief.usedAlertKeys, layout.hidden], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ---- Widgets ----
  const unavailable: Partial<Record<WidgetId, string>> = {};
  const tiles: EmptyTileProps[] = [];
  const blocks: React.ReactNode[] = [];

  for (const id of layout.order) {
    if (layout.hidden.includes(id)) continue;
    if (p.failed.includes(id)) {
      blocks.push(<WidgetError key={id} title={WIDGET_TITLE[id]} onRetry={() => router.refresh()} />);
      continue;
    }
    switch (id) {
      case "grocery":
        blocks.push(<GroceryWidget key={id} grocery={p.grocery} categories={p.categories} inventory={p.inventory} preview={p.preview} />);
        break;
      case "tasks":
        if (p.tasks.length || p.tasksDoneToday) blocks.push(<TasksWidget key={id} tasks={p.tasks} doneToday={p.tasksDoneToday} members={p.members} currentUserId={p.currentUserId} preview={p.preview} />);
        else {
          unavailable.tasks = "אין משימות להיום";
          tiles.push({ key: id, icon: ListChecks, title: "משימות", text: "אין להיום · הוספה", href: "/chores?new=1", hue: 75 });
        }
        break;
      case "meals":
        if (p.meals.length || (p.hasStock && p.readyRecipes.length)) blocks.push(<MealsWidget key={id} meals={p.meals} ready={p.hasStock ? p.readyRecipes : []} />);
        else {
          unavailable.meals = "לא תוכננה ארוחה להיום";
          tiles.push(
            recipesSaved
              ? { key: id, icon: UtensilsCrossed, title: "ארוחות", text: "מה אוכלים היום?", href: "/meals", hue: 40 }
              : { key: id, icon: ChefHat, title: "מתכונים", text: "לשמור מתכון ראשון", href: "/recipes/new", hue: 15 },
          );
        }
        break;
      case "lowstock":
        if (stockAlerts.length) blocks.push(<LowStockWidget key={id} alerts={stockAlerts.slice(0, 8)} preview={p.preview} />);
        else unavailable.lowstock = "שום דבר לא חסר";
        break;
      case "bills":
        if (moneyAlerts.length) blocks.push(<BillsWidget key={id} alerts={moneyAlerts.slice(0, 4)} preview={p.preview} />);
        else unavailable.bills = "אין תשלומים בשבוע הקרוב";
        break;
      case "attention":
        if (attention.length) blocks.push(<AttentionWidget key={id} alerts={attention.slice(0, 4)} total={attention.length} preview={p.preview} />);
        else unavailable.attention = "אין כרגע מה לטפל";
        break;
      case "smarthome":
        if (p.smartHome.connected && p.smartHome.devices.length) blocks.push(<SmartHomeWidget key={id} devices={p.smartHome.devices} preview={p.preview} />);
        else {
          unavailable.smarthome = p.smartHome.connected ? "אין מכשירים מוצמדים" : "לא מחובר עדיין";
          if (p.stage !== "new")
            tiles.push(
              p.smartHome.connected
                ? { key: id, icon: Lightbulb, title: "בית חכם", text: "לבחור מכשירים", href: "/smart-home", hue: 280 }
                : { key: id, icon: Lightbulb, title: "בית חכם", text: p.isOwner ? "לחבר מזגן ותאורה" : "עוד לא מחובר", href: p.isOwner ? "/settings/integrations" : "/smart-home", hue: 280 },
            );
        }
        break;
      case "projects":
        if (p.projects.length || p.purchases.length) blocks.push(<ProjectsWidget key={id} projects={p.projects} purchases={p.purchases} />);
        else {
          unavailable.projects = "אין פרויקטים פעילים";
          if (p.stage !== "new") tiles.push({ key: id, icon: Hammer, title: "פרויקטים", text: "תיקון או שיפוץ", href: "/projects?new=1", hue: 30 });
        }
        break;
    }
  }

  const showStarter = p.stage === "new" && !starterHidden;
  let i = 0;
  const stagger = () => ({ "--i": i++ }) as React.CSSProperties;

  return (
    <div className="relative pb-4">
      {!p.preview && <RealtimeSync householdId={p.householdId} />}
      {/* Personal header: who's home, when, and the two doors (search, notifications) */}
      <header className="flex items-center gap-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-5 lg:pt-8">
        <Link href="/household/settings" className="flex shrink-0 -space-x-3 space-x-reverse" aria-label="חברי הבית">
          {p.members.slice(0, 3).map((m, idx) => (
            <Avatar key={m.id} name={m.name} index={idx} className="size-11 text-[16px] ring-[3px] ring-background" />
          ))}
        </Link>
        <div className="min-w-0 flex-1 animate-fade-up">
          <p className="truncate text-[13px] text-muted">{p.greeting},</p>
          <h1 className="truncate text-[22px] leading-tight font-bold tracking-[-0.02em] [font-family:var(--font-display)]">{names || "ברוכים הבאים"}</h1>
        </div>
        <Link href="/search" className="pressable grid size-11 shrink-0 place-items-center rounded-full bg-surface text-foreground/85 shadow-[var(--card-shadow)]" aria-label="חיפוש">
          <Search className="size-[19px]" strokeWidth={2.1} />
        </Link>
        <Link
          href="/notifications"
          className="pressable relative grid size-11 shrink-0 place-items-center rounded-full bg-surface text-foreground/85 shadow-[var(--card-shadow)]"
          aria-label={p.unreadNotifications ? `התראות, ${p.unreadNotifications} חדשות` : "התראות"}
        >
          <Bell className="size-[19px]" strokeWidth={2.1} />
          {!!p.unreadNotifications && <span className="absolute top-2.5 end-2.5 size-2.5 rounded-full bg-primary ring-2 ring-surface" />}
        </Link>
      </header>

      <div className="stagger space-y-4">
        <p style={stagger()} className="-mt-2 px-1 text-[13px] font-medium text-muted">
          {p.dateLine}
        </p>

        <div style={stagger()}>
          <HomeHero householdId={p.householdId} householdName={p.householdName} coverPath={p.coverPath} canEdit={p.isOwner} stats={heroStats} period={periodFromGreeting(p.greeting)} preview={p.preview} />
        </div>

        <div style={stagger()}>
          {showStarter ? (
            <StarterCard householdName={p.householdName} setup={p.setup} isAlone={p.members.length < 2} onDismiss={hideStarter} />
          ) : (
            <BriefCard brief={brief} chips={chips} greeting={p.greeting} more={attention.filter((a) => !a.handled).length} preview={p.preview} />
          )}
        </div>

        <div style={stagger()} className="py-1">
          <QuickActions categories={p.categories} inventory={p.inventory} preview={p.preview} />
        </div>

        {!showStarter && !setupHidden && p.setup.some((s) => !s.done) && (
          <div style={stagger()}>
            <SetupStrip setup={p.setup} onDismiss={hideSetup} />
          </div>
        )}

        {blocks.length > 0 && (
          <div style={stagger()} className="space-y-4 lg:columns-2 lg:gap-4 lg:space-y-0 lg:[&>*]:mb-4 lg:[&>*]:break-inside-avoid">
            {blocks}
          </div>
        )}

        {tiles.length > 0 && (
          <div style={stagger()}>
            <p className="eyebrow mb-2 px-1">עוד בבית</p>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {tiles.map(({ key, ...t }) => (
                <EmptyTile key={key} {...t} />
              ))}
            </div>
          </div>
        )}

        <div style={stagger()} className="flex justify-center pt-2">
          <button type="button" onClick={() => setCustomize(true)} className="pressable flex h-10 items-center gap-2 rounded-full bg-fill px-4 text-[14px] font-semibold text-foreground/80">
            <SlidersHorizontal className="size-4" /> התאמת המסך
          </button>
        </div>
      </div>

      <CustomizeSheet
        open={customize}
        onOpenChange={setCustomize}
        layout={layout}
        onChange={changeLayout}
        onReset={() => changeLayout(DEFAULT_LAYOUT)}
        unavailable={unavailable}
        saving={saving}
      />
    </div>
  );
}
