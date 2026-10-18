import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeading, PanelRow } from "@/components/ui/panel";
import { requireHousehold } from "@/server/context";
import { getSupabaseServer } from "@/lib/supabase/server";
import { HUB_SECTIONS, type HubCounts } from "@/components/layout/hub-sections";

export const metadata = { title: "משק הבית" };

async function count(q: PromiseLike<{ count: number | null }>): Promise<number> {
  const { count: n } = await q;
  return n ?? 0;
}

export default async function HouseholdHubPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const head = { count: "exact" as const, head: true };

  const [inventory, chores, projects, planner, recipes, appliances, plants, bills, documents, events] = await Promise.all([
    count(supabase.from("inventory_items").select("id", head).eq("household_id", hid).is("archived_at", null)),
    count(supabase.from("chores").select("id", head).eq("household_id", hid).eq("status", "active")),
    count(supabase.from("home_projects").select("id", head).eq("household_id", hid).not("status", "in", "(completed,canceled)")),
    count(supabase.from("planned_purchases").select("id", head).eq("household_id", hid).not("status", "in", "(purchased,canceled)")),
    count(supabase.from("recipes").select("id", head).eq("household_id", hid)),
    count(supabase.from("appliances").select("id", head).eq("household_id", hid)),
    count(supabase.from("plants").select("id", head).eq("household_id", hid)),
    count(supabase.from("utility_bills").select("id", head).eq("household_id", hid).eq("payment_status", "unpaid")),
    count(supabase.from("documents").select("id", head).eq("household_id", hid)),
    count(supabase.from("household_events").select("id", head).eq("household_id", hid).gte("starts_at", new Date().toISOString())),
  ]);
  const counts: HubCounts = { inventory, chores, projects, planner, recipes, appliances, plants, bills, documents, events };

  return (
    <>
      <PageHeader title="משק הבית" subtitle={ctx.household.name} />
      <div className="space-y-6">
        {HUB_SECTIONS.map((section) => (
          <section key={section.title}>
            <PanelHeading title={section.title} />
            <Panel>
              {section.items.map((it) => (
                <PanelRow
                  key={it.href}
                  href={it.href}
                  leading={
                    <span aria-hidden className="cat-tint grid size-11 shrink-0 place-items-center rounded-[14px] text-[22px]" style={{ "--h": it.hue } as React.CSSProperties}>
                      {it.emoji}
                    </span>
                  }
                  title={it.label}
                  subtitle={it.description}
                  trailing={it.countKey && counts[it.countKey] ? <span className="num text-[15px] text-muted">{counts[it.countKey]}</span> : undefined}
                />
              ))}
            </Panel>
          </section>
        ))}
      </div>
    </>
  );
}
