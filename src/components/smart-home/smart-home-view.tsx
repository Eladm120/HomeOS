"use client";

import { Emoji3D } from "@/components/ui/emoji-3d";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, Power, RefreshCw, Settings2, Timer } from "lucide-react";
import { toast } from "sonner";
import { sendDeviceCommand, syncSmartHome, updateDevice } from "@/server/actions/integrations";
import type { DeviceCapabilities, DeviceCommand, DeviceKind } from "@/lib/home-assistant";
import { timeAgo } from "@/lib/format";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmSheet } from "@/components/ui/sheet";
import { Panel } from "@/components/ui/panel";

export interface DeviceView {
  id: string;
  name: string;
  kind: DeviceKind;
  online: boolean;
  state: string | null;
  attributes: Record<string, unknown>;
  capabilities: DeviceCapabilities;
  pinned: boolean;
  requires_confirmation: boolean;
  state_updated_at: string | null;
  room: string | null;
}

/** Each kind gets its own warm "on" glow, like a lamp in the room. */
const KIND_UI: Record<DeviceKind, { emoji: string; on: string; label: string }> = {
  climate: { emoji: "❄️", on: "bg-sky-soft", label: "מזגן" },
  water_heater: { emoji: "♨️", on: "bg-terracotta-soft", label: "דוד" },
  switch: { emoji: "🔌", on: "bg-sage-soft", label: "שקע" },
  light: { emoji: "💡", on: "bg-honey-soft", label: "תאורה" },
  sensor: { emoji: "🌡️", on: "bg-surface", label: "חיישן" },
  binary_sensor: { emoji: "📡", on: "bg-surface", label: "חיישן" },
  other: { emoji: "🏠", on: "bg-sage-soft", label: "מכשיר" },
};
const HVAC: Record<string, string> = { off: "כבוי", cool: "קירור", heat: "חימום", auto: "אוטו", dry: "ייבוש", fan_only: "מאוורר", heat_cool: "חימום/קירור" };
const HVAC_EMOJI: Record<string, string> = { cool: "❄️", heat: "🔥", auto: "✨", dry: "💧", fan_only: "🌀", heat_cool: "🌗" };

const isOn = (d: DeviceView) => d.state !== "off" && d.state !== "unavailable" && d.state != null;
const isSensor = (d: DeviceView) => d.kind === "sensor" || d.kind === "binary_sensor";

export function SmartHomeView({ householdId, connected, devices, lastSync, lastError, isOwner }: { householdId: string; connected: boolean; devices: DeviceView[]; lastSync: string | null; lastError: string | null; isOwner: boolean }) {
  useRealtimeRefresh("smart_home_devices", householdId);
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<{ device: DeviceView; cmd: DeviceCommand; label: string } | null>(null);
  const [manage, setManage] = useState(false);
  const [room, setRoom] = useState<string>("all");

  async function run(device: DeviceView, cmd: DeviceCommand, confirmed = false, label = "") {
    setBusy(device.id);
    const res = await sendDeviceCommand(device.id, cmd, confirmed);
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    if (res.data.status === "needs_confirmation") return setPending({ device, cmd, label });
    if (res.data.status === "succeeded") toast.success(`${device.name}: בוצע`);
    else if (res.data.status === "unconfirmed") toast.message(res.data.message);
    else toast.error(res.data.message);
    router.refresh();
  }

  async function sync() {
    setSyncing(true);
    const r = await syncSmartHome();
    setSyncing(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`עודכנו ${r.data.devices} מכשירים`);
    router.refresh();
  }

  if (!connected) {
    return (
      <>
        <PageHeader title="בית חכם" back={{ href: "/household", label: "משק הבית" }} />
        <div className="card overflow-hidden">
          <div className="flex items-center justify-center gap-3 bg-[linear-gradient(160deg,var(--honey-soft),var(--terracotta-soft))] py-10 text-[52px]" aria-hidden>
            <span className="animate-fade-up">💡</span>
            <span className="animate-fade-up [animation-delay:120ms]">🛋️</span>
            <span className="animate-fade-up [animation-delay:240ms]">❄️</span>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <h2 className="title-2">הבית שלכם, בלחיצה</h2>
              <p className="mt-1 text-[15px] text-muted">מזגן, דוד ותאורה — במקום אחד, לשניכם. מתחברים פעם אחת דרך Home Assistant.</p>
            </div>
            <ol className="space-y-2.5 text-[15px]">
              {["פותחים Home Assistant (למשל Home Assistant Cloud)", "יוצרים טוקן גישה ארוך-טווח בפרופיל", "מדביקים את הכתובת והטוקן בחיבורים"].map((t, i) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-[13px] font-bold text-primary">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
            {isOwner ? (
              <Link href="/settings/integrations" className="pressable flex h-12 items-center justify-center rounded-2xl bg-primary font-semibold text-primary-foreground">
                לחיבור Home Assistant
              </Link>
            ) : (
              <p className="text-[14px] text-muted">מנהל/ת הבית יכול/ה לחבר בהגדרות.</p>
            )}
          </div>
        </div>
      </>
    );
  }

  const pinned = devices.filter((d) => d.pinned);
  const rooms = [...new Set(pinned.map((d) => d.room ?? "ללא חדר"))];
  const shown = pinned.filter((d) => room === "all" || (d.room ?? "ללא חדר") === room);
  const onCount = pinned.filter((d) => !isSensor(d) && d.online && isOn(d)).length;
  const temp = pinned.find((d) => d.kind === "sensor" && String(d.attributes.unit_of_measurement ?? "").includes("°"));

  return (
    <>
      <PageHeader
        title="בית חכם"
        back={{ href: "/household", label: "משק הבית" }}
        subtitle={lastError ? `שגיאה: ${lastError}` : lastSync ? `עודכן ${timeAgo(lastSync)}` : "מחובר ל-Home Assistant"}
        actions={
          <button type="button" onClick={sync} disabled={syncing} aria-label="רענון" className="pressable grid size-10 place-items-center rounded-full bg-surface shadow-[var(--card-shadow)]">
            {syncing ? <Loader2 className="size-[18px] animate-spin" /> : <RefreshCw className="size-[18px]" />}
          </button>
        }
      />

      <div className="space-y-5 pb-10">
        {/* Cozy status line */}
        <div className="flex gap-2.5">
          <div className="flex flex-1 items-center gap-3 rounded-[1.25rem] bg-honey-soft p-3.5">
            <span className="text-[26px]" aria-hidden>
              {onCount ? "✨" : "🌙"}
            </span>
            <span>
              <span className="num block text-[22px] leading-none font-bold [font-family:var(--font-display)]">{onCount}</span>
              <span className="text-[13px] text-foreground/70">{onCount === 1 ? "מכשיר דולק" : "מכשירים דולקים"}</span>
            </span>
          </div>
          {temp && (
            <div className="flex flex-1 items-center gap-3 rounded-[1.25rem] bg-sky-soft p-3.5">
              <span className="text-[26px]" aria-hidden>
                🌡️
              </span>
              <span className="min-w-0">
                <span className="num block text-[22px] leading-none font-bold [font-family:var(--font-display)]">{Number(temp.state).toFixed(0)}°</span>
                <span className="block truncate text-[13px] text-foreground/70">{temp.room ?? temp.name}</span>
              </span>
            </div>
          )}
        </div>

        {rooms.length > 1 && (
          <div role="group" aria-label="חדרים" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
            {["all", ...rooms].map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={room === r}
                onClick={() => setRoom(r)}
                className={cn("pressable h-9 shrink-0 rounded-full px-4 text-[15px] font-medium transition-colors", room === r ? "bg-foreground text-background" : "bg-surface shadow-[var(--card-shadow)]")}
              >
                {r === "all" ? "כל הבית" : r}
              </button>
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <div className="card p-6 text-center text-[15px] text-muted">עוד לא בחרתם מכשירים להצגה. לחצו על ״בחירת מכשירים״ למטה.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {shown.map((d) =>
              d.kind === "climate" ? (
                <ClimateCard key={d.id} d={d} busy={busy === d.id} onCommand={(cmd, label) => run(d, cmd, false, label)} />
              ) : (
                <DeviceTile key={d.id} d={d} busy={busy === d.id} onCommand={(cmd, label) => run(d, cmd, false, label)} />
              ),
            )}
          </div>
        )}

        <section>
          <button type="button" onClick={() => setManage((v) => !v)} className="flex items-center gap-1.5 px-1 text-[15px] font-semibold text-primary">
            <Settings2 className="size-4" /> {manage ? "סיום בחירה" : `בחירת מכשירים (${devices.length})`}
          </button>
          {manage && (
            <Panel className="mt-2.5 animate-fade-up">
              {devices.map((d) => (
                <label key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-[20px]" aria-hidden>
                    <Emoji3D emoji={KIND_UI[d.kind].emoji} className="size-[72%]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{d.name}</span>
                    <span className="footnote block text-muted">{[KIND_UI[d.kind].label, d.room].filter(Boolean).join(" · ")}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={d.pinned}
                    className="size-5 accent-[var(--primary)]"
                    onChange={async (e) => {
                      const r = await updateDevice(d.id, { pinned: e.target.checked });
                      if (!r.ok) toast.error(r.error);
                      router.refresh();
                    }}
                    aria-label={`להציג את ${d.name}`}
                  />
                </label>
              ))}
            </Panel>
          )}
        </section>
        <p className="footnote px-1 text-center text-muted">המצב שמוצג הוא מה שהמכשיר דיווח בפועל ל-Home Assistant.</p>
      </div>

      <ConfirmSheet
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? `${pending.label || "להפעיל"} את ${pending.device.name}?` : ""}
        description="זו פעולה שדורשת אישור (למשל חימום מים)."
        confirmLabel="כן, להפעיל"
        onConfirm={() => {
          if (pending) void run(pending.device, pending.cmd, true);
          setPending(null);
        }}
      />
    </>
  );
}

type OnCommand = (cmd: DeviceCommand, label: string) => void;

/** Square tile: tap anywhere to switch on/off. Sensors just show their reading. */
function DeviceTile({ d, busy, onCommand }: { d: DeviceView; busy: boolean; onCommand: OnCommand }) {
  const ui = KIND_UI[d.kind];
  const on = isOn(d);
  const sensor = isSensor(d);
  const canToggle = !!d.capabilities.power && d.online && !busy;
  const timers = d.capabilities.timer_service && d.online && !on;
  const status = !d.online ? "לא מחובר" : sensor ? (d.kind === "binary_sensor" ? (d.state === "on" ? "זוהה" : "רגוע") : "") : on ? "דולק" : "כבוי";

  return (
    <div
      className={cn(
        "relative flex min-h-[132px] flex-col justify-between rounded-[1.5rem] p-3.5 transition-all duration-300",
        on && !sensor && d.online ? cn(ui.on, "shadow-[var(--card-shadow)]") : "card",
        !d.online && "opacity-60",
        timers && "col-span-2",
      )}
    >
      <button
        type="button"
        disabled={!canToggle}
        onClick={() => onCommand({ type: "power", on: !on }, on ? "לכבות" : "להפעיל")}
        aria-pressed={sensor ? undefined : on}
        aria-label={sensor ? d.name : on ? `כיבוי ${d.name}` : `הדלקת ${d.name}`}
        className="absolute inset-0 rounded-[inherit] disabled:cursor-default"
      />
      <div className="pointer-events-none flex items-start justify-between">
        <span
          aria-hidden
          className={cn(
            "grid size-11 place-items-center rounded-full text-[22px] transition-all duration-300",
            on && !sensor ? "bg-surface shadow-[0_0_24px_4px_color-mix(in_oklab,var(--honey)_35%,transparent)]" : "bg-fill grayscale-[0.4]",
          )}
        >
          {busy ? <Loader2 className="size-5 animate-spin text-muted" /> : <Emoji3D emoji={ui.emoji} className="size-[72%]" />}
        </span>
        {d.capabilities.power && d.online && (
          <span className={cn("grid size-7 place-items-center rounded-full", on ? "bg-primary text-primary-foreground" : "bg-fill text-muted")} aria-hidden>
            <Power className="size-3.5" strokeWidth={2.75} />
          </span>
        )}
      </div>
      <div className="pointer-events-none mt-3">
        {sensor && d.online && d.kind === "sensor" && (
          <span className="num block text-[26px] leading-none font-bold [font-family:var(--font-display)]">
            {d.state}
            <span className="text-[15px] font-semibold text-muted">{String(d.attributes.unit_of_measurement ?? "")}</span>
          </span>
        )}
        <span className="mt-1 block truncate text-[15px] leading-tight font-semibold">{d.name}</span>
        <span className="footnote block truncate text-muted">{[status, d.room].filter(Boolean).join(" · ")}</span>
      </div>
      {timers && (
        <div className="relative mt-3 flex gap-1.5">
          {[30, 45, 60].map((min) => (
            <button
              key={min}
              type="button"
              disabled={busy}
              onClick={() => onCommand({ type: "on_with_timer", minutes: min }, `להפעיל ל-${min} דקות`)}
              className="pressable flex h-9 flex-1 items-center justify-center gap-1 rounded-full bg-terracotta-soft text-[14px] font-semibold text-terracotta"
            >
              <Timer className="size-4" /> <span className="num">{min}</span> דק׳
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Wide climate card: the target temperature is the hero, modes are one tap away. */
function ClimateCard({ d, busy, onCommand }: { d: DeviceView; busy: boolean; onCommand: OnCommand }) {
  const on = isOn(d);
  const caps = d.capabilities;
  const target = d.attributes.temperature != null ? Number(d.attributes.temperature) : null;
  const current = d.attributes.current_temperature != null ? Number(d.attributes.current_temperature) : null;
  const tt = caps.target_temperature;
  const warm = d.state === "heat";

  return (
    <div className={cn("col-span-2 rounded-[1.5rem] p-4 transition-colors duration-300", on && d.online ? (warm ? "bg-terracotta-soft" : "bg-sky-soft") : "card", !d.online && "opacity-60")}>
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-surface text-[22px]" aria-hidden>
          {on ? (HVAC_EMOJI[d.state ?? ""] ?? "❄️") : "❄️"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{d.name}</span>
          <span className="footnote block text-muted">{[d.online ? (HVAC[d.state ?? ""] ?? d.state) : "לא מחובר", d.room].filter(Boolean).join(" · ")}</span>
        </span>
        {caps.power && d.online && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onCommand({ type: "power", on: !on }, on ? "לכבות" : "להפעיל")}
            className={cn("pressable grid size-11 place-items-center rounded-full", on ? "bg-primary text-primary-foreground" : "bg-fill text-foreground/70")}
            aria-label={on ? `כיבוי ${d.name}` : `הדלקת ${d.name}`}
            aria-pressed={on}
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Power className="size-5" />}
          </button>
        )}
      </div>

      {d.online && tt && target != null && (
        <div className="my-4 flex items-center justify-between">
          <button
            type="button"
            disabled={busy || target <= tt.min}
            onClick={() => onCommand({ type: "set_temperature", value: target - tt.step }, "")}
            className="pressable grid size-12 place-items-center rounded-full bg-surface shadow-[var(--card-shadow)] disabled:opacity-40"
            aria-label="להוריד טמפרטורה"
          >
            <Minus className="size-5" />
          </button>
          <div className="text-center">
            <span className="num block text-[52px] leading-none font-bold [font-family:var(--font-display)]">{target}°</span>
            {current != null && <span className="footnote text-muted">בחדר עכשיו {current}°</span>}
          </div>
          <button
            type="button"
            disabled={busy || target >= tt.max}
            onClick={() => onCommand({ type: "set_temperature", value: target + tt.step }, "")}
            className="pressable grid size-12 place-items-center rounded-full bg-surface shadow-[var(--card-shadow)] disabled:opacity-40"
            aria-label="להעלות טמפרטורה"
          >
            <Plus className="size-5" />
          </button>
        </div>
      )}

      {d.online && caps.hvac_modes && (
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
          {caps.hvac_modes
            .filter((m) => m !== "off")
            .map((m) => (
              <button
                key={m}
                type="button"
                disabled={busy}
                onClick={() => onCommand({ type: "set_hvac_mode", value: m }, "")}
                aria-pressed={d.state === m}
                className={cn("pressable flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-[14px] font-medium", d.state === m ? "bg-foreground text-background" : "bg-surface")}
              >
                <span aria-hidden>{HVAC_EMOJI[m]}</span>
                {HVAC[m] ?? m}
              </button>
            ))}
          {caps.fan_modes?.map((m) => (
            <button
              key={m}
              type="button"
              disabled={busy}
              onClick={() => onCommand({ type: "set_fan_mode", value: m }, "")}
              aria-pressed={d.attributes.fan_mode === m}
              className={cn("pressable h-9 shrink-0 rounded-full px-3.5 text-[14px] font-medium", d.attributes.fan_mode === m ? "bg-primary text-primary-foreground" : "bg-surface")}
            >
              🌀 {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
