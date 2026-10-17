import {
  Boxes,
  CalendarDays,
  FileText,
  Hammer,
  Leaf,
  ListChecks,
  Lightbulb,
  Receipt,
  Refrigerator,
  Settings,
  Sofa,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, IconTile, ListRow, SectionLabel } from "@/components/ui/card";
import { requireHousehold } from "@/server/context";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "משק הבית" };

const UPCOMING: { label: string; description: string; icon: LucideIcon; tint: string; phase: number }[] = [
  { label: "משימות בית", description: "מטלות חוזרות ומי אחראי", icon: ListChecks, tint: "bg-sage", phase: 2 },
  { label: "פרויקטים ותיקונים", description: "תקלות, טכנאים, הצעות מחיר", icon: Hammer, tint: "bg-amber", phase: 2 },
  { label: "תכנון רכישות", description: "רהיטים ומוצרים לפי חדר", icon: Sofa, tint: "bg-pink", phase: 2 },
  { label: "חשבונות והוצאות", description: "חשמל, מים, ארנונה", icon: Receipt, tint: "bg-teal", phase: 4 },
  { label: "מכשירי חשמל", description: "אחריות וחשבוניות", icon: Refrigerator, tint: "bg-sky", phase: 4 },
  { label: "מסמכים", description: "כספת מסמכים משותפת", icon: FileText, tint: "bg-[#8e8e93]", phase: 4 },
  { label: "יומן משותף", description: "טכנאים, משלוחים ואורחים", icon: CalendarDays, tint: "bg-danger", phase: 4 },
  { label: "צמחים", description: "השקיה ותזכורות", icon: Leaf, tint: "bg-[#30d158]", phase: 4 },
  { label: "בית חכם", description: "מזגן, דוד ותאורה", icon: Lightbulb, tint: "bg-yellow", phase: 5 },
];

export default async function HouseholdHubPage() {
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const { count } = await supabase
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("household_id", ctx.household.id)
    .is("archived_at", null);

  return (
    <>
      <PageHeader title="משק הבית" subtitle={ctx.household.name} />

      <Card className="hairline-list-inset mb-8 [--separator-inset:3.75rem]">
        <ListRow
          href="/inventory"
          icon={
            <IconTile className="bg-amber">
              <Boxes />
            </IconTile>
          }
          title="מלאי הבית"
          trailing={count ? <span className="num">{count}</span> : undefined}
        />
        <ListRow
          href="/household/settings"
          icon={
            <IconTile className="bg-[#8e8e93]">
              <Settings />
            </IconTile>
          }
          title="הגדרות"
          subtitle="חברי הבית, הזמנות, חדרים"
        />
      </Card>

      <SectionLabel>בקרוב</SectionLabel>
      <Card className="hairline-list-inset [--separator-inset:3.75rem]">
        {UPCOMING.map((t) => (
          <div key={t.label} aria-disabled className="flex min-h-14 items-center gap-3 px-4 py-2.5 opacity-60">
            <IconTile className={t.tint}>
              <t.icon />
            </IconTile>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[17px]">{t.label}</span>
              <span className="footnote block truncate text-muted">{t.description}</span>
            </span>
            <span className="footnote shrink-0 text-muted">שלב {t.phase}</span>
          </div>
        ))}
      </Card>
    </>
  );
}
