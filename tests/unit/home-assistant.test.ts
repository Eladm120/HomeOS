import { describe, expect, it } from "vitest";
import { capabilities, commandReflected, deviceKind, needsConfirmation, toServiceCall } from "@/lib/home-assistant";

const ac = { entity_id: "climate.living_room", state: "cool", attributes: { min_temp: 16, max_temp: 30, hvac_modes: ["off", "cool", "heat"], fan_modes: ["low", "high"], temperature: 24 } };
const boiler = { entity_id: "switch.switcher_boiler", state: "off", attributes: { friendly_name: "דוד" } };

describe("home assistant mapping", () => {
  it("classifies entities and skips irrelevant ones", () => {
    expect(deviceKind(ac)).toBe("climate");
    expect(deviceKind(boiler)).toBe("water_heater");
    expect(deviceKind({ entity_id: "switch.desk_lamp", state: "on", attributes: {} })).toBe("switch");
    expect(deviceKind({ entity_id: "sensor.salon_temp", state: "24", attributes: { device_class: "temperature" } })).toBe("sensor");
    expect(deviceKind({ entity_id: "sensor.phone_battery", state: "80", attributes: { device_class: "battery" } })).toBeNull();
    expect(deviceKind({ entity_id: "automation.x", state: "on", attributes: {} })).toBeNull();
  });

  it("only builds service calls the device supports, within limits", () => {
    const caps = capabilities(ac, new Set());
    expect(toServiceCall(ac.entity_id, caps, { type: "set_temperature", value: 22 })).toEqual({ domain: "climate", service: "set_temperature", data: { entity_id: ac.entity_id, temperature: 22 } });
    expect(toServiceCall(ac.entity_id, caps, { type: "set_temperature", value: 40 })).toHaveProperty("error");
    expect(toServiceCall(ac.entity_id, caps, { type: "set_hvac_mode", value: "dry" })).toHaveProperty("error");
    expect(toServiceCall(boiler.entity_id, capabilities(boiler, new Set()), { type: "on_with_timer", minutes: 30 })).toHaveProperty("error");
    const withTimer = capabilities(boiler, new Set(["switcher_kis.turn_on_with_timer"]));
    expect(toServiceCall(boiler.entity_id, withTimer, { type: "on_with_timer", minutes: 30 })).toEqual({ domain: "switcher_kis", service: "turn_on_with_timer", data: { entity_id: boiler.entity_id, timer_minutes: 30 } });
  });

  it("reports success only when the new state reflects the command", () => {
    expect(commandReflected({ type: "power", on: false }, { ...ac, state: "off" })).toBe(true);
    expect(commandReflected({ type: "power", on: false }, ac)).toBe(false);
    expect(commandReflected({ type: "set_temperature", value: 24 }, ac)).toBe(true);
    expect(commandReflected({ type: "power", on: true }, null)).toBeNull();
  });

  it("asks for confirmation before heating water", () => {
    expect(needsConfirmation("water_heater", { type: "power", on: true }, false)).toBe(true);
    expect(needsConfirmation("water_heater", { type: "power", on: false }, false)).toBe(false);
    expect(needsConfirmation("climate", { type: "set_temperature", value: 22 }, false)).toBe(false);
    expect(needsConfirmation("light", { type: "power", on: true }, true)).toBe(true);
  });
});
