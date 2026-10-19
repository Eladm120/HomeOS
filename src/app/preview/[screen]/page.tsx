import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import { GroceryView } from "@/components/grocery/grocery-view";
import { InventoryView } from "@/components/inventory/inventory-view";
import { BottomNav, Sidebar } from "@/components/layout/app-nav";
import { buildAlerts } from "@/lib/alerts";
import { HubView } from "@/components/household/hub-view";
import { NotificationsView } from "@/components/intelligence/notifications-view";
import { PageHeader } from "@/components/layout/page-header";
import { productEmoji } from "@/lib/category-style";
import { frequencyText } from "@/lib/labels";
import { addDays, daysUntil, formatHebrewCalendarDate, formatLongDate, greetingFor, todayInZone } from "@/lib/format";
import { HID, ME, PARTNER, categories, groceries, inventory, locations, memberNames } from "../fixtures";
import { normalizeLayout } from "@/lib/dashboard";
import * as mods from "../fixtures-modules";

/**
 * Development-only design preview with sample data (no login, no database).
 * Lets us review and screenshot real components. 404 in production.
 */
export default async function PreviewPage({ params, searchParams }: { params: Promise<{ screen: string }>; searchParams: Promise<{ g?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { screen } = await params;
  const now = new Date();

  const groceryProps = {
    householdId: HID,
    initialItems: groceries,
    categories,
    memberNames,
    currentUserId: ME,
    signedUrls: {},
    inventory: inventory.map((i) => ({ id: i.id, name: i.name, unit: i.unit })),
    renderedAt: 0,
    preview: true,
  };

  let content: React.ReactNode;
  let path = "/";
  switch (screen) {
    case "home":
    case "home-partial":
    case "home-new": {
      const g = (await searchParams).g;
      content = <Dashboard {...dashboardFixture(screen, now)} {...(g ? { greeting: g } : {})} />;
      break;
    }
    case "household":
      path = "/household";
      content = (
        <>
          <PageHeader title="משק הבית" subtitle="הבית שלנו" />
          <HubView counts={{ inventory: 42, low: 3, choresToday: 2, choresTotal: 9, meals: 4, appliances: 6, plants: 3, bills: 2, documents: 11, devices: 5 }} alerts={6} />
        </>
      );
      break;
    case "alerts": {
      path = "/household";
      const today = todayInZone(now);
      content = <NotificationsView preview notifications={[]} alerts={buildAlerts({
            today,
            now,
            inventory,
            onListInventoryIds: new Set([inventory[0].id]),
            chores: mods.chores.filter((c) => daysUntil(c.next_due_on) <= 0).map((c) => ({ id: c.id, title: c.title, next_due_on: c.next_due_on, assignee_name: c.assignee_id ? memberNames[c.assignee_id as keyof typeof memberNames] : null })),
            bills: [{ id: "00000000-0000-4000-8000-00000000b111", label: "חברת החשמל", amount: 412.5, due_on: addDays(today, 2) }],
            charges: [{ id: "00000000-0000-4000-8000-00000000c111", title: "שכר דירה", amount: 5800, next_due_on: addDays(today, 1) }],
            plants: [{ id: "00000000-0000-4000-8000-00000000d111", name: "מונסטרה", watering_interval_days: 7, last_watered_on: addDays(today, -9) }],
            suggestions: [],
          })} />;
      break;
    }
    case "shopping":
      path = "/shopping";
      content = <GroceryView {...groceryProps} />;
      break;
    case "inventory":
      path = "/inventory";
      content = <InventoryView householdId={HID} items={inventory} locations={locations} categories={categories} signedUrls={{}} />;
      break;
    default:
      notFound();
  }

  return (
    <div className="relative flex min-h-dvh">
      <Sidebar householdName="הבית שלנו" forcePath={path} />
      <main className="min-w-0 flex-1 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-10">
        <div className="mx-auto w-full max-w-3xl px-4 lg:max-w-5xl lg:px-8">{content}</div>
      </main>
      <BottomNav forcePath={path} />
    </div>
  );
}

/** Three household stages for the home screen: active, partly set up, brand new. */
function dashboardFixture(screen: string, now: Date): React.ComponentProps<typeof Dashboard> {
  const today = todayInZone(now);
  const stage = screen === "home-new" ? "new" : screen === "home-partial" ? "partial" : "active";
  const active = stage === "active";
  const pending = active ? groceries.filter((g) => g.status === "pending") : stage === "partial" ? groceries.filter((g) => g.status === "pending").slice(0, 2) : [];
  const chores = active ? mods.chores.filter((c) => daysUntil(c.next_due_on) <= 1) : [];
  const alerts = active
    ? buildAlerts({
        today,
        now,
        inventory,
        onListInventoryIds: new Set([inventory[0].id]),
        chores: [],
        bills: [{ id: "00000000-0000-4000-8000-00000000b111", label: "חברת החשמל", amount: 412.5, due_on: addDays(today, 2) }],
        charges: [{ id: "00000000-0000-4000-8000-00000000c111", title: "שכר דירה", amount: 5800, next_due_on: addDays(today, 1) }],
        plants: [{ id: "00000000-0000-4000-8000-00000000d111", name: "מונסטרה", watering_interval_days: 7, last_watered_on: addDays(today, -9) }],
        suggestions: [{ id: "00000000-0000-4000-8000-00000000e111", kind: "warranty", title: "האחריות על המקרר מסתיימת בעוד 3 שבועות", body: null, href: "/appliances", priority: "normal" }],
      })
    : [];
  return {
    preview: true,
    householdId: HID,
    householdName: "הבית של אלעד ונעה",
    greeting: greetingFor(now),
    userName: "אלעד",
    dateLine: `${formatLongDate(now)} · ${formatHebrewCalendarDate(now)}`,
    members: stage === "new" ? [{ id: ME, name: "אלעד" }] : [
      { id: ME, name: "אלעד" },
      { id: PARTNER, name: "נעה" },
    ],
    currentUserId: ME,
    isOwner: true,
    stage,
    layout: normalizeLayout(null),
    unreadNotifications: active ? 2 : 0,
    alerts,
    grocery: {
      count: pending.length,
      urgent: pending.filter((g) => g.priority === "high").length,
      inCart: active ? groceries.length - pending.length : 0,
      items: pending.slice(0, 5).map((g) => ({
        id: g.id,
        name: g.name,
        quantity: Number(g.quantity),
        unit: g.unit,
        image_path: null,
        urgent: g.priority === "high",
        emoji: productEmoji(g.name, categories.find((c) => c.id === g.category_id)),
      })),
    },
    categories,
    inventory: inventory.map((i) => ({ id: i.id, name: i.name, unit: i.unit })),
    tasks: chores.map((c) => ({
      id: c.id,
      title: c.title,
      days: daysUntil(c.next_due_on),
      assigneeId: c.assignee_id,
      assigneeName: c.assignee_id ? memberNames[c.assignee_id as keyof typeof memberNames] : null,
      detail: [c.assignee_id ? memberNames[c.assignee_id as keyof typeof memberNames] : "משותף", frequencyText(c.frequency, c.interval_days)].join(" · "),
    })),
    tasksDoneToday: active ? 1 : 0,
    meals: active ? [{ id: "m1", title: "שקשוקה", slot: "ערב", href: "/recipes", image_path: null, image_url: null }] : [],
    readyRecipes: active ? mods.recipes.slice(0, 3).map((r) => ({ id: r.id, title: r.title, image_path: null, image_url: null, minutes: 25 })) : [],
    hasStock: stage !== "new",
    smartHome: active
      ? {
          connected: true,
          devices: [
            { id: "d1", name: "מזגן סלון", kind: "climate", online: true, state: "cool", attributes: { temperature: 24, current_temperature: 27 }, capabilities: { power: true }, room: "סלון" },
            { id: "d2", name: "דוד", kind: "water_heater", online: true, state: "off", attributes: {}, capabilities: { power: true }, room: null },
            { id: "d3", name: "אור מרפסת", kind: "light", online: true, state: "on", attributes: {}, capabilities: { power: true }, room: "מרפסת" },
            { id: "d4", name: "טמפ׳ חדר שינה", kind: "sensor", online: true, state: "23.5", attributes: { unit_of_measurement: "°C" }, capabilities: {}, room: null },
          ],
        }
      : { connected: false, devices: [] },
    projects: active ? mods.projects.slice(0, 2).map((pr, k) => ({ id: pr.id, title: pr.title, kind: pr.kind, status: pr.status, done: k, total: k ? 3 : 0 })) : [],
    purchases: active ? mods.purchases.slice(0, 1).map((pu) => ({ id: pu.id, name: pu.name, status: pu.status })) : [],
    setup: [
      { key: "inventory", label: "להזין את המלאי בבית", href: "/inventory/setup", done: stage !== "new" },
      { key: "grocery", label: "להוסיף מוצר ראשון לרשימת הקניות", href: "/shopping", done: stage !== "new" },
      { key: "chores", label: "להוסיף משימות קבועות", href: "/chores?new=1", done: active },
      { key: "recipes", label: "לשמור מתכון ראשון", href: "/recipes/new", done: active },
      { key: "partner", label: "להזמין את בן/בת הזוג", href: "/household/settings", done: stage !== "new" },
      { key: "prefs", label: "לבחור על מה לקבל התראות", href: "/settings/notifications", done: false },
    ],
    signedUrls: {},
    failed: [],
  };
}
