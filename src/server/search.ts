import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeLike, orFilterTerm } from "@/lib/utils";

export interface SearchHit {
  group: string;
  title: string;
  detail: string | null;
  href: string;
}

/**
 * Household-wide search. Every query runs as the signed-in member (RLS) and is
 * also filtered by the household id. Hebrew substring matching (ILIKE); the
 * document vault also searches its extracted text.
 */
export async function searchHousehold(supabase: SupabaseClient, householdId: string, raw: string): Promise<SearchHit[]> {
  const q = raw.trim().slice(0, 100);
  if (q.length < 2) return [];
  const like = `%${escapeLike(q)}%`;
  const orLike = `%${orFilterTerm(q)}%`;
  const h = householdId;
  const safe = <T,>(p: PromiseLike<{ data: T[] | null; error: unknown }>) => Promise.resolve(p).then((r) => (r.error ? [] : (r.data ?? [])));

  const [inventory, grocery, recipes, projects, chores, purchases, appliances, bills, events, plants, docs] = await Promise.all([
    safe(supabase.from("inventory_items").select("id, name, quantity, unit").eq("household_id", h).is("archived_at", null).ilike("name", like).limit(6)),
    safe(supabase.from("shopping_list_items").select("id, name, status").eq("household_id", h).is("deleted_at", null).is("cleared_at", null).ilike("name", like).limit(6)),
    safe(supabase.from("recipes").select("id, title, category").eq("household_id", h).or(`title.ilike.${orLike},description.ilike.${orLike}`).limit(6)),
    safe(supabase.from("home_projects").select("id, title, kind, status").eq("household_id", h).or(`title.ilike.${orLike},symptoms.ilike.${orLike},description.ilike.${orLike}`).limit(6)),
    safe(supabase.from("chores").select("id, title, next_due_on").eq("household_id", h).neq("status", "archived").ilike("title", like).limit(6)),
    safe(supabase.from("planned_purchases").select("id, name, store").eq("household_id", h).or(`name.ilike.${orLike},store.ilike.${orLike}`).limit(6)),
    safe(supabase.from("appliances").select("id, name, brand, model").eq("household_id", h).or(`name.ilike.${orLike},brand.ilike.${orLike},model.ilike.${orLike}`).limit(6)),
    safe(supabase.from("utility_bills").select("id, provider_name, category, amount, period_end").eq("household_id", h).or(`provider_name.ilike.${orLike},notes.ilike.${orLike}`).limit(6)),
    safe(supabase.from("household_events").select("id, title, starts_at").eq("household_id", h).or(`title.ilike.${orLike},location.ilike.${orLike}`).limit(6)),
    safe(supabase.from("plants").select("id, name, species").eq("household_id", h).or(`name.ilike.${orLike},species.ilike.${orLike}`).limit(6)),
    Promise.resolve(supabase.rpc("search_documents", { p_household: h, p_query: q })).then((r) => (r.error ? [] : ((r.data ?? []) as { id: string; title: string; category: string; snippet: string | null }[]))),
  ]);

  const hits: SearchHit[] = [];
  const push = (group: string, rows: Record<string, unknown>[], map: (r: Record<string, unknown>) => Omit<SearchHit, "group">) => rows.forEach((r) => hits.push({ group, ...map(r) }));
  push("מלאי", inventory, (r) => ({ title: String(r.name), detail: `${Number(r.quantity)} ${r.unit}`, href: `/inventory/${r.id}` }));
  push("רשימת קניות", grocery, (r) => ({ title: String(r.name), detail: r.status === "purchased" ? "בעגלה" : "לקנות", href: "/shopping" }));
  push("מתכונים", recipes, (r) => ({ title: String(r.title), detail: (r.category as string) ?? null, href: `/recipes/${r.id}` }));
  push("פרויקטים ותיקונים", projects, (r) => ({ title: String(r.title), detail: r.kind === "repair" ? "תיקון" : "פרויקט", href: `/projects/${r.id}` }));
  push("משימות", chores, (r) => ({ title: String(r.title), detail: `הבא: ${r.next_due_on}`, href: `/chores/${r.id}` }));
  push("תכנון רכישות", purchases, (r) => ({ title: String(r.name), detail: (r.store as string) ?? null, href: `/planner/${r.id}` }));
  push("מכשירים", appliances, (r) => ({ title: String(r.name), detail: [r.brand, r.model].filter(Boolean).join(" ") || null, href: `/appliances/${r.id}` }));
  push("חשבונות", bills, (r) => ({ title: String(r.provider_name ?? r.category), detail: `₪${Number(r.amount)}`, href: `/bills/${r.id}` }));
  push("יומן", events, (r) => ({ title: String(r.title), detail: String(r.starts_at).slice(0, 10), href: "/calendar" }));
  push("צמחים", plants, (r) => ({ title: String(r.name), detail: (r.species as string) ?? null, href: `/plants/${r.id}` }));
  push("מסמכים", docs as unknown as Record<string, unknown>[], (r) => ({ title: String(r.title), detail: (r.snippet as string) ?? null, href: `/documents/${r.id}` }));
  return hits;
}
