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
}

export interface HubGroup {
  id: "daily" | "home" | "manage";
  title: string;
  links: HubLink[];
}

export const HUB_GROUPS: HubGroup[] = [
  {
    id: "daily",
    title: "חיי היום־יום",
    links: [
      { href: "/inventory", label: "מלאי הבית", icon: Package, hue: 75 },
      { href: "/chores", label: "משימות", icon: SquareCheckBig, hue: 155 },
      { href: "/meals", label: "תכנון ארוחות", icon: UtensilsCrossed, hue: 40 },
      { href: "/notifications", label: "התראות", icon: Bell, hue: 15 },
    ],
  },
  {
    id: "home",
    title: "הבית שלנו",
    links: [
      { href: "/smart-home", label: "בית חכם", icon: HouseWifi, hue: 280 },
      { href: "/appliances", label: "מכשירים", icon: PlugZap, hue: 230 },
      { href: "/plants", label: "צמחים", icon: Sprout, hue: 140 },
      { href: "/projects", label: "תיקונים ופרויקטים", icon: Hammer, hue: 30 },
    ],
  },
  {
    id: "manage",
    title: "ניהול הבית",
    links: [
      { href: "/bills", label: "חשבונות", icon: Receipt, hue: 320 },
      { href: "/expenses", label: "הוצאות הבית", icon: ChartColumn, hue: 255 },
      { href: "/documents", label: "מסמכים", icon: FolderOpen, hue: 200 },
      { href: "/planner", label: "קניות לבית", icon: Sofa, hue: 340 },
    ],
  },
];

export const HUB_SETTINGS: HubLink[] = [
  { href: "/household/settings", label: "הגדרות הבית", icon: Settings2, hue: 260 },
  { href: "/settings/notifications", label: "הגדרות התראות", icon: BellRing, hue: 15 },
  { href: "/settings/integrations", label: "חיבורים", icon: Link2, hue: 185 },
];

/** Flat list of every module. */
export const HUB_LINKS: HubLink[] = HUB_GROUPS.flatMap((g) => g.links);
