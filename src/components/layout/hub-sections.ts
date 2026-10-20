import {
  Bell,
  ChartColumn,
  FolderOpen,
  Hammer,
  Sofa,
  HouseWifi,
  Link2,
  Package,
  PlugZap,
  Receipt,
  Settings2,
  BellRing,
  SquareCheckBig,
  Sprout,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/**
 * Every module behind the "משק הבית" tab, grouped the way people think about
 * the home. One icon family (Lucide), one hue per module: the hue drives the
 * module's chip and glow everywhere it appears (hub, sidebar, dashboard).
 * The calendar, receipts and product scanning are reached from inside other
 * modules (quick actions, inventory) rather than from the hub.
 */
export interface HubLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /** OKLCH hue for the module's chip (.mod-chip / .mod-tile via --h). */
  hue: number;
  /** 3D illustration (bundled Fluent art) for the hub tiles. */
  art: string;
}

export interface HubGroup {
  id: "daily" | "home" | "manage";
  title: string;
  links: HubLink[];
}

/** In each group the first three are the featured tiles; "הצג הכל" reveals the rest. */
export const HUB_GROUPS: HubGroup[] = [
  {
    id: "daily",
    title: "חיי היומיום",
    links: [
      { href: "/meals", label: "תכנון ארוחות", icon: UtensilsCrossed, hue: 55, art: "🍲" },
      { href: "/inventory", label: "מלאי הבית", icon: Package, hue: 30, art: "🧺" },
      { href: "/chores", label: "משימות", icon: SquareCheckBig, hue: 150, art: "✅" },
      { href: "/notifications", label: "התראות", icon: Bell, hue: 15, art: "🔔" },
    ],
  },
  {
    id: "home",
    title: "הבית שלנו",
    links: [
      { href: "/smart-home", label: "בית חכם", icon: HouseWifi, hue: 290, art: "💡" },
      { href: "/appliances", label: "מכשירים", icon: PlugZap, hue: 235, art: "🔌" },
      { href: "/plants", label: "צמחים", icon: Sprout, hue: 140, art: "🪴" },
      { href: "/planner", label: "קניות לבית", icon: Sofa, hue: 340, art: "🛋️" },
    ],
  },
  {
    id: "manage",
    title: "ניהול הבית",
    links: [
      { href: "/documents", label: "מסמכים", icon: FolderOpen, hue: 70, art: "📂" },
      { href: "/bills", label: "חשבונות", icon: Receipt, hue: 235, art: "🧾" },
      { href: "/projects", label: "תיקונים ופרויקטים", icon: Hammer, hue: 25, art: "🔨" },
      { href: "/expenses", label: "הוצאות הבית", icon: ChartColumn, hue: 255, art: "📊" },
    ],
  },
];

export const HUB_SETTINGS: HubLink[] = [
  { href: "/household/settings", label: "הגדרות הבית", icon: Settings2, hue: 260, art: "⚙️" },
  { href: "/settings/notifications", label: "הגדרות התראות", icon: BellRing, hue: 15, art: "🔔" },
  { href: "/settings/integrations", label: "חיבורים", icon: Link2, hue: 185, art: "🔗" },
];

/** Flat list of every module. */
export const HUB_LINKS: HubLink[] = HUB_GROUPS.flatMap((g) => g.links);
