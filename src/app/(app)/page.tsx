import { Dashboard } from "@/components/dashboard/dashboard";
import { requireHousehold } from "@/server/context";
import { loadDashboardData } from "@/server/dashboard-data";

export const metadata = { title: "בית" };

export default async function HomePage() {
  const ctx = await requireHousehold();
  const data = await loadDashboardData(ctx);
  return <Dashboard {...data} />;
}
