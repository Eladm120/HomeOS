import Link from "next/link";
import {
  Boxes,
  CalendarDays,
  ChevronLeft,
  FileText,
  Hammer,
  Leaf,
  ListChecks,
  Lightbulb,
  Receipt,
  Settings,
  Sofa,
  Refrigerator,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Card } from "@/components/ui/card";
import { requireHousehold } from "@/server/context";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "משק הבית" };

interface Tile {
  href?: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  phase?: number;
}

const UPCOMING: Tile[] = [
  { label: "משימות בית", description: "מטלות חוזרות ומי אחראי", icon: ListChecks, tone: "bg-sage-soft text-sage", phase: 2 },
  { label: "פרויקטים ותיקונים", description: "תיעוד תקלות, טכנאים והצעות מחיר", icon: Hammer, tone: "bg-amber-soft text-amber", phase: 2 },
  { label: "תכנון רכישות", description: "רהיטים ומוצרים לפי חדר", icon: Sofa, tone: "bg-primary-soft text-primary", phase: 2 },
  { label: "חשבונות והוצאות", description: "חשמל, מים, ארנונה ועוד", icon: Receipt, tone: "bg-sky-soft text-sky", phase: 4 },
  { label: "מכשירי חשמל", description: "אחריות, חשבוניות ותחזוקה", icon: Refrigerator, tone: "bg-surface-2 text-foreground/80", phase: 4 },
  { label: "מסמכים", description: "כספת מסמכים משותפת", icon: FileText, tone: "bg-surface-2 text-foreground/80", phase: 4 },
  { label: "יומן משותף", description: "טכנאים, משלוחים ואורחים", icon: CalendarDays, tone: "bg-sky-soft text-sky", phase: 4 },
  { label: "צמחים", description: "השקיה ותזכורות", icon: Leaf, tone: "bg-sage-soft text-sage", phase: 4 },
  { label: "בית חכם", description: "מזגן, דוד ותאורה דרך Home Assistant", icon: Lightbulb, tone: "bg-amber-soft text-amber", phase: 5 },
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
      <div className="grid gap-3 sm:grid-cols-2">
        <HubLink
          href="/inventory"
          icon={Boxes}
          tone="bg-primary-soft text-primary"
          label="מלאי הבית"
          description={count ? `${count} מוצרים במעקב` : "מה יש במקרר, במזווה ובארונות"}
        />
        <HubLink
          href="/household/settings"
          icon={Settings}
          tone="bg-surface-2 text-foreground/80"
          label="הגדרות"
          description="חברי הבית, הזמנות, חדרים וקטגוריות"
        />
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-muted">בקרוב ב-HomeOS</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {UPCOMING.map((t) => (
          <div key={t.label} aria-disabled className="flex items-center gap-4 rounded-[var(--radius)] border border-dashed border-border p-4 opacity-70">
            <div className={`grid size-11 shrink-0 place-items-center rounded-2xl ${t.tone}`}>
              <t.icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t.label}</span>
                <Badge>שלב {t.phase}</Badge>
              </div>
              <p className="truncate text-sm text-muted">{t.description}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function HubLink({ href, icon: Icon, tone, label, description }: { href: string; icon: LucideIcon; tone: string; label: string; description: string }) {
  return (
    <Link href={href} className="group">
      <Card className="flex items-center gap-4 p-4 transition-all group-hover:shadow-lift group-active:scale-[0.99]">
        <div className={`grid size-12 shrink-0 place-items-center rounded-2xl ${tone}`}>
          <Icon className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{label}</div>
          <p className="truncate text-sm text-muted">{description}</p>
        </div>
        <ChevronLeft className="size-5 text-muted" />
      </Card>
    </Link>
  );
}
