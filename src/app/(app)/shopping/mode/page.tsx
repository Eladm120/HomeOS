import { ShoppingMode } from "@/components/grocery/shopping-mode";
import { requireHousehold } from "@/server/context";
import { loadGroceryData } from "@/server/grocery-data";

export const metadata = { title: "מצב קנייה" };

export default async function ShoppingModePage() {
  const ctx = await requireHousehold();
  const data = await loadGroceryData(ctx);
  return <ShoppingMode {...data} />;
}
