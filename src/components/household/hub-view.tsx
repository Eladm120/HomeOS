import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel, PanelRow } from "@/components/ui/panel";
import { HUB_HOME, HUB_MAIN, HUB_MANAGE, HUB_SETTINGS, type HubLink } from "@/components/layout/hub-sections";

export interface HubCounts {
  inventory: number;
  low: number;
  choresToday: number;
  choresTotal: number;
  meals: number;
  appliances: number;
  plants: number;
  bills: number;
  documents: number;
  devices: number;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

/** The household hub: every section uses the same grouped tile module, so the page reads as one system. */
export function HubView({ counts: c, alerts }: { counts: HubCounts; alerts: number }) {
  const sub: Record<string, { text: string; alert?: boolean }> = {
    "/inventory": c.low ? { text: `${c.low} מתחת למינימום`, alert: true } : { text: c.inventory ? `${c.inventory} מוצרים` : "מקרר, מזווה וארונות" },
    "/chores": c.choresToday ? { text: `${c.choresToday} להיום`, alert: true } : { text: c.choresTotal ? "הכל בוצע היום" : "מטלות חוזרות" },
    "/meals": { text: c.meals ? `${c.meals} ארוחות השבוע` : "מה אוכלים השבוע" },
    "/smart-home": { text: c.devices ? plural(c.devices, "מכשיר אחד", "מכשירים") : "מזגן, דוד ותאורה" },
    "/appliances": { text: c.appliances ? plural(c.appliances, "מכשיר אחד", "מכשירים") : "קבלה, אחריות ותיקונים" },
    "/plants": { text: c.plants ? plural(c.plants, "צמח אחד", "צמחים") : "השקיה ותזכורות" },
    "/bills": c.bills ? { text: `${c.bills} לתשלום`, alert: true } : { text: "חשמל, מים, ארנונה" },
    "/expenses": { text: "שכירות וחיובים קבועים" },
    "/documents": { text: c.documents ? plural(c.documents, "מסמך אחד", "מסמכים") : "ביטוחים וחוזים" },
  };

  return (
    <div className="space-y-7 pb-4">
      <Link href="/notifications" className="card pressable flex items-center gap-3.5 p-4">
        <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-terracotta-soft text-[24px]" aria-hidden>
          🔔
          {alerts > 0 && <span className="num absolute -top-1 -end-1 grid h-5 min-w-5 place-items-center rounded-full bg-terracotta px-1 text-[11px] font-bold text-white">{alerts}</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="headline block">התראות</span>
          <span className="footnote block text-muted">{alerts ? `${alerts} דברים מחכים לך — מלאי, תשלומים ומשימות` : "הכל מטופל. נעדכן כשמשהו יקרה"}</span>
        </span>
        <ChevronLeft className="size-5 text-muted-2" />
      </Link>

      <ModuleGrid title="יומיום" links={Object.values(HUB_MAIN)} sub={sub} />
      <ModuleGrid title="הבית" links={HUB_HOME} sub={sub} />
      <ModuleGrid title="ניהול" links={HUB_MANAGE} sub={sub} />

      <section>
        <Heading>הגדרות</Heading>
        <Panel>
          {HUB_SETTINGS.map((l) => (
            <PanelRow
              key={l.href}
              href={l.href}
              leading={
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-fill text-[18px]">
                  {l.emoji}
                </span>
              }
              title={l.label}
            />
          ))}
        </Panel>
      </section>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2.5 px-1 text-[19px] font-semibold [font-family:var(--font-display)]">{children}</h2>;
}

/** One grouped module: a single surface holding a row of three tiles. */
function ModuleGrid({ title, links, sub }: { title: string; links: HubLink[]; sub: Record<string, { text: string; alert?: boolean }> }) {
  return (
    <section>
      <Heading>{title}</Heading>
      <div className="card p-2.5">
        <div className="grid grid-cols-3 gap-2">
          {links.map((l) => {
            const s = sub[l.href];
            return (
              <Link key={l.href} href={l.href} className="pressable flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-center active:bg-fill">
                <span className="cat-tint grid size-12 place-items-center rounded-2xl text-[24px]" style={{ "--h": l.hue } as React.CSSProperties} aria-hidden>
                  {l.emoji}
                </span>
                <span className="text-[14px] leading-tight font-semibold">{l.label}</span>
                {s && <span className={cn("text-[12px] leading-tight", s.alert ? "font-semibold text-terracotta" : "text-muted")}>{s.text}</span>}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
