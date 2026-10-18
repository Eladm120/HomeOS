import { ChefHat, ListChecks, Plus, ReceiptText, ScanBarcode, Sofa, Sparkles, Wrench } from "lucide-react";
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
        { href: "/scan", label: "סריקת מוצר", icon: <ScanBarcode /> },
        { href: "/receipts", label: "צילום קבלה", icon: <ReceiptText /> },
        { href: "/chores?new=1", label: "משימה", icon: <ListChecks /> },
        { href: "/recipes/new", label: "מתכון", icon: <ChefHat /> },
        { href: "/projects?new=1&kind=repair", label: "דיווח תקלה", icon: <Wrench /> },
        { href: "/planner?new=1", label: "לתכנון רכישות", icon: <Sofa /> },
        { href: "/assistant", label: "לשאול את HomeOS", icon: <Sparkles /> },
      ]}
    />
  );
}
