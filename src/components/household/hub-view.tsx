"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronLeft, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel, PanelRow } from "@/components/ui/panel";
import { QuickCreateSheet } from "@/components/layout/quick-create";
import { HUB_GROUPS, HUB_SETTINGS, type HubGroup, type HubLink } from "@/components/layout/hub-sections";

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

/** What a tile says about its module: a short description, and a live status when there is one. */
interface TileState {
  text: string;
  status?: string;
  tone?: "alert" | "good" | "neutral";
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

function tileStates(c: HubCounts, alerts: number): Record<string, TileState> {
  return {
    "/inventory": {
      text: c.inventory ? `${c.inventory} מוצרים בבית` : "מקרר, מזווה וארונות",
      ...(c.low ? { status: `${c.low} נמוכים`, tone: "alert" as const } : c.inventory ? { status: "הכל במלאי", tone: "good" as const } : {}),
    },
    "/chores": {
      text: c.choresTotal ? plural(c.choresTotal, "משימה קבועה אחת", "משימות קבועות") : "מי עושה מה, ומתי",
      ...(c.choresToday ? { status: `${c.choresToday} להיום`, tone: "alert" as const } : c.choresTotal ? { status: "בוצע היום", tone: "good" as const } : {}),
    },
    "/meals": {
      text: c.meals ? `${c.meals} ארוחות מתוכננות השבוע` : "מה אוכלים השבוע",
      ...(c.meals ? { status: "שבועי", tone: "neutral" as const } : { status: "לתכנן", tone: "alert" as const }),
    },
    "/notifications": {
      text: alerts ? "מלאי, תשלומים ומשימות" : "הכל מטופל",
      ...(alerts ? { status: `${alerts} חדשות`, tone: "alert" as const } : {}),
    },
    "/smart-home": { text: c.devices ? plural(c.devices, "מכשיר מחובר", "מכשירים מחוברים") : "מזגן, דוד ותאורה", ...(c.devices ? { status: "מחובר", tone: "good" as const } : {}) },
    "/appliances": { text: c.appliances ? plural(c.appliances, "מכשיר אחד", "מכשירים") : "קבלות, אחריות ותיקונים" },
    "/plants": { text: c.plants ? plural(c.plants, "צמח אחד", "צמחים") : "השקיה ותזכורות" },
    "/bills": {
      text: "חשמל, מים, ארנונה",
      ...(c.bills ? { status: `${c.bills} לתשלום`, tone: "alert" as const } : {}),
    },
    "/expenses": { text: "שכירות וחיובים קבועים" },
    "/documents": { text: c.documents ? plural(c.documents, "מסמך אחד", "מסמכים") : "ביטוחים וחוזים" },
  };
}

type Filter = "all" | HubGroup["id"];

/**
 * The household hub: a modular home for every module. Search and quick add on
 * top, then one tile per module — icon, what it is, and what's going on in it
 * right now — grouped into everyday, the home and management.
 */
export function HubView({ counts, alerts }: { counts: HubCounts; alerts: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [create, setCreate] = useState(false);
  const states = tileStates(counts, alerts);
  const groups = filter === "all" ? HUB_GROUPS : HUB_GROUPS.filter((g) => g.id === filter);

  return (
    <div className="space-y-6 pb-4">
      <div className="flex gap-2">
        <Link href="/search" className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl bg-surface px-4 text-[16px] text-muted shadow-[var(--card-shadow)]">
          <Search className="size-[18px] shrink-0" />
          <span className="truncate">חיפוש בכל הבית…</span>
        </Link>
        <button
          type="button"
          onClick={() => setCreate(true)}
          className="pressable flex h-12 shrink-0 items-center gap-1.5 rounded-2xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground"
        >
          <Plus className="size-5" strokeWidth={2.4} /> הוספה
        </button>
      </div>

      <div role="group" aria-label="סינון לפי קבוצה" className="scrollbar-none -mx-4 -mt-2 flex gap-2 overflow-x-auto px-4">
        {([{ id: "all", title: "הכל" }, ...HUB_GROUPS] as { id: Filter; title: string }[]).map((g) => {
          const active = filter === g.id;
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(g.id)}
              className={cn(
                "pressable h-9 shrink-0 rounded-full px-4 text-[14px] font-semibold transition-colors",
                active ? "bg-foreground text-background" : "bg-surface text-foreground/75 shadow-[var(--card-shadow)]",
              )}
            >
              {g.title}
            </button>
          );
        })}
      </div>

      {alerts > 0 && filter === "all" && (
        <Link href="/notifications" className="hero pressable flex items-center gap-3.5 p-4">
          <span aria-hidden className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Bell className="size-[22px]" strokeWidth={2.2} />
            <span className="num absolute -top-1 -end-1 grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1 text-[11px] font-bold text-background">{alerts}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold">{alerts === 1 ? "דבר אחד מחכה לך" : `${alerts} דברים מחכים לך`}</span>
            <span className="hero-muted block text-[13px]">מלאי נמוך, תשלומים קרובים ומשימות</span>
          </span>
          <ChevronLeft className="hero-muted size-5" />
        </Link>
      )}

      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`hub-${g.id}`}>
          <h2 id={`hub-${g.id}`} className="mb-2.5 px-1 text-[19px] font-semibold [font-family:var(--font-display)]">
            {g.title}
          </h2>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {g.links.map((l, i) => (
              <ModuleTile key={l.href} link={l} state={states[l.href]} wide={g.links.length % 2 === 1 && i === g.links.length - 1} />
            ))}
          </div>
        </section>
      ))}

      {filter === "all" && (
        <section aria-labelledby="hub-settings">
          <h2 id="hub-settings" className="mb-2.5 px-1 text-[19px] font-semibold [font-family:var(--font-display)]">
            מערכת
          </h2>
          <Panel>
            {HUB_SETTINGS.map((l) => (
              <PanelRow
                key={l.href}
                href={l.href}
                leading={
                  <span aria-hidden className="mod-chip grid size-9 shrink-0 place-items-center rounded-xl" style={{ "--h": l.hue } as React.CSSProperties}>
                    <l.icon className="size-[18px]" strokeWidth={2.1} />
                  </span>
                }
                title={l.label}
              />
            ))}
          </Panel>
        </section>
      )}

      <QuickCreateSheet open={create} onOpenChange={setCreate} />
    </div>
  );
}

/** `wide`: the odd one out in a group spans the row (lays out sideways) so the grid never leaves a hole. */
function ModuleTile({ link: l, state, wide }: { link: HubLink; state?: TileState; wide?: boolean }) {
  const Icon = l.icon;
  if (wide)
    return (
      <Link href={l.href} className="mod-tile pressable col-span-2 flex items-center gap-3.5 p-3.5 lg:col-span-1 lg:min-h-[150px] lg:flex-col lg:items-stretch" style={{ "--h": l.hue } as React.CSSProperties}>
        <span aria-hidden className="mod-chip grid size-12 shrink-0 place-items-center rounded-[16px]">
          <Icon className="size-6" strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1 lg:mt-auto">
          <span className="block text-[16px] leading-tight font-semibold">{l.label}</span>
          {state && <span className="mt-1 block truncate text-[12.5px] text-muted">{state.text}</span>}
        </span>
        {state?.status ? <StatusBadge state={state} /> : <ChevronLeft className="size-5 shrink-0 text-muted-2 lg:hidden" />}
      </Link>
    );
  return (
    <Link href={l.href} className="mod-tile pressable flex min-h-[150px] flex-col p-3.5" style={{ "--h": l.hue } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden className="mod-chip grid size-12 place-items-center rounded-[16px]">
          <Icon className="size-6" strokeWidth={1.9} />
        </span>
        {state?.status && <StatusBadge state={state} />}
      </div>
      <span className="mt-auto pt-4">
        <span className="block text-[16px] leading-tight font-semibold">{l.label}</span>
        {state && <span className="mt-1 line-clamp-2 block text-[12.5px] leading-snug text-muted">{state.text}</span>}
      </span>
    </Link>
  );
}

function StatusBadge({ state }: { state: TileState }) {
  return (
    <span
      className={cn(
        "mt-0.5 inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11.5px] font-bold whitespace-nowrap",
        state.tone === "alert" ? "bg-terracotta-soft text-terracotta" : state.tone === "good" ? "bg-sage-soft text-sage" : "bg-fill text-muted",
      )}
    >
      {state.status}
    </span>
  );
}
