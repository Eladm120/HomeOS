"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lightbulb, Loader2, Minus, Plus, Power, RefreshCw, Timer } from "lucide-react";
import { toast } from "sonner";
import { sendDeviceCommand, syncSmartHome, updateDevice } from "@/server/actions/integrations";
import type { DeviceCapabilities, DeviceCommand, DeviceKind } from "@/lib/home-assistant";
import { timeAgo } from "@/lib/format";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/sheet";
import { Panel, PanelHeading } from "@/components/ui/panel";

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

const KIND_UI: Record<DeviceKind, { emoji: string; hue: number }> = {
  climate: { emoji: "❄️", hue: 215 },
  water_heater: { emoji: "♨️", hue: 30 },
  switch: { emoji: "🔌", hue: 75 },
  light: { emoji: "💡", hue: 75 },
  sensor: { emoji: "🌡️", hue: 185 },
  binary_sensor: { emoji: "📡", hue: 260 },
  other: { emoji: "🏠", hue: 140 },
};
const HVAC: Record<string, string> = { off: "כבוי", cool: "קירור", heat: "חימום", auto: "אוטומטי", dry: "ייבוש", fan_only: "מאוורר", heat_cool: "חימום/קירור" };

export function SmartHomeView({ householdId, connected, devices, lastSync, lastError, isOwner }: { householdId: string; connected: boolean; devices: DeviceView[]; lastSync: string | null; lastError: string | null; isOwner: boolean }) {
  useRealtimeRefresh("smart_home_devices", householdId);
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<{ device: DeviceView; cmd: DeviceCommand; label: string } | null>(null);
  const [showAll, setShowAll] = useState(false);

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
        <EmptyState
          icon={<Lightbulb />}
          title="Home Assistant לא מחובר"
          description="כדי לשלוט במזגן, בדוד ובתאורה, חברו את שרת ה-Home Assistant של הבית (כתובת https ציבורית, למשל Home Assistant Cloud, וטוקן גישה ארוך-טווח). כל שאר האפליקציה עובדת גם בלי זה."
          action={
            isOwner ? (
              <Link href="/settings/integrations" className="pressable inline-flex h-11 items-center rounded-full bg-primary px-5 font-semibold text-primary-foreground">
                לחיבור Home Assistant
              </Link>
            ) : (
              <p className="text-[14px] text-muted">מנהל/ת הבית יכול/ה לחבר בהגדרות.</p>
            )
          }
        />
      </>
    );
  }

  const shown = devices.filter((d) => showAll || d.pinned);
  const rooms = [...new Set(shown.map((d) => d.room ?? "ללא חדר"))];

  return (
    <>
      <PageHeader
        title="בית חכם"
        back={{ href: "/household", label: "משק הבית" }}
        subtitle={lastError ? `שגיאה: ${lastError}` : lastSync ? `עודכן ${timeAgo(lastSync)}` : "מחובר ל-Home Assistant"}
        actions={
          <Button size="icon-sm" variant="secondary" onClick={sync} disabled={syncing} aria-label="רענון">
            {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
        }
      />
      <div className="space-y-5 pb-10">
        {shown.length === 0 && <p className="rounded-[var(--radius)] border border-dashed border-border p-5 text-center text-[15px] text-muted">אין מכשירים מוצגים. בחרו מהרשימה המלאה אילו להציג.</p>}
        {rooms.map((room) => (
          <section key={room}>
            <PanelHeading title={room} />
            <div className="grid gap-3 sm:grid-cols-2">
              {shown
                .filter((d) => (d.room ?? "ללא חדר") === room)
                .map((d) => (
                  <DeviceCard key={d.id} d={d} busy={busy === d.id} onCommand={(cmd, label) => run(d, cmd, false, label)} />
                ))}
            </div>
          </section>
        ))}
        <section>
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[15px] font-semibold text-primary">
            {showAll ? "להציג רק מכשירים נבחרים" : `כל המכשירים (${devices.length})`}
          </button>
          {showAll && (
            <Panel className="mt-2">
              {devices.map((d) => (
                <label key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate">{d.name}</span>
                    <span className="footnote block text-muted">{d.kind}</span>
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
        <p className="footnote px-1 text-muted">כל פקודה נשלחת ל-Home Assistant, והמצב שמוצג כאן הוא מה שהמכשיר דיווח בפועל.</p>
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

function DeviceCard({ d, busy, onCommand }: { d: DeviceView; busy: boolean; onCommand: (cmd: DeviceCommand, label: string) => void }) {
  const ui = KIND_UI[d.kind];
  const on = d.state !== "off" && d.state !== "unavailable" && d.state != null;
  const target = d.attributes.temperature != null ? Number(d.attributes.temperature) : null;
  const current = d.attributes.current_temperature != null ? Number(d.attributes.current_temperature) : null;
  const caps = d.capabilities;
  const isSensor = d.kind === "sensor" || d.kind === "binary_sensor";

  return (
    <div className={cn("rounded-[var(--radius)] border bg-surface p-4", on && !isSensor ? "border-primary/50" : "border-border", busy && "opacity-60")}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="cat-tint grid size-11 shrink-0 place-items-center rounded-[14px] text-[22px]" style={{ "--h": ui.hue } as React.CSSProperties}>
          {ui.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{d.name}</p>
          <p className="footnote text-muted">
            {!d.online ? "לא מחובר" : isSensor ? "" : d.kind === "climate" ? (HVAC[d.state ?? ""] ?? d.state) : on ? "דולק" : "כבוי"}
            {d.state_updated_at ? ` · ${timeAgo(d.state_updated_at)}` : ""}
          </p>
        </div>
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
        {!d.online && <Badge tone="danger">לא זמין</Badge>}
      </div>

      {isSensor && d.online && (
        <p className="num mt-3 text-[28px] font-bold">
          {d.kind === "binary_sensor" ? (d.state === "on" ? "זוהתה תנועה / פתוח" : "רגוע") : `${d.state}${String(d.attributes.unit_of_measurement ?? "")}`}
        </p>
      )}

      {d.kind === "climate" && d.online && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-muted">{current != null ? `בחדר: ${current}°` : ""}</span>
            {caps.target_temperature && target != null && (
              <div className="flex items-center gap-2">
                <button type="button" disabled={busy || target <= caps.target_temperature.min} onClick={() => onCommand({ type: "set_temperature", value: target - caps.target_temperature!.step }, "")} className="grid size-9 place-items-center rounded-full bg-fill" aria-label="להוריד טמפרטורה">
                  <Minus className="size-4" />
                </button>
                <span className="num w-12 text-center text-[22px] font-bold">{target}°</span>
                <button type="button" disabled={busy || target >= caps.target_temperature.max} onClick={() => onCommand({ type: "set_temperature", value: target + caps.target_temperature!.step }, "")} className="grid size-9 place-items-center rounded-full bg-fill" aria-label="להעלות טמפרטורה">
                  <Plus className="size-4" />
                </button>
              </div>
            )}
          </div>
          {caps.hvac_modes && (
            <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
              {caps.hvac_modes.map((m) => (
                <button key={m} type="button" disabled={busy} onClick={() => onCommand({ type: "set_hvac_mode", value: m }, "")} aria-pressed={d.state === m} className={cn("h-8 shrink-0 rounded-full px-3 text-[13px]", d.state === m ? "bg-foreground text-background" : "bg-fill")}>
                  {HVAC[m] ?? m}
                </button>
              ))}
            </div>
          )}
          {caps.fan_modes && (
            <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
              {caps.fan_modes.map((m) => (
                <button key={m} type="button" disabled={busy} onClick={() => onCommand({ type: "set_fan_mode", value: m }, "")} aria-pressed={d.attributes.fan_mode === m} className={cn("h-8 shrink-0 rounded-full px-3 text-[13px]", d.attributes.fan_mode === m ? "bg-primary text-primary-foreground" : "bg-fill")}>
                  מאוורר: {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {caps.timer_service && d.online && !on && (
        <div className="mt-3 flex gap-1.5">
          {[30, 45, 60].map((min) => (
            <Button key={min} size="sm" variant="secondary" disabled={busy} onClick={() => onCommand({ type: "on_with_timer", minutes: min }, `להפעיל ל-${min} דקות`)}>
              <Timer /> {min} דק׳
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
