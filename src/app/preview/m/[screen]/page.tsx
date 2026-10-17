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
