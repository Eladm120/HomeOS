import { ClipboardList, Plus, ScanBarcode, Sparkles } from "lucide-react";
import { Dashboard } from "@/components/dashboard/dashboard";
import { requireHousehold } from "@/server/context";
import { loadDashboardData } from "@/server/dashboard-data";

export const metadata = { title: "בית" };

export default async function HomePage() {
  const ctx = await requireHousehold();
  const data = await loadDashboardData(ctx);
  return (
    <Dashboard
      {...data}
      quickActions={[
        { href: "/shopping?new=1", label: "לקניות", icon: <Plus /> },
        { href: "/inventory?new=1", label: "למלאי", icon: <ScanBarcode /> },
        { href: "/inventory/setup", label: "הזנת מלאי", icon: <ClipboardList /> },
        { href: "/assistant", label: "לשאול את HomeOS", icon: <Sparkles /> },
      ]}
    />
  );
}
