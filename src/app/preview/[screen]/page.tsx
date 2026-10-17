import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import { GroceryView } from "@/components/grocery/grocery-view";
import { ShoppingMode } from "@/components/grocery/shopping-mode";
import { InventoryView } from "@/components/inventory/inventory-view";
import { BottomNav, Sidebar } from "@/components/layout/app-nav";
import { buildDailyBrief } from "@/lib/daily-brief";
import { expiryState, stockLevel } from "@/lib/inventory-logic";
import { formatHebrewCalendarDate, formatLongDate, greetingFor, todayInZone } from "@/lib/format";
import { HID, ME, PARTNER, activity, categories, groceries, inventory, locations, memberNames } from "../fixtures";

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
      const needs = inventory.filter((i) => stockLevel(i) !== "ok");
      const expiring = inventory.map((i) => ({ i, e: expiryState(i.expires_on, now) })).filter((x) => x.e && x.e.state !== "ok");
      content = (
        <Dashboard
          preview
          greeting={`${greetingFor(now)}, אלעד ונעה`}
          dateLine={`${formatLongDate(now)} · ${formatHebrewCalendarDate(now)}`}
          today={todayInZone(now)}
          brief={buildDailyBrief({
            pendingGrocery: pending.length,
            urgentGrocery: pending.filter((g) => g.priority === "high").length,
            outOfStock: needs.filter((i) => Number(i.quantity) <= 0).map((i) => i.name),
            lowStock: needs.filter((i) => Number(i.quantity) > 0).map((i) => i.name),
            expired: expiring.filter((x) => x.e!.state === "expired").map((x) => x.i.name),
            expiringSoon: expiring.filter((x) => x.e!.state === "soon").map((x) => ({ name: x.i.name, days: x.e!.days })),
          })}
          groceryCount={pending.length}
          urgentCount={pending.filter((g) => g.priority === "high").length}
          recentGrocery={[...pending].reverse().slice(0, 4)}
          needs={needs.slice(0, 4).map((i) => ({ ...i, onList: i.name.startsWith("חלב") }))}
          needsTotal={needs.length}
          expiring={expiring.map((x) => ({ id: x.i.id, name: x.i.name, days: x.e!.days }))}
          inventoryCount={inventory.length}
          health={{ stock: 0.7, verified: 0.9, fresh: 0.8 }}
          activity={activity}
          memberNames={memberNames}
          members={[
            { id: ME, name: "אלעד" },
            { id: PARTNER, name: "נעה" },
          ]}
          currentUserId={ME}
          isAlone={false}
          isOwner
          signedUrls={{}}
          householdId={HID}
        />
      );
      break;
    }
    case "shopping":
      path = "/shopping";
      content = <GroceryView {...groceryProps} />;
      break;
    case "mode":
      return (
        <div className="mx-auto w-full max-w-3xl px-4">
          <ShoppingMode {...groceryProps} />
        </div>
      );
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
