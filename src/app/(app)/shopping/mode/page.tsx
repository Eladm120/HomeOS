import { GroceryView } from "@/components/grocery/grocery-view";
import { requireHousehold } from "@/server/context";
import { loadGroceryData } from "@/server/grocery-data";

export const metadata = { title: "מצב סופר" };

/** The shopping list, opened straight into full-screen supermarket mode. */
export default async function ShoppingModePage() {
  const ctx = await requireHousehold();
  const data = await loadGroceryData(ctx);
  return <GroceryView {...data} initialStore />;
}
