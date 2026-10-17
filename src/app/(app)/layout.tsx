import { BottomNav, Sidebar } from "@/components/layout/app-nav";
import { requireHousehold } from "@/server/context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireHousehold();
  return (
    <div className="relative flex min-h-dvh">
      <Sidebar householdName={ctx.household.name} />
      <main className="min-w-0 flex-1 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-10">
        <div className="mx-auto w-full max-w-3xl px-4 lg:max-w-5xl lg:px-8">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
