import { BottomNav, Sidebar } from "@/components/layout/app-nav";
import { requireHousehold } from "@/server/context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireHousehold();
  return (
    <div className="flex min-h-dvh">
      <Sidebar householdName={ctx.household.name} />
      <main className="min-w-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-10">
        <div className="mx-auto w-full max-w-3xl px-4 pt-safe sm:px-6 lg:max-w-5xl lg:px-10">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
