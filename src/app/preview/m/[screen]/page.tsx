import { notFound } from "next/navigation";
import { BottomNav, Sidebar } from "@/components/layout/app-nav";
import { PlannerView } from "@/components/planner/planner-view";
import { PurchaseDetail } from "@/components/planner/purchase-detail";
import { ProjectsView } from "@/components/projects/projects-view";
import { ProjectDetail } from "@/components/projects/project-detail";
import { ChoresView } from "@/components/chores/chores-view";
import { RecipesView } from "@/components/recipes/recipes-view";
import { RecipeDetail } from "@/components/recipes/recipe-detail";
import { MealsView } from "@/components/recipes/meals-view";
import { checkIngredients, aggregateShortfalls } from "@/lib/ingredients";
import { addDays, todayInZone } from "@/lib/format";
import { HID, ME, inventory } from "../../fixtures";
import { BillsView } from "@/components/bills/bills-view";
import { SmartHomeView } from "@/components/smart-home/smart-home-view";
import { IntegrationsView } from "@/components/settings/integrations-view";
import { AssistantView } from "@/components/assistant/assistant-view";
import { CalendarView } from "@/components/calendar/calendar-view";
import type { UtilityBill } from "@/lib/types";
import * as f from "../../fixtures-modules";

/** Development-only previews of the Phase 2+ module screens with sample data. 404 in production. */
export default async function ModulePreviewPage({ params }: { params: Promise<{ screen: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { screen } = await params;
  const stock = inventory.map((i) => ({ id: i.id, name: i.name, quantity: Number(i.quantity), unit: i.unit, stock_confidence: i.stock_confidence }));
  const ingFor = (rid: string) => f.recipeIngredients.filter((i) => i.recipe_id === rid);
  const ready = (rid: string) => {
    const checks = checkIngredients(ingFor(rid), stock);
    const req = checks.filter((c) => !c.ingredient.optional);
    return { missing: req.filter((c) => c.status === "missing" || c.status === "insufficient").length, unclear: req.filter((c) => c.status === "unclear").length, total: req.length };
  };

  let content: React.ReactNode;
  let path = "/household";
  switch (screen) {
    case "planner":
      content = <PlannerView householdId={HID} purchases={f.purchases} rooms={f.rooms} projects={f.projects} signedUrls={{}} />;
      break;
    case "purchase":
      content = (
        <PurchaseDetail
          householdId={HID}
          purchase={f.purchases[0]}
          alternatives={[{ id: "00000000-0000-4000-8000-0000000a1001", household_id: HID, purchase_id: f.purchases[0].id, name: "כורסת POÄNG", store: "איקאה", url: null, price: 690, currency: "ILS", dimensions: "68×82×100", color: "בז׳", material: "עץ ליבנה", image_path: null, notes: "פחות נוחה לטווח ארוך" }]}
          attachments={[]}
          rooms={f.rooms}
          projects={f.projects}
          addedBy="נעה"
          signedUrls={{}}
        />
      );
      break;
    case "projects":
      content = <ProjectsView householdId={HID} projects={f.projects} taskStats={{ [f.projects[1].id]: { done: 1, total: 3 } }} rooms={f.rooms} members={f.members} providers={f.providers} appliances={[]} />;
      break;
    case "repair":
      content = (
        <ProjectDetail
          householdId={HID}
          project={f.projects[0]}
          tasks={[]}
          activities={f.activities}
          purchases={[]}
          attachments={[]}
          rooms={f.rooms}
          members={f.members}
          providers={f.providers}
          appliances={[]}
          signedUrls={{}}
        />
      );
      break;
    case "chores":
      content = <ChoresView householdId={HID} chores={f.chores} rooms={f.rooms} members={f.members} currentUserId={ME} />;
      break;
    case "recipes":
      path = "/recipes";
      content = <RecipesView recipes={f.recipes.map((r) => ({ ...r, readiness: ready(r.id) }))} signedUrls={{}} />;
      break;
    case "recipe":
      path = "/recipes";
      content = (
        <RecipeDetail
          recipe={f.recipes[0]}
          ingredients={ingFor(f.recipes[0].id)}
          steps={f.recipeSteps}
          stock={stock}
          mappings={{}}
          createdBy="נעה"
          signedUrls={{}}
        />
      );
      break;
    case "meals": {
      path = "/recipes";
      const today = todayInZone();
      const start = addDays(today, -new Date(`${today}T00:00:00Z`).getUTCDay());
      content = (
        <MealsView
          householdId={HID}
          weekStart={start}
          entries={f.meals}
          recipes={f.recipes.map((r) => ({ id: r.id, title: r.title, servings: r.servings }))}
          shortfalls={aggregateShortfalls(f.meals.filter((m) => m.recipe_id).map((m) => ({ source: m.recipe_title ?? "", checks: checkIngredients(ingFor(m.recipe_id!), stock) })))}
          suggestions={[{ recipeId: f.recipes[2].id, title: f.recipes[2].title, reason: "משתמש ביוגורט שתוקפו קרוב · חסרים 2" }]}
        />
      );
      break;
    }

    case "bills": {
      const b = (id: string, end: string, amount: number, extra: Partial<UtilityBill> = {}): UtilityBill => ({ id, household_id: HID, category: "electricity", provider_name: "חברת החשמל", account_ref: null, period_start: addDays(end, -59), period_end: end, amount, currency: "ILS", issue_date: null, due_on: null, paid_on: null, payment_status: "paid", consumption: null, consumption_unit: "קוט״ש", fixed_charges: null, document_id: null, source: "upload", import_status: "confirmed", verified: true, extraction: null, last_synced_at: null, notes: null, created_at: end, ...extra });
      const today = todayInZone();
      const bills = [b("00000000-0000-4000-8000-00000000b001", addDays(today, -3), 742, { payment_status: "unpaid", due_on: addDays(today, 4), consumption: 1350 }), b("00000000-0000-4000-8000-00000000b002", addDays(today, -63), 588, { consumption: 1120 }), b("00000000-0000-4000-8000-00000000b003", addDays(today, -20), 310, { category: "arnona", provider_name: "עיריית תל אביב", payment_status: "autopay" }), b("00000000-0000-4000-8000-00000000b004", addDays(today, -1), 196, { category: "water", provider_name: "מי אביבים", import_status: "needs_review", verified: false })];
      const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 11 + i); return d.toISOString().slice(0, 7); });
      content = <BillsView householdId={HID} bills={bills} monthly={months.map((m, i) => ({ month: m, total: [420, 0, 610, 0, 380, 520, 0, 590, 310, 0, 640, 1248][i] }))} ytd={4200} thisMonth={1248} byCategory={[{ key: "electricity", label: "חשמל", emoji: "⚡", total: 2900 }, { key: "arnona", label: "ארנונה", emoji: "🏛️", total: 1860 }, { key: "water", label: "מים", emoji: "💧", total: 640 }]} insights={[{ billId: bills[0].id, category: "electricity", verdict: "higher", text: "העלות ליום גבוהה ב-26% ביחס לחשבון הקודם. הסיבה העיקרית: צריכת החשמל ליום עלתה ב-21%." }]} aiEnabled />;
      break;
    }
    case "smart-home":
      content = <SmartHomeView householdId={HID} connected isOwner lastSync={new Date(Date.now() - 120000).toISOString()} lastError={null} devices={[
        { id: "00000000-0000-4000-8000-00000000d001", name: "מזגן סלון", kind: "climate", online: true, state: "cool", attributes: { temperature: 24, current_temperature: 27, fan_mode: "low" }, capabilities: { power: true, target_temperature: { min: 16, max: 30, step: 1 }, hvac_modes: ["off", "cool", "heat", "auto"], fan_modes: ["low", "high"] }, pinned: true, requires_confirmation: false, state_updated_at: new Date(Date.now() - 60000).toISOString(), room: "סלון" },
        { id: "00000000-0000-4000-8000-00000000d002", name: "דוד שמש", kind: "water_heater", online: true, state: "off", attributes: {}, capabilities: { power: true, timer_service: "switcher_kis.turn_on_with_timer" }, pinned: true, requires_confirmation: true, state_updated_at: new Date(Date.now() - 3600000).toISOString(), room: "חדר רחצה" },
        { id: "00000000-0000-4000-8000-00000000d003", name: "טמפרטורה חדר שינה", kind: "sensor", online: true, state: "23.5", attributes: { unit_of_measurement: "°C" }, capabilities: {}, pinned: true, requires_confirmation: false, state_updated_at: new Date().toISOString(), room: "חדר שינה" },
      ]} />;
      break;
    case "integrations":
      content = <IntegrationsView env={{ ai: false, encryption: true, google: false, push: false }} isOwner flash={{}} connections={[{ provider: "home_assistant", status: "connected", config: { base_url: "https://example.ui.nabu.casa" }, last_sync_at: new Date().toISOString(), last_error: null }]} />;
      break;
    case "assistant":
      path = "/assistant";
      content = <AssistantView householdId={HID} configured conversationId="00000000-0000-4000-8000-00000000c001" conversations={[]} messages={[
        { id: "m1", role: "user", content: "נגמרה לנו אבקת כביסה, תוסיף לסופר", actions: [], links: [], image_path: null, created_at: new Date().toISOString() },
        { id: "m2", role: "assistant", content: "הוספתי הצעה להוסיף אבקת כביסה לרשימת הקניות. אשרו ואוסיף.", actions: [{ id: "00000000-0000-4000-8000-00000000a0a1", type: "add_grocery", title: "הוספה לרשימת הקניות: אבקת כביסה", payload: { items: [{ name: "אבקת כביסה", quantity: 1, unit: "יח׳", note: null }] }, status: "proposed" }], links: [{ label: "רשימת הקניות", href: "/shopping" }], image_path: null, created_at: new Date().toISOString() },
        { id: "m3", role: "user", content: "מה המצב של התיקון במזגן?", actions: [], links: [], image_path: null, created_at: new Date().toISOString() },
        { id: "m4", role: "assistant", content: "התיקון ממתין לטכנאי. ב-6/10 גיליתם שהרעש נעלם כשמורידים את מהירות המאוורר, ויוסי חושד במסב ומזמין חלק.", actions: [], links: [{ label: "המזגן בסלון מרעיש", href: "/projects" }], image_path: null, created_at: new Date().toISOString() },
      ]} />;
      break;
    case "calendar": {
      const today = todayInZone();
      content = <CalendarView householdId={HID} members={f.members} monthStart={today.slice(0, 7) + "-01"} googleConnected={false} items={[
        { id: "e1", kind: "event", title: "טכנאי מזגנים", date: addDays(today, 1), time: "10:00", category: "technician", href: null, location: "בבית", assignee: "אלעד", event: { id: "e1", household_id: HID, title: "טכנאי מזגנים", description: null, category: "technician", starts_at: new Date().toISOString(), ends_at: null, all_day: false, location: "בבית", assignee_id: ME, remind_minutes: 60, linked_entity_type: null, linked_entity_id: null, external_source: null, external_id: null, created_by: ME } },
        { id: "c1", kind: "chore", title: "החלפת מצעים", date: addDays(today, 2), time: null, category: "chore", href: "/chores", assignee: "נעה" },
        { id: "b1", kind: "bill", title: "חברת החשמל · ₪742", date: addDays(today, 4), time: null, category: "bill", href: "/bills" },
      ]} />;
      break;
    }
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
