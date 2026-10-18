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
import * as mods from "../fixtures-modules";

/**
 * Development-only design preview with sample data (no login, no database).
 * Lets us review and screenshot real components. 404 in production.
 */
export default async function PreviewPage({ params }: { params: Promise<{ screen: string }> }) {
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
    case "home": {
      const pending = groceries.filter((g) => g.status === "pending");
      const today = todayInZone(now);
      const chores = mods.chores.filter((c) => daysUntil(c.next_due_on) <= 1);
      content = (
        <Dashboard
          preview
          greeting={`${greetingFor(now)}, אלעד ונעה`}
          dateLine={`${formatLongDate(now)} · ${formatHebrewCalendarDate(now)}`}
          householdId={HID}
          members={[
            { id: ME, name: "אלעד" },
            { id: PARTNER, name: "נעה" },
          ]}
          currentUserId={ME}
          isAlone={false}
          isOwner
          alerts={buildAlerts({
            today,
            now,
            inventory,
            onListInventoryIds: new Set([inventory[0].id]),
            chores: [],
            bills: [{ id: "00000000-0000-4000-8000-00000000b111", label: "חברת החשמל", amount: 412.5, due_on: addDays(today, 2) }],
            charges: [{ id: "00000000-0000-4000-8000-00000000c111", title: "שכר דירה", amount: 5800, next_due_on: addDays(today, 1) }],
            plants: [{ id: "00000000-0000-4000-8000-00000000d111", name: "מונסטרה", watering_interval_days: 7, last_watered_on: addDays(today, -9) }],
            suggestions: [],
          })}
          tasks={chores.map((c) => ({
            id: c.id,
            title: c.title,
            days: daysUntil(c.next_due_on),
            assigneeId: c.assignee_id,
            assigneeName: c.assignee_id ? memberNames[c.assignee_id as keyof typeof memberNames] : null,
            detail: [c.assignee_id ? memberNames[c.assignee_id as keyof typeof memberNames] : "משותף", frequencyText(c.frequency, c.interval_days)].join(" · "),
          }))}
          grocery={{
            count: pending.length,
            urgent: pending.filter((g) => g.priority === "high").length,
            inCart: groceries.length - pending.length,
            items: pending.slice(0, 8).map((g) => ({ id: g.id, name: g.name, emoji: productEmoji(g.name, categories.find((c) => c.id === g.category_id)) })),
          }}
          meals={[{ id: "m1", title: "שקשוקה", slot: "ערב", href: "/recipes", image_path: null, image_url: null }]}
          signedUrls={{}}
          setup={[
            { key: "a", label: "להזין את המלאי בבית", href: "/inventory/setup", done: true },
            { key: "b", label: "להוסיף משימות קבועות", href: "/chores", done: false },
            { key: "c", label: "לשמור מתכון ראשון", href: "/recipes/new", done: false },
          ]}
          unreadNotifications={2}
        />
      );
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
