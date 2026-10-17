import { GroceryView } from "@/components/grocery/grocery-view";
import { requireHousehold } from "@/server/context";
import { loadGroceryData } from "@/server/grocery-data";

export const metadata = { title: "רשימת קניות" };

export default async function ShoppingPage() {
  const ctx = await requireHousehold();
  const data = await loadGroceryData(ctx);
  return <GroceryView {...data} />;
}
