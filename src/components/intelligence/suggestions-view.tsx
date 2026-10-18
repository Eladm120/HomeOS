"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellOff, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { actOnSuggestion, dismissSuggestion } from "@/server/actions/intelligence";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeading } from "@/components/ui/panel";

export interface SuggestionView {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  priority: "low" | "normal" | "high";
  href: string | null;
  action: { type: string } | null;
  confidence: number | null;
  created_at: string;
}

export const SUGGESTION_KIND: Record<string, { label: string; emoji: string; hue: number }> = {
  low_stock: { label: "מלאי", emoji: "📦", hue: 55 },
  expiring: { label: "תוקף", emoji: "⏳", hue: 30 },
  overdue_chore: { label: "משימות", emoji: "🧹", hue: 185 },
  chore_due: { label: "משימות", emoji: "🧹", hue: 185 },
  warranty: { label: "אחריות", emoji: "🛡️", hue: 235 },
  bill_due: { label: "חשבונות", emoji: "🧾", hue: 300 },
  bill_unusual: { label: "חשבונות", emoji: "📈", hue: 300 },
  repair_followup: { label: "תיקונים", emoji: "🔧", hue: 30 },
  recipe: { label: "מתכונים", emoji: "🍲", hue: 140 },
  meal_plan: { label: "ארוחות", emoji: "🍽️", hue: 140 },
  device: { label: "בית חכם", emoji: "💡", hue: 75 },
  plant_water: { label: "צמחים", emoji: "🪴", hue: 140 },
  document_expiry: { label: "מסמכים", emoji: "📄", hue: 260 },
  reminder: { label: "תזכורת", emoji: "🔔", hue: 260 },
};

const ACTION_LABEL: Record<string, string> = { add_inventory_to_list: "לרשימת הקניות", complete_chore: "בוצע ✓" };

export function SuggestionCard({ s, compact, onDone }: { s: SuggestionView; compact?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const kind = SUGGESTION_KIND[s.kind] ?? SUGGESTION_KIND.reminder;

  async function run(fn: () => Promise<{ ok: boolean; error?: string; data?: { message?: string } | null }>, success?: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return void toast.error(res.error ?? "שגיאה");
    toast.success(res.data?.message ?? success ?? "בוצע");
    onDone?.();
    router.refresh();
  }

  return (
    <div className={cn("flex gap-3 px-4 py-3", busy && "opacity-60")}>
      <span aria-hidden className="cat-tint grid size-10 shrink-0 place-items-center rounded-[12px] text-[20px]" style={{ "--h": kind.hue } as React.CSSProperties}>
        {kind.emoji}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          {s.href ? (
            <Link href={s.href} className="font-medium leading-snug">
              {s.title}
            </Link>
          ) : (
            <span className="font-medium leading-snug">{s.title}</span>
          )}
          {s.priority === "high" && <Badge tone="danger">חשוב</Badge>}
        </div>
        {s.body && !compact && <p className="footnote text-muted">{s.body}</p>}
        {s.confidence != null && s.confidence < 0.8 && <Badge>הערכה</Badge>}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {s.action && ACTION_LABEL[s.action.type] && (
            <Button size="sm" variant="soft" disabled={busy} onClick={() => run(() => actOnSuggestion(s.id))}>
              {ACTION_LABEL[s.action.type]}
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => dismissSuggestion(s.id, "snooze"), "נזכיר שוב בעוד כמה ימים")}>
            לא עכשיו
          </Button>
          {!compact && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => dismissSuggestion(s.id, "mute"), "לא נציע את זה שוב")}>
              <BellOff /> לא להציע שוב
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SuggestionsView({ suggestions }: { suggestions: SuggestionView[] }) {
  const groups = new Map<string, SuggestionView[]>();
  for (const s of suggestions) {
    const label = (SUGGESTION_KIND[s.kind] ?? SUGGESTION_KIND.reminder).label;
    groups.set(label, [...(groups.get(label) ?? []), s]);
  }
  return (
    <>
      <PageHeader title="הצעות" back={{ href: "/household", label: "משק הבית" }} subtitle="מה HomeOS שם לב אליו, לפי הנתונים שלכם" />
      {suggestions.length === 0 ? (
        <EmptyState icon={<Lightbulb />} title="אין הצעות כרגע" description="כשמשהו עומד להיגמר, תוקף מתקרב או משימה מתעכבת — זה יופיע כאן." />
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([label, list]) => (
            <section key={label}>
              <PanelHeading title={label} count={list.length} />
              <Panel>
                {list.map((s) => (
                  <SuggestionCard key={s.id} s={s} />
                ))}
              </Panel>
            </section>
          ))}
          <p className="footnote px-1 text-center text-muted">ההצעות מחושבות מהנתונים בבית ולא נשלחות לאף אחד מחוץ לבית.</p>
        </div>
      )}
    </>
  );
}
