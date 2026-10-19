import type { AlertItem } from "@/lib/alerts";
import type { DashboardLayout, HouseholdStage, WidgetId } from "@/lib/dashboard";
import type { DeviceCapabilities, DeviceKind } from "@/lib/home-assistant";
import type { ProductCategory, ProjectStatus, PlannedPurchaseStatus } from "@/lib/types";

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

export interface GroceryGlance {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  emoji: string;
  image_path: string | null;
  urgent: boolean;
}

export interface ReadyRecipe {
  id: string;
  title: string;
  image_path: string | null;
  image_url: string | null;
  minutes: number | null;
}

export interface DashDevice {
  id: string;
  name: string;
  kind: DeviceKind;
  online: boolean;
  state: string | null;
  attributes: Record<string, unknown>;
  capabilities: DeviceCapabilities;
  room: string | null;
}

export interface DashProject {
  id: string;
  title: string;
  kind: "project" | "repair";
  status: ProjectStatus;
  done: number;
  total: number;
}

export interface DashPurchase {
  id: string;
  name: string;
  status: PlannedPurchaseStatus;
}

export interface SetupStep {
  key: string;
  label: string;
  href: string;
  done: boolean;
}

export interface DashboardProps {
  householdId: string;
  householdName: string;
  /** The home's cover photo (households.settings.cover_path). */
  coverPath: string | null;
  greeting: string;
  userName: string;
  dateLine: string;
  members: { id: string; name: string }[];
  currentUserId: string;
  isOwner: boolean;
  stage: HouseholdStage;
  layout: DashboardLayout;
  unreadNotifications: number;
  alerts: AlertItem[];
  grocery: { count: number; urgent: number; inCart: number; items: GroceryGlance[] };
  categories: ProductCategory[];
  inventory: { id: string; name: string; unit: string }[];
  tasks: DashboardTask[];
  tasksDoneToday: number;
  meals: DashboardMeal[];
  readyRecipes: ReadyRecipe[];
  /** Readiness is only claimed when the home inventory has data. */
  hasStock: boolean;
  smartHome: { connected: boolean; devices: DashDevice[] };
  projects: DashProject[];
  purchases: DashPurchase[];
  setup: SetupStep[];
  signedUrls: Record<string, string>;
  /** Widgets whose data could not be loaded right now. */
  failed: WidgetId[];
  /** Design preview renders without a live connection. */
  preview?: boolean;
}
