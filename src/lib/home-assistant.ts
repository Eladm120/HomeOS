/**
 * Pure mapping between Home Assistant entity states and HomeOS devices: which
 * entities we show, what kind they are, what controls they support, and which
 * service call a control turns into. No network code here.
 */
export interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_updated?: string;
}

export type DeviceKind = "climate" | "water_heater" | "switch" | "light" | "sensor" | "binary_sensor" | "other";

export interface DeviceCapabilities {
  power?: boolean;
  target_temperature?: { min: number; max: number; step: number };
  hvac_modes?: string[];
  fan_modes?: string[];
  brightness?: boolean;
  /** Service that turns the device on for N minutes (e.g. Switcher boilers). */
  timer_service?: string;
}

const BOILER = /boiler|water.?heater|דוד|switcher/i;

export function deviceKind(s: HaState): DeviceKind | null {
  const domain = s.entity_id.split(".")[0];
  if (domain === "climate") return "climate";
  if (domain === "water_heater") return "water_heater";
  if (domain === "light") return "light";
  if (domain === "switch") return BOILER.test(`${s.entity_id} ${String(s.attributes.friendly_name ?? "")}`) ? "water_heater" : "switch";
  if (domain === "sensor") {
    const dc = String(s.attributes.device_class ?? "");
    return ["temperature", "humidity", "power", "energy"].includes(dc) ? "sensor" : null;
  }
  if (domain === "binary_sensor") {
    const dc = String(s.attributes.device_class ?? "");
    return ["motion", "occupancy", "door", "window", "connectivity"].includes(dc) ? "binary_sensor" : null;
  }
  return null;
}

export function capabilities(s: HaState, services: Set<string>): DeviceCapabilities {
  const domain = s.entity_id.split(".")[0];
  const a = s.attributes;
  const caps: DeviceCapabilities = {};
  if (["climate", "water_heater", "switch", "light"].includes(domain)) caps.power = true;
  if (domain === "climate") {
    caps.target_temperature = { min: Number(a.min_temp ?? 16), max: Number(a.max_temp ?? 30), step: Number(a.target_temp_step ?? 1) };
    if (Array.isArray(a.hvac_modes)) caps.hvac_modes = (a.hvac_modes as string[]).slice(0, 10);
    if (Array.isArray(a.fan_modes)) caps.fan_modes = (a.fan_modes as string[]).slice(0, 10);
  }
  if (domain === "light") caps.brightness = a.brightness !== undefined || Array.isArray(a.supported_color_modes);
  if (domain === "switch" && services.has("switcher_kis.turn_on_with_timer") && /switcher/i.test(s.entity_id)) caps.timer_service = "switcher_kis.turn_on_with_timer";
  return caps;
}

export type DeviceCommand =
  | { type: "power"; on: boolean }
  | { type: "set_temperature"; value: number }
  | { type: "set_hvac_mode"; value: string }
  | { type: "set_fan_mode"; value: string }
  | { type: "on_with_timer"; minutes: number };

export interface ServiceCall {
  domain: string;
  service: string;
  data: Record<string, unknown>;
}

/** Translate a validated command into a Home Assistant service call, or explain why not. */
export function toServiceCall(entityId: string, caps: DeviceCapabilities, cmd: DeviceCommand): ServiceCall | { error: string } {
  const domain = entityId.split(".")[0];
  const base = { entity_id: entityId };
  switch (cmd.type) {
    case "power":
      if (!caps.power) return { error: "המכשיר לא תומך בהדלקה/כיבוי" };
      if (domain === "climate") return { domain, service: cmd.on ? "turn_on" : "turn_off", data: base };
      if (domain === "water_heater") return { domain, service: cmd.on ? "turn_on" : "turn_off", data: base };
      return { domain, service: cmd.on ? "turn_on" : "turn_off", data: base };
    case "set_temperature": {
      const t = caps.target_temperature;
      if (!t) return { error: "המכשיר לא תומך בכיוון טמפרטורה" };
      if (cmd.value < t.min || cmd.value > t.max) return { error: `טמפרטורה בין ${t.min} ל-${t.max}` };
      return { domain: "climate", service: "set_temperature", data: { ...base, temperature: cmd.value } };
    }
    case "set_hvac_mode":
      if (!caps.hvac_modes?.includes(cmd.value)) return { error: "מצב לא נתמך" };
      return { domain: "climate", service: "set_hvac_mode", data: { ...base, hvac_mode: cmd.value } };
    case "set_fan_mode":
      if (!caps.fan_modes?.includes(cmd.value)) return { error: "מהירות לא נתמכת" };
      return { domain: "climate", service: "set_fan_mode", data: { ...base, fan_mode: cmd.value } };
    case "on_with_timer": {
      if (!caps.timer_service) return { error: "המכשיר לא תומך בטיימר. אפשר להגדיר כיבוי אוטומטי ב-Home Assistant." };
      if (cmd.minutes < 1 || cmd.minutes > 150) return { error: "טיימר בין 1 ל-150 דקות" };
      const [d, s] = caps.timer_service.split(".");
      return { domain: d, service: s, data: { ...base, timer_minutes: Math.round(cmd.minutes) } };
    }
  }
}

/** Did the reported state reach what the command asked for? */
export function commandReflected(cmd: DeviceCommand, after: HaState | null): boolean | null {
  if (!after) return null;
  switch (cmd.type) {
    case "power":
    case "on_with_timer": {
      const on = cmd.type === "on_with_timer" ? true : cmd.on;
      return on ? after.state !== "off" && after.state !== "unavailable" : after.state === "off";
    }
    case "set_temperature":
      return Number(after.attributes.temperature) === cmd.value;
    case "set_hvac_mode":
      return after.state === cmd.value;
    case "set_fan_mode":
      return after.attributes.fan_mode === cmd.value;
  }
}

/** Sensitive commands need an explicit "are you sure" in the UI. */
export function needsConfirmation(kind: DeviceKind, cmd: DeviceCommand, flagged: boolean): boolean {
  if (flagged) return true;
  if (kind === "water_heater" && ((cmd.type === "power" && cmd.on) || cmd.type === "on_with_timer")) return true;
  return false;
}
