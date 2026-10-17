// Development-only sample data for /preview/* (Phase 2+ modules). Never used in production.
import type { Chore, HomeProject, MealPlanEntry, PlannedPurchase, ProjectActivity, ProjectTask, Recipe, RecipeIngredient, RecipeStep, Room, ServiceProvider } from "@/lib/types";
import { HID, ME, PARTNER } from "./fixtures";
import { addDays, todayInZone } from "@/lib/format";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const today = todayInZone();
const id = (prefix: string, n: number) => `00000000-0000-4000-8000-${prefix}${String(n).padStart(12 - prefix.length, "0")}`;

export const rooms: Room[] = ["סלון", "מטבח", "חדר שינה", "חדר עבודה", "חדר רחצה", "מרפסת"].map((name, i) => ({
  id: id("e", i + 1), household_id: HID, name, icon: null, sort_order: i + 1,
}));
export const members = [
  { id: ME, name: "אלעד" },
  { id: PARTNER, name: "נעה" },
];

function purchase(n: number, p: Partial<PlannedPurchase> & { name: string }): PlannedPurchase {
  return {
    id: id("f", n), household_id: HID, room_id: null, project_id: null, store: null, url: null, price: null, currency: "ILS", quantity: 1,
    priority: "normal", status: "idea", dimensions: null, color: null, material: null, image_path: null, notes: null, purchased_at: null,
    sort_order: 0, created_by: PARTNER, created_at: ago(60 * 24 * n), updated_at: ago(60), ...p,
  };
}
export const purchases: PlannedPurchase[] = [
  purchase(1, { name: "כורסת קריאה", room_id: rooms[3].id, store: "איקאה", price: 1290, status: "considering", color: "ירוק זית", material: "בד", dimensions: "80×86×101" }),
  purchase(2, { name: "מנורת עמידה", room_id: rooms[3].id, store: "ACE", price: 349, status: "ready" }),
  purchase(3, { name: "מדפים צפים", room_id: rooms[3].id, price: 180, quantity: 3, status: "researching" }),
  purchase(4, { name: "שטיח לסלון", room_id: rooms[0].id, price: 990, status: "idea", dimensions: "160×230" }),
  purchase(5, { name: "מתקן תבלינים", room_id: rooms[1].id, store: "המשביר", price: 89, status: "purchased", purchased_at: ago(60 * 24 * 3) }),
  purchase(6, { name: "כיסא למרפסת", room_id: rooms[5].id, status: "idea" }),
];

export const providers: ServiceProvider[] = [{ id: id("a1", 1), household_id: HID, name: "יוסי מזגנים", trade: "טכנאי מזגנים", phone: "050-1234567", email: null, notes: null }];

function project(n: number, p: Partial<HomeProject> & { title: string }): HomeProject {
  return {
    id: id("b1", n), household_id: HID, kind: "project", description: null, room_id: null, priority: "normal", status: "idea", owner_id: null,
    due_on: null, estimated_cost: null, actual_cost: null, currency: "ILS", provider_id: null, symptoms: null, first_reported_on: null,
    warranty_notes: null, resolution: null, completed_at: null, cover_path: null, notes: null, created_by: ME, created_at: ago(60 * 24 * 10), updated_at: ago(60 * n), ...p,
  };
}
export const projects: HomeProject[] = [
  project(1, {
    title: "המזגן בסלון מרעיש", kind: "repair", room_id: rooms[0].id, status: "waiting", priority: "high", owner_id: ME,
    symptoms: "טרטור חזק כשהמאוורר על מהירות גבוהה", first_reported_on: addDays(today, -12), provider_id: providers[0].id, warranty_notes: "באחריות עד 03/2027",
  }),
  project(2, { title: "פינת קריאה בחדר העבודה", room_id: rooms[3].id, status: "in_progress", owner_id: PARTNER, due_on: addDays(today, 20), estimated_cost: 2500 }),
  project(3, { title: "התקנת מדף בחדר הרחצה", room_id: rooms[4].id, status: "planned" }),
];
export const tasks: ProjectTask[] = [
  { id: id("c1", 1), household_id: HID, project_id: projects[1].id, title: "לבחור כורסה", done: true, done_at: ago(60), assignee_id: PARTNER, due_on: null, sort_order: 0 },
  { id: id("c1", 2), household_id: HID, project_id: projects[1].id, title: "לקנות מנורה", done: false, done_at: null, assignee_id: ME, due_on: null, sort_order: 1 },
  { id: id("c1", 3), household_id: HID, project_id: projects[1].id, title: "להתקין מדפים", done: false, done_at: null, assignee_id: null, due_on: null, sort_order: 2 },
];
export const activities: ProjectActivity[] = [
  { id: id("d1", 1), household_id: HID, project_id: projects[0].id, kind: "troubleshooting", body: "הורדנו את מהירות המאוורר — הרעש נעלם לגמרי.", occurred_on: addDays(today, -11), amount: null, provider_id: null, created_by: ME, created_at: ago(60 * 24 * 11) },
  { id: id("d1", 2), household_id: HID, project_id: projects[0].id, kind: "technician_visit", body: "יוסי בדק, חושד במסב של המאוורר. מזמין חלק.", occurred_on: addDays(today, -4), amount: 250, provider_id: providers[0].id, created_by: PARTNER, created_at: ago(60 * 24 * 4) },
  { id: id("d1", 3), household_id: HID, project_id: projects[0].id, kind: "status_change", body: "ממתין לגורם חיצוני — מחכים לחלק", occurred_on: addDays(today, -4), amount: null, provider_id: null, created_by: PARTNER, created_at: ago(60 * 24 * 4) },
];

function chore(n: number, c: Partial<Chore> & { title: string }): Chore {
  return {
    id: id("e1", n), household_id: HID, description: null, room_id: null, assignee_id: null, frequency: "weekly", interval_days: null,
    next_due_on: today, last_completed_at: ago(60 * 24 * 7), priority: "normal", status: "active", remind: true, notes: null, created_by: ME, created_at: ago(60 * 24 * 30), ...c,
  };
}
export const chores: Chore[] = [
  chore(1, { title: "החלפת מצעים", assignee_id: PARTNER, next_due_on: addDays(today, -1), room_id: rooms[2].id }),
  chore(2, { title: "הוצאת מחזור", assignee_id: ME, next_due_on: today }),
  chore(3, { title: "שטיפת רצפה", next_due_on: addDays(today, 2), frequency: "weekly" }),
  chore(4, { title: "ניקוי מסנן מזגן", next_due_on: addDays(today, 18), frequency: "quarterly", assignee_id: ME }),
  chore(5, { title: "ניקוי מקרר", next_due_on: addDays(today, 5), frequency: "monthly" }),
];

function recipe(n: number, r: Partial<Recipe> & { title: string }): Recipe {
  return {
    id: id("f1", n), household_id: HID, description: null, image_path: null, image_url: null, source_url: null, source_platform: "manual",
    prep_minutes: null, cook_minutes: null, servings: 4, category: null, tags: [], notes: null, is_favorite: false, rating: null,
    last_cooked_on: null, times_cooked: 0, created_by: PARTNER, created_at: ago(60 * 24 * n), updated_at: ago(60 * n), ...r,
  };
}
export const recipes: Recipe[] = [
  recipe(1, { title: "שקשוקה", category: "ארוחת ערב", prep_minutes: 10, cook_minutes: 20, is_favorite: true, tags: ["מהיר"], description: "עגבניות, פלפל וביצים במחבת אחת." }),
  recipe(2, { title: "פסטה ברוטב עגבניות", category: "ארוחת ערב", prep_minutes: 5, cook_minutes: 15, source_platform: "tiktok", source_url: "https://www.tiktok.com/@x/video/1" }),
  recipe(3, { title: "עוגת שוקולד בחושה", category: "קינוחים", prep_minutes: 15, cook_minutes: 35, servings: 10 }),
];
let ri = 0;
const ing = (recipeId: string, name: string, quantity: number | null, unit: string | null, optional = false): RecipeIngredient => ({
  id: id("a2", ++ri), household_id: HID, recipe_id: recipeId, position: ri, name, quantity, unit, note: null, optional, inventory_item_id: null,
});
export const recipeIngredients: RecipeIngredient[] = [
  ing(recipes[0].id, "ביצים", 4, null), ing(recipes[0].id, "עגבניות", 5, null), ing(recipes[0].id, "שמן זית", 2, "כפות"), ing(recipes[0].id, "כוסברה", null, null, true),
  ing(recipes[1].id, "פסטה פנה", 500, "גרם"), ing(recipes[1].id, "רסק עגבניות", 1, "קופסה"), ing(recipes[1].id, "שום", 3, "שיניים"),
  ing(recipes[2].id, "קמח", 1, "כוס"), ing(recipes[2].id, "ביצים", 3, null), ing(recipes[2].id, "שוקולד מריר", 200, "גרם"), ing(recipes[2].id, "חלב", 1, "כוס"),
];
export const recipeSteps: RecipeStep[] = [
  { id: id("a3", 1), household_id: HID, recipe_id: recipes[0].id, position: 0, body: "מטגנים בצל ופלפל בשמן זית עד שמזהיבים." },
  { id: id("a3", 2), household_id: HID, recipe_id: recipes[0].id, position: 1, body: "מוסיפים עגבניות קצוצות ומבשלים 10 דקות." },
  { id: id("a3", 3), household_id: HID, recipe_id: recipes[0].id, position: 2, body: "שוברים את הביצים לתוך הרוטב, מכסים ומבשלים עד שהחלבון מתייצב." },
];
export const meals: (MealPlanEntry & { recipe_title: string | null })[] = [
  { id: id("a4", 1), household_id: HID, plan_date: today, slot: "dinner", recipe_id: recipes[0].id, title: null, servings: 2, notes: null, sort_order: 0, created_by: ME, recipe_title: recipes[0].title },
  { id: id("a4", 2), household_id: HID, plan_date: addDays(today, 1), slot: "dinner", recipe_id: recipes[1].id, title: null, servings: null, notes: null, sort_order: 0, created_by: ME, recipe_title: recipes[1].title },
  { id: id("a4", 3), household_id: HID, plan_date: addDays(today, 2), slot: "lunch", recipe_id: null, title: "ארוחה אצל ההורים", servings: null, notes: null, sort_order: 0, created_by: PARTNER, recipe_title: null },
];
