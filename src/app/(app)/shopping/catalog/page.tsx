import { CatalogView } from "@/components/grocery/catalog-view";
import { requireHousehold } from "@/server/context";
import { loadCatalogData } from "@/server/catalog-data";

export const metadata = { title: "קטלוג הסופר" };

export default async function CatalogPage() {
  const ctx = await requireHousehold();
  const data = await loadCatalogData(ctx);
  return <CatalogView {...data} />;
}
