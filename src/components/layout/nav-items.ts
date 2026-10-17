import { Bot, ChefHat, House, LayoutGrid, ShoppingBasket, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Additional path prefixes that should highlight this tab. */
  match?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "בית", icon: House },
  { href: "/shopping", label: "קניות", icon: ShoppingBasket },
  { href: "/household", label: "משק הבית", icon: LayoutGrid, match: ["/inventory", "/household"] },
  { href: "/recipes", label: "מתכונים", icon: ChefHat },
  { href: "/assistant", label: "עוזר AI", icon: Bot },
];

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return [item.href, ...(item.match ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
