import { SearchView } from "@/components/search/search-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireHousehold } from "@/server/context";
import { searchHousehold } from "@/server/search";

export const metadata = { title: "חיפוש" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const query = q.trim().slice(0, 100);
  return <SearchView query={query} hits={await searchHousehold(supabase, ctx.household.id, query)} />;
}
