"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, ChevronLeft, Clock, Loader2, Power, RotateCw } from "lucide-react";
import { toast } from "sonner";
import type { AlertItem } from "@/lib/alerts";
import { suggestProducts } from "@/lib/grocery";
import { guessCategoryId } from "@/lib/category-style";
import { parseBulkLine } from "@/lib/validation";
import { formatQuantity, relativeDays } from "@/lib/format";
import { PROJECT_STATUS, PURCHASE_STATUS } from "@/lib/labels";
import type { DeviceCommand } from "@/lib/home-assistant";
import type { ProductCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { addShoppingItem, setShoppingItemStatus } from "@/server/actions/grocery";
import { completeChore } from "@/server/actions/chores";
import { sendDeviceCommand } from "@/server/actions/integrations";
import { AlertList } from "@/components/alerts/alert-list";
import { CheckCircle } from "@/components/grocery/item-row";
import { SignedImage } from "@/components/media/signed-image";
import { RecipeImage } from "@/components/recipes/recipes-view";
import { Highlight } from "@/components/ui/product-combobox";
import { ConfirmSheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/card";
import type { DashboardMeal, DashboardTask, DashDevice, DashProject, DashPurchase, GroceryGlance, ReadyRecipe } from "./types";

// ---- Shell ---------------------------------------------------------------------

export function WidgetShell({
  id,
  title,
  meta,
  href,
  hrefLabel = "הכל",
  aside,
  children,
  className,
}: {
  id?: string;
  title: string;
  meta?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-label={title} className={cn("widget scroll-mt-6", className)}>
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <span className="min-w-0 flex-1">
          <h2 className="text-[17px] leading-tight font-semibold [font-family:var(--font-display)]">{title}</h2>
          {meta && <span className="footnote mt-0.5 block truncate text-muted">{meta}</span>}
        </span>
        {aside}
        {href && (
          <Link href={href} className="flex h-8 shrink-0 items-center rounded-full px-2 text-[14px] font-medium text-primary active:bg-fill">
            {hrefLabel}
            <ChevronLeft className="size-4" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/** A widget that has nothing to show collapses into one of these small tiles. */
export interface EmptyTileProps {
  key: string;
  emoji: string;
  hue: number;
  title: string;
  text: string;
  href: string;
}

export function EmptyTile({ emoji, hue, title, text, href }: Omit<EmptyTileProps, "key">) {
  return (
    <Link href={href} className="widget pressable flex items-center gap-3 p-3">
      <span aria-hidden className="cat-tint grid size-10 shrink-0 place-items-center rounded-[14px] text-[20px]" style={{ "--h": hue } as React.CSSProperties}>
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] leading-tight font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-[12px] leading-tight text-primary">{text}</span>
      </span>
    </Link>
  );
}

export function WidgetError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="widget flex items-center gap-3 p-3.5">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-danger-soft text-[18px]">
        ⚠️
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{title}</span>
        <span className="block text-[12px] text-muted">לא הצלחנו לטעון כרגע</span>
      </span>
      <button type="button" onClick={onRetry} className="pressable flex h-9 items-center gap-1.5 rounded-full bg-fill px-3 text-[13px] font-semibold">
        <RotateCw className="size-3.5" /> שוב
      </button>
    </div>
  );
}

// ---- Shopping ------------------------------------------------------------------

export function GroceryWidget({
  grocery,
  categories,
  inventory,
  preview,
}: {
  grocery: { count: number; urgent: number; inCart: number; items: GroceryGlance[] };
  categories: ProductCategory[];
  inventory: { id: string; name: string; unit: string }[];
  preview?: boolean;
}) {
  const router = useRouter();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [gone, setGone] = useState<Set<string>>(new Set());
  const items = grocery.items.filter((i) => !gone.has(i.id));
  const left = grocery.count - gone.size;

  async function tick(item: GroceryGlance) {
    if (ticked.has(item.id)) return;
    setTicked((s) => new Set(s).add(item.id));
    if (!preview) {
      const res = await setShoppingItemStatus({ id: item.id, status: "purchased" });
      if (!res.ok) {
        setTicked((s) => {
          const n = new Set(s);
          n.delete(item.id);
          return n;
        });
        return void toast.error(res.error);
      }
    }
    setTimeout(() => setGone((s) => new Set(s).add(item.id)), 550);
    toast(`${item.name} בעגלה ✓`, {
      action: {
        label: "ביטול",
        onClick: async () => {
          if (!preview) await setShoppingItemStatus({ id: item.id, status: "pending" });
          setTicked((s) => {
            const n = new Set(s);
            n.delete(item.id);
            return n;
          });
          setGone((s) => {
            const n = new Set(s);
            n.delete(item.id);
            return n;
          });
          if (!preview) router.refresh();
        },
      },
    });
  }

  const meta = left
    ? [`${left} לקנות`, grocery.urgent ? `${grocery.urgent} דחופים` : null, grocery.inCart + gone.size ? `${grocery.inCart + gone.size} בעגלה` : null].filter(Boolean).join(" · ")
    : "מה שיורד מתחת למינימום במלאי נכנס לבד";

  return (
    <WidgetShell id="grocery" title={left ? "רשימת הקניות" : "הרשימה ריקה"} meta={meta} href={left || grocery.inCart ? "/shopping" : undefined}>
      {items.length > 0 && (
        <ul className="hairline-list-inset [--separator-inset:4rem]">
          {items.map((g) => {
            const on = ticked.has(g.id);
            return (
              <li key={g.id} className={cn("grid transition-[grid-template-rows,opacity] duration-300", gone.has(g.id) ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]")}>
                <div className="flex min-h-[54px] items-center gap-3 overflow-hidden px-4 py-1.5">
                  {g.image_path ? (
                    <SignedImage path={g.image_path} alt="" className="size-10 shrink-0 rounded-xl" />
                  ) : (
                    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-[20px]">
                      {g.emoji}
                    </span>
                  )}
                  <span className={cn("min-w-0 flex-1 truncate text-[16px] font-medium transition-colors", on && "text-muted line-through")}>{g.name}</span>
                  {g.urgent && !on && <span className="shrink-0 rounded-full bg-terracotta-soft px-2 py-0.5 text-[11px] font-bold text-terracotta">דחוף</span>}
                  {(g.quantity !== 1 || g.unit !== "יח׳") && (
                    <span className="num shrink-0 text-[13px] text-muted">
                      {formatQuantity(g.quantity)} {g.unit}
                    </span>
                  )}
                  <CheckCircle checked={on} onToggle={() => tick(g)} label={`${g.name} לעגלה`} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {left > items.length && (
        <Link href="/shopping" className="footnote block px-4 pb-1 font-medium text-primary">
          ועוד {left - items.length} ברשימה
        </Link>
      )}
      <QuickAddRow categories={categories} inventory={inventory} preview={preview} />
    </WidgetShell>
  );
}

/** Inline add with suggestions from what the home already stocks. */
export function QuickAddRow({
  categories,
  inventory,
  preview,
  autoFocus,
  onAdded,
}: {
  categories: ProductCategory[];
  inventory: { id: string; name: string; unit: string }[];
  preview?: boolean;
  autoFocus?: boolean;
  onAdded?: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseBulkLine(draft), [draft]);
  const suggestions = useMemo(() => (parsed && parsed.name.length >= 2 ? suggestProducts(parsed.name, inventory, 5) : []), [parsed, inventory]);

  async function add(name: string, unit: string, inventoryId: string | null) {
    if (!parsed || busy) return;
    setBusy(true);
    const res = preview
      ? ({ ok: true, data: { merged: false } } as const)
      : await addShoppingItem({ name, quantity: parsed.quantity, unit, category_id: guessCategoryId(name, categories), inventory_item_id: inventoryId, save_to_catalog: false });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setDraft("");
    toast.success(res.data.merged ? `${name} כבר ברשימה, עדכנתי את הכמות` : `${name} נוסף לרשימה`);
    onAdded?.();
    if (!preview) router.refresh();
  }

  return (
    <div className="px-3 pt-1 pb-3">
      {suggestions.length > 0 && (
        <div role="listbox" aria-label="הצעות מהמלאי" className="scrollbar-none mb-2 flex gap-1.5 overflow-x-auto">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={false}
              disabled={busy}
              onClick={() => add(s.name, parsed!.unit === "יח׳" ? s.unit : parsed!.unit, s.id)}
              className="pressable flex h-8 shrink-0 items-center rounded-full bg-primary-soft px-3 text-[14px] text-primary"
            >
              <Highlight text={s.name} query={parsed?.name ?? ""} />
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed) void add(parsed.name, parsed.unit, null);
        }}
        className="flex items-center gap-1.5 rounded-full bg-fill p-1"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="מה צריך לקנות? (למשל 2 חלב)"
          aria-label="הוספה לרשימת הקניות"
          maxLength={120}
          enterKeyHint="send"
          autoFocus={autoFocus}
          className="h-9 min-w-0 flex-1 bg-transparent px-3 text-[16px] outline-none placeholder:text-muted"
        />
        <button type="submit" disabled={!parsed || busy} aria-label="הוספה" className="pressable grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-30">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-[18px]" strokeWidth={2.75} />}
        </button>
      </form>
    </div>
  );
}

// ---- Tasks ---------------------------------------------------------------------

export function TasksWidget({
  tasks,
  doneToday,
  members,
  currentUserId,
  preview,
}: {
  tasks: DashboardTask[];
  doneToday: number;
  members: { id: string; name: string }[];
  currentUserId: string;
  preview?: boolean;
}) {
  const router = useRouter();
  const [mine, setMine] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [gone, setGone] = useState<Set<string>>(new Set());

  const visible = tasks.filter((t) => !gone.has(t.id) && (!mine || t.assigneeId === currentUserId || !t.assigneeId));
  const now = visible.filter((t) => t.days <= 0);
  const tomorrow = visible.filter((t) => t.days === 1);
  const shown = [...now, ...tomorrow].slice(0, 5);
  const todayOpen = tasks.filter((t) => t.days <= 0 && !gone.has(t.id)).length;
  const completed = doneToday + gone.size;
  const total = completed + todayOpen;

  async function complete(t: DashboardTask) {
    if (done.has(t.id)) return;
    setDone((s) => new Set(s).add(t.id));
    if (!preview) {
      const res = await completeChore(t.id);
      if (!res.ok) {
        setDone((s) => {
          const n = new Set(s);
          n.delete(t.id);
          return n;
        });
        return void toast.error(res.error);
      }
      toast.success(`${t.title} ✓`);
    }
    setTimeout(() => {
      setGone((s) => new Set(s).add(t.id));
      if (!preview) router.refresh();
    }, 650);
  }

  const memberIndex = (id: string | null) => members.findIndex((m) => m.id === id);

  return (
    <WidgetShell
      id="tasks"
      title="משימות"
      meta={todayOpen ? `${todayOpen} פתוחות להיום${now.some((t) => t.days < 0) ? " · יש באיחור" : ""}` : completed ? "כל משימות היום בוצעו" : "להיום ולמחר"}
      href="/chores"
      aside={
        <>
          {members.length > 1 && (
            <div className="flex rounded-full bg-fill p-0.5 text-[12px] font-semibold" role="group" aria-label="של מי">
              {[
                { v: false, l: "כולם" },
                { v: true, l: "שלי" },
              ].map((o) => (
                <button key={o.l} type="button" aria-pressed={mine === o.v} onClick={() => setMine(o.v)} className={cn("h-7 rounded-full px-2.5 transition-colors", mine === o.v ? "bg-surface shadow-sm" : "text-muted")}>
                  {o.l}
                </button>
              ))}
            </div>
          )}
          {total > 0 && <ProgressRing done={completed} total={total} />}
        </>
      }
    >
      {shown.length ? (
        <ul className="hairline-list-inset pb-1.5 [--separator-inset:3.75rem]">
          {shown.map((t, i) => {
            const isDone = done.has(t.id);
            const idx = memberIndex(t.assigneeId);
            const firstTomorrow = t.days === 1 && (i === 0 || shown[i - 1].days !== 1);
            return (
              <li key={t.id}>
                {firstTomorrow && <p className="eyebrow px-4 pt-2 pb-0.5">מחר</p>}
                <div className={cn("flex min-h-[54px] items-center gap-3 px-4 py-1.5", t.days === 1 && "opacity-80")}>
                  <CheckCircle checked={isDone} onToggle={() => complete(t)} label={`סימון ${t.title} כבוצע`} />
                  <Link href={`/chores/${t.id}`} className="min-w-0 flex-1 active:opacity-60">
                    <span className={cn("block truncate text-[16px] font-medium", isDone && "text-muted line-through")}>{t.title}</span>
                    {t.detail && <span className="footnote block truncate text-muted">{t.detail}</span>}
                  </Link>
                  {t.days < 0 && !isDone && <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-bold text-danger">{relativeDays(t.days)}</span>}
                  {idx >= 0 ? <Avatar name={t.assigneeName ?? ""} index={idx} className="size-7 text-[12px]" /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 pb-4 text-[15px] text-muted">{mine ? "אין לך משימות פתוחות להיום." : "אין משימות פתוחות להיום 🎉"}</p>
      )}
      {visible.length > shown.length && (
        <Link href="/chores" className="footnote block px-4 pb-3 font-medium text-primary">
          ועוד {visible.length - shown.length}
        </Link>
      )}
    </WidgetShell>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 13;
  const c = 2 * Math.PI * r;
  const p = total ? done / total : 0;
  return (
    <span className="relative grid size-9 shrink-0 place-items-center" role="img" aria-label={`${done} מתוך ${total} משימות היום בוצעו`}>
      <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90">
        <circle cx="16" cy="16" r={r} fill="none" stroke="var(--fill-strong)" strokeWidth="3" />
        <circle cx="16" cy="16" r={r} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <span className="num text-[10px] font-bold">
        {done}/{total}
      </span>
    </span>
  );
}

export function Avatar({ name, index, className }: { name: string; index: number; className?: string }) {
  const palette = ["bg-primary text-primary-foreground", "bg-terracotta text-white", "bg-honey text-white", "bg-sky text-white"];
  return (
    <span title={name} className={cn("grid shrink-0 place-items-center rounded-full font-bold", palette[index % palette.length], className)}>
      {name.slice(0, 1) || "?"}
    </span>
  );
}

// ---- Meals ---------------------------------------------------------------------

export function MealsWidget({ meals, ready }: { meals: DashboardMeal[]; ready: ReadyRecipe[] }) {
  const planned = meals.length > 0;
  const cards = planned
    ? meals.map((m) => ({ key: m.id, href: m.href, title: m.title, over: m.slot, r: m }))
    : ready.map((r) => ({ key: r.id, href: `/recipes/${r.id}`, title: r.title, over: r.minutes ? `${r.minutes} דק׳` : "יש הכל בבית", r }));
  return (
    <WidgetShell id="meals" title={planned ? "מה אוכלים היום" : "אפשר לבשל עכשיו"} meta={planned ? undefined : "מתכונים שכל המצרכים שלהם במלאי"} href={planned ? "/meals" : "/recipes"} hrefLabel={planned ? "לתכנון" : "מתכונים"}>
      <div className="scrollbar-none flex snap-x gap-2.5 overflow-x-auto px-4 pb-4">
        {cards.map((c) => (
          <Link key={c.key} href={c.href} className="pressable relative h-[132px] w-[150px] shrink-0 snap-start overflow-hidden rounded-[1.125rem]">
            <RecipeImage r={c.r} className="absolute inset-0 size-full text-[40px]" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-2.5 text-white">
              <span className="block text-[11px] font-semibold opacity-85">{c.over}</span>
              <span className="block truncate text-[15px] leading-tight font-semibold">{c.title}</span>
            </span>
          </Link>
        ))}
        {planned && (
          <Link href="/meals" className="pressable grid h-[132px] w-[96px] shrink-0 snap-start place-items-center rounded-[1.125rem] border border-dashed border-border text-center text-[13px] font-medium text-primary">
            <span>
              <span className="block text-[22px]">＋</span>
              ארוחה
            </span>
          </Link>
        )}
      </div>
    </WidgetShell>
  );
}

// ---- Attention -----------------------------------------------------------------

export function AttentionWidget({ alerts, total, preview }: { alerts: AlertItem[]; total: number; preview?: boolean }) {
  return (
    <WidgetShell id="attention" title="דורש טיפול" meta="מלאי, תוקף, תשלומים ואחריות" href="/notifications" hrefLabel={total > alerts.length ? `הכל · ${total}` : "הכל"}>
      <AlertList alerts={alerts} preview={preview} className="rounded-none shadow-none [border:0]" />
    </WidgetShell>
  );
}

// ---- Smart home ----------------------------------------------------------------

const DEVICE_EMOJI: Record<string, string> = { climate: "❄️", water_heater: "♨️", switch: "🔌", light: "💡", sensor: "🌡️", other: "🏠" };
const DEVICE_GLOW: Record<string, string> = { climate: "bg-sky-soft", water_heater: "bg-terracotta-soft", switch: "bg-sage-soft", light: "bg-honey-soft", other: "bg-sage-soft" };
const HVAC: Record<string, string> = { cool: "קירור", heat: "חימום", auto: "אוטו", dry: "ייבוש", fan_only: "מאוורר", heat_cool: "חימום/קירור" };

const deviceOn = (d: DashDevice) => d.state != null && d.state !== "off" && d.state !== "unavailable" && d.kind !== "sensor";

function deviceLine(d: DashDevice): string {
  if (!d.online || d.state === "unavailable") return "לא מחובר";
  const a = d.attributes;
  if (d.kind === "sensor") return `${d.state ?? "—"}${typeof a.unit_of_measurement === "string" ? ` ${a.unit_of_measurement}` : ""}`;
  if (d.kind === "climate") {
    const cur = typeof a.current_temperature === "number" ? `${a.current_temperature}° בחדר` : null;
    return d.state === "off" ? ["כבוי", cur].filter(Boolean).join(" · ") : [HVAC[d.state ?? ""] ?? "פועל", typeof a.temperature === "number" ? `${a.temperature}°` : null].filter(Boolean).join(" · ");
  }
  return deviceOn(d) ? "דולק" : "כבוי";
}

export function SmartHomeWidget({ devices, preview }: { devices: DashDevice[]; preview?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ device: DashDevice; cmd: DeviceCommand } | null>(null);

  async function run(device: DashDevice, cmd: DeviceCommand, confirmed = false) {
    if (preview) return;
    setBusy(device.id);
    const res = await sendDeviceCommand(device.id, cmd, confirmed);
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    if (res.data.status === "needs_confirmation") return setConfirm({ device, cmd });
    if (res.data.status === "succeeded") toast.success(`${device.name}: בוצע`);
    else if (res.data.status === "unconfirmed") toast.message(res.data.message);
    else toast.error(res.data.message);
    router.refresh();
  }

  const on = devices.filter(deviceOn).length;
  return (
    <WidgetShell id="smarthome" title="בית חכם" meta={on ? `${on} דולקים עכשיו` : "הכל כבוי"} href="/smart-home">
      <div className="grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-3">
        {devices.map((d) => {
          const isOn = deviceOn(d);
          const canToggle = !!d.capabilities.power && d.online && d.state !== "unavailable";
          return (
            <div key={d.id} className={cn("flex min-h-[92px] flex-col justify-between rounded-[1.125rem] p-3 transition-colors", isOn ? (DEVICE_GLOW[d.kind] ?? "bg-sage-soft") : "bg-surface-2")}>
              <div className="flex items-start justify-between gap-2">
                <span aria-hidden className={cn("text-[22px] leading-none", !isOn && "opacity-60 grayscale")}>
                  {DEVICE_EMOJI[d.kind] ?? "🏠"}
                </span>
                {canToggle && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    aria-label={`${d.name} ${isOn ? "כיבוי" : "הדלקה"}`}
                    disabled={busy === d.id}
                    onClick={() => run(d, { type: "power", on: !isOn })}
                    className={cn("pressable grid size-8 place-items-center rounded-full", isOn ? "bg-foreground text-background" : "bg-fill text-foreground/70")}
                  >
                    {busy === d.id ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" strokeWidth={2.5} />}
                  </button>
                )}
              </div>
              <Link href="/smart-home" className="min-w-0">
                <span className="block truncate text-[14px] leading-tight font-semibold">{d.name}</span>
                <span className="block truncate text-[12px] text-foreground/65">{deviceLine(d)}</span>
              </Link>
            </div>
          );
        })}
      </div>
      <ConfirmSheet
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? `לבצע ב${confirm.device.name}?` : ""}
        description="המכשיר מסומן כדורש אישור לפני הפעלה."
        confirmLabel="אישור"
        onConfirm={() => {
          if (confirm) void run(confirm.device, confirm.cmd, true);
          setConfirm(null);
        }}
      />
    </WidgetShell>
  );
}

// ---- Projects & purchases -------------------------------------------------------

export function ProjectsWidget({ projects, purchases }: { projects: DashProject[]; purchases: DashPurchase[] }) {
  return (
    <WidgetShell id="projects" title="פרויקטים וקניות לבית" href={projects.length ? "/projects" : "/planner"}>
      <ul className="hairline-list-inset pb-2 [--separator-inset:3.75rem]">
        {projects.map((p) => (
          <li key={p.id}>
            <Link href={`/projects/${p.id}`} className="flex min-h-[54px] items-center gap-3 px-4 py-2 active:bg-fill">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-fill text-[17px]">
                {p.kind === "repair" ? "🔧" : "🛠️"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{p.title}</span>
                {p.total > 0 ? (
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${(p.done / p.total) * 100}%` }} />
                    </span>
                    <span className="num text-[11px] text-muted">
                      {p.done}/{p.total}
                    </span>
                  </span>
                ) : (
                  <span className="footnote block text-muted">{PROJECT_STATUS[p.status].label}</span>
                )}
              </span>
              {p.status === "waiting" && <Clock className="size-4 shrink-0 text-amber" aria-label="ממתין" />}
            </Link>
          </li>
        ))}
        {purchases.map((p) => (
          <li key={p.id}>
            <Link href={`/planner/${p.id}`} className="flex min-h-[54px] items-center gap-3 px-4 py-2 active:bg-fill">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-fill text-[17px]">
                🛋️
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{p.name}</span>
              <Badge tone={PURCHASE_STATUS[p.status].tone}>{PURCHASE_STATUS[p.status].label}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}
