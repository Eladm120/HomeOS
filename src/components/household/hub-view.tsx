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

/** The household hub: three big everyday doors, then the quieter rooms of the house. */
export function HubView({ counts: c, alerts }: { counts: HubCounts; alerts: number }) {
  const sub: Record<string, string> = {
    "/smart-home": c.devices ? plural(c.devices, "מכשיר אחד", "מכשירים") : "מזגן, דוד ותאורה",
    "/appliances": c.appliances ? plural(c.appliances, "מכשיר אחד", "מכשירים") : "אחריות ותחזוקה",
    "/plants": c.plants ? plural(c.plants, "צמח אחד", "צמחים") : "השקיה ותזכורות",
    "/bills": c.bills ? `${c.bills} לתשלום` : "חשמל, מים, ארנונה",
    "/expenses": "שכירות וחיובים קבועים",
    "/documents": c.documents ? plural(c.documents, "מסמך אחד", "מסמכים") : "ביטוחים וחוזים",
  };

  return (
    <div className="space-y-7 pb-4">
      {/* Everyday */}
      <div className="grid grid-cols-2 gap-3">
        <BigDoor
          link={HUB_MAIN.inventory}
          className="col-span-2"
          tone="bg-honey-soft"
          title={HUB_MAIN.inventory.label}
          line={c.inventory ? `${c.inventory} מוצרים בבית` : "מה יש במקרר, במזווה ובארונות"}
          badge={c.low ? { text: `${c.low} מתחת למינימום`, className: "bg-surface text-terracotta" } : undefined}
          wide
        />
        <BigDoor
          link={HUB_MAIN.chores}
          tone="bg-sage-soft"
          title={HUB_MAIN.chores.label}
          line={c.choresToday ? `${c.choresToday} להיום` : c.choresTotal ? "הכל בוצע היום" : "מטלות חוזרות"}
          badge={c.choresToday ? { text: "היום", className: "bg-surface text-sage" } : undefined}
        />
        <BigDoor link={HUB_MAIN.meals} tone="bg-terracotta-soft" title={HUB_MAIN.meals.label} line={c.meals ? `${c.meals} ארוחות השבוע` : "מה אוכלים השבוע"} />
      </div>

      {/* Attention */}
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

      {/* The house */}
      <section>
        <Heading>הבית</Heading>
        <div className="grid grid-cols-3 gap-2.5">
          {HUB_HOME.map((l) => (
            <Tile key={l.href} link={l} sub={sub[l.href]} />
          ))}
        </div>
      </section>

      {/* Management: one module */}
      <section>
        <Heading>ניהול</Heading>
        <div className="card p-2.5">
          <div className="grid grid-cols-3 gap-2">
            {HUB_MANAGE.map((l) => (
              <Link key={l.href} href={l.href} className="pressable flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-center active:bg-fill">
                <span className="cat-tint grid size-12 place-items-center rounded-2xl text-[24px]" style={{ "--h": l.hue } as React.CSSProperties} aria-hidden>
                  {l.emoji}
                </span>
                <span className="text-[14px] leading-tight font-semibold">{l.label}</span>
                <span className={cn("text-[12px] leading-tight", l.href === "/bills" && c.bills ? "font-semibold text-terracotta" : "text-muted")}>{sub[l.href]}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

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

function BigDoor({ link, title, line, tone, badge, wide, className }: { link: HubLink; title: string; line: string; tone: string; badge?: { text: string; className: string }; wide?: boolean; className?: string }) {
  return (
    <Link href={link.href} className={cn("pressable relative flex overflow-hidden rounded-[1.5rem] p-4", wide ? "min-h-[118px] items-end" : "min-h-[150px] flex-col justify-between", tone, className)}>
      <span aria-hidden className={cn("leading-none drop-shadow-sm", wide ? "absolute end-4 top-1/2 -translate-y-1/2 text-[64px]" : "text-[40px]")}>
        {link.emoji}
      </span>
      <span className="relative block">
        {badge && <span className={cn("mb-2 inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-bold", badge.className)}>{badge.text}</span>}
        <span className="block text-[20px] leading-tight font-semibold [font-family:var(--font-display)]">{title}</span>
        <span className="mt-0.5 block text-[14px] text-foreground/65">{line}</span>
      </span>
    </Link>
  );
}

function Tile({ link, sub }: { link: HubLink; sub?: string }) {
  return (
    <Link href={link.href} className="card pressable flex flex-col gap-2 p-3">
      <span className="cat-tint grid size-11 place-items-center rounded-2xl text-[22px]" style={{ "--h": link.hue } as React.CSSProperties} aria-hidden>
        {link.emoji}
      </span>
      <span>
        <span className="block text-[15px] leading-tight font-semibold">{link.label}</span>
        {sub && <span className="mt-0.5 block text-[12px] leading-tight text-muted">{sub}</span>}
      </span>
    </Link>
  );
}
