"use client";

// Driver registration flow (P-DRIVER) — moved from /driver to /driver/setup.
// Phase 16 / Wave 4 / Task 4.1: the /driver route is now a dashboard; the
// 6-step wizard lives here at /driver/setup.
//
// Captures the FULL set of preferences a driver uses for physics calculations:
//   Step 1: Identity — displayName, email, home terminal (lat/lng)
//   Step 2: Vehicle — truck slug from truckConfigs, default payload_lbs
//   Step 3: Operating — weather preset, port drayage, preferred corridor
//   Step 4: Charging strategy — SoC trigger/floor/target/min_arrival
//   Step 5: Physics overrides (optional, advanced) — ±20% OEM bounds + reset
//   Step 6: Carrier association — carrier-finder near home terminal
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { RoutePlannerFrame } from "@/components/design/route-planner-frame";
import { ScreenHeader } from "@/components/design/screen-header";
import { FvInsetCard } from "@/components/design/fv-inset-card";
import { CarrierFinder } from "@/components/driver/carrier-finder";

type WeatherPreset = "ideal" | "hot" | "cold" | "headwind";

type ChargingPreferences = {
  soc_trigger_pct: number;
  soc_floor_pct: number;
  target_soc_pct: number;
  min_arrival_soc_pct: number;
};

type PhysicsOverrides = {
  C_rr?: number;
  drag_coefficient?: number;
  usable_kwh?: number;
  aux_kw_base?: number;
  regen_efficiency?: number;
};

type ProfileFormState = {
  displayName: string;
  email: string;
  homeTerminal: { lat: number; lng: number; label: string };
  preferredTruckSlug: string;
  defaultPayloadLbs: number;
  defaultWeatherPreset: WeatherPreset;
  portDrayageEnabled: boolean;
  preferredCorridorKey: string;
  chargingPreferences: ChargingPreferences;
  physicsOverrides: PhysicsOverrides;
  associatedCarrierKey: string | null;
};

const DEFAULT_CHARGING: ChargingPreferences = {
  soc_trigger_pct: 18,
  soc_floor_pct: 10,
  target_soc_pct: 80,
  min_arrival_soc_pct: 10,
};

const DEFAULT_FORM: ProfileFormState = {
  displayName: "",
  email: "",
  homeTerminal: { lat: 33.754, lng: -118.216, label: "POLB" },
  preferredTruckSlug: "",
  defaultPayloadLbs: 60000,
  defaultWeatherPreset: "ideal",
  portDrayageEnabled: false,
  preferredCorridorKey: "",
  chargingPreferences: { ...DEFAULT_CHARGING },
  physicsOverrides: {},
  associatedCarrierKey: null,
};

const STEPS = [
  "Identity",
  "Vehicle",
  "Operating",
  "Charging",
  "Physics Overrides",
  "Carrier",
] as const;

const WEATHER_OPTIONS: { value: WeatherPreset; label: string; desc: string }[] = [
  { value: "ideal", label: "Ideal", desc: "15°C, no wind" },
  { value: "hot", label: "Hot", desc: "35°C, AC load" },
  { value: "cold", label: "Cold", desc: "0°C, heater load" },
  { value: "headwind", label: "Headwind", desc: "15 mph headwind" },
];

function getOrCreateDriverId(): string {
  if (typeof window === "undefined") return "ssr-placeholder";
  const KEY = "fleetvolt_driver_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `drv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  oemDefault,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  oemDefault?: number;
  disabled?: boolean;
}) {
  const outOfBounds =
    oemDefault !== undefined &&
    (value < oemDefault * 0.8 || value > oemDefault * 1.2);
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fv-text-muted)]">
          {label}
          {oemDefault !== undefined && (
            <span className="ml-1.5 text-[10px] font-normal text-[var(--fv-text-muted)]">
              OEM: {oemDefault}
            </span>
          )}
        </label>
        <span
          className={`text-xs font-mono ${
            outOfBounds
              ? "text-[var(--fv-destructive)]"
              : "text-[var(--fv-text-secondary)]"
          }`}
        >
          {value}
          {unit ?? ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[var(--fv-accent)]"
      />
      {outOfBounds && (
        <p className="mt-0.5 text-[10px] text-[var(--fv-destructive)]">
          Outside ±20% OEM bounds
        </p>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function DriverSetupPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProfileFormState>(DEFAULT_FORM);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useMemo(() => {
    setDriverId(getOrCreateDriverId());
  }, []);

  const existingProfile = useQuery(
    api.driver.queries.getProfile,
    driverId ? { driverId } : "skip",
  );

  const trucks = useQuery(api.driver.queries.listPreferredTrucks, {});
  const corridors = useQuery(api.driver.queries.listCorridors, {});

  const createOrUpdate = useMutation(api.driver.mutations.createOrUpdateProfile);

  const canProceed = (() => {
    switch (step) {
      case 0: return form.displayName.trim().length > 0;
      case 1: return form.preferredTruckSlug.length > 0;
      default: return true;
    }
  })();

  const handleSubmit = async () => {
    if (!driverId) return;
    await createOrUpdate({
      driverId,
      displayName: form.displayName,
      email: form.email || undefined,
      associatedCarrierKey: form.associatedCarrierKey ?? undefined,
      preferredTruckSlug: form.preferredTruckSlug || undefined,
      defaultPayloadLbs: form.defaultPayloadLbs,
      defaultWeatherPreset: form.defaultWeatherPreset,
      portDrayageEnabled: form.portDrayageEnabled,
      chargingPreferences: form.chargingPreferences,
      physicsOverrides:
        Object.keys(form.physicsOverrides).length > 0
          ? form.physicsOverrides
          : undefined,
      homeTerminal: {
        lat: form.homeTerminal.lat,
        lng: form.homeTerminal.lng,
        label: form.homeTerminal.label || undefined,
      },
      preferredCorridorKey: form.preferredCorridorKey || undefined,
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <RoutePlannerFrame maxWidthClass="max-w-[640px]">
        <ScreenHeader title="Driver Setup" subtitle="PROFILE SAVED" backHref="/driver" />
        <FvInsetCard className="mt-6 p-8 text-center">
          <div className="mb-4 text-4xl">✓</div>
          <h2 className="mb-2 text-lg font-bold text-[var(--fv-text)]">Profile saved</h2>
          <p className="mb-1 text-sm text-[var(--fv-text-secondary)]">
            {form.displayName} ({driverId?.slice(0, 8)}…)
          </p>
          <p className="mb-6 text-xs text-[var(--fv-text-muted)]">
            Truck: {form.preferredTruckSlug} · Payload: {form.defaultPayloadLbs.toLocaleString()} lbs · Weather: {form.defaultWeatherPreset}
          </p>
          <button
            onClick={() => { setSubmitted(false); setStep(0); setForm(DEFAULT_FORM); }}
            className="rounded-md bg-[var(--fv-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Edit Profile
          </button>
        </FvInsetCard>
      </RoutePlannerFrame>
    );
  }

  return (
    <RoutePlannerFrame maxWidthClass="max-w-[720px]">
      <ScreenHeader
        title="Driver Setup"
        subtitle="NEW DRIVER PROFILE"
        backHref="/driver"
        status={
          existingProfile
            ? { text: "Profile exists — will update", color: "#b8874c" }
            : { text: "New profile", color: "#3f9b6b" }
        }
      />
      {/* Step indicator */}
      <div className="mt-6 flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center">
            <button
              onClick={() => setStep(i)}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                i === step
                  ? "bg-[var(--fv-accent)] text-white"
                  : i < step
                    ? "bg-[var(--fv-accent-green)] text-white"
                    : "bg-[var(--fv-surface-muted)] text-[var(--fv-text-muted)]"
              }`}
            >
              {i + 1}
            </button>
            {i < STEPS.length - 1 && (
              <div className={`mx-1.5 h-px flex-1 ${i < step ? "bg-[var(--fv-accent-green)]" : "bg-black/8"}`} />
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--fv-text-muted)]">
        Step {step + 1}: {STEPS[step]}
      </p>

      <FvInsetCard className="mt-4 p-6">
        {/* Step 1: Identity */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--fv-text-muted)]">Display name *</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="John Driver"
                className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-[var(--fv-text)] focus:border-[var(--fv-accent)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--fv-text-muted)]">Email (optional)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="driver@carrier.com"
                className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-[var(--fv-text)] focus:border-[var(--fv-accent)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--fv-text-muted)]">Home terminal — label</label>
              <input
                type="text"
                value={form.homeTerminal.label}
                onChange={(e) => setForm({ ...form, homeTerminal: { ...form.homeTerminal, label: e.target.value } })}
                placeholder="POLB / DC-LongBeach / ..."
                className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-[var(--fv-text)] focus:border-[var(--fv-accent)] focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--fv-text-muted)]">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={form.homeTerminal.lat}
                  onChange={(e) => setForm({ ...form, homeTerminal: { ...form.homeTerminal, lat: parseFloat(e.target.value) || 0 } })}
                  className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-mono text-[var(--fv-text)] focus:border-[var(--fv-accent)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--fv-text-muted)]">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={form.homeTerminal.lng}
                  onChange={(e) => setForm({ ...form, homeTerminal: { ...form.homeTerminal, lng: parseFloat(e.target.value) || 0 } })}
                  className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-mono text-[var(--fv-text)] focus:border-[var(--fv-accent)] focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[10px] text-[var(--fv-text-muted)]">Default: POLB (33.754, -118.216). Used for carrier-finder in Step 6.</p>
          </div>
        )}
        {/* Step 2: Vehicle */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--fv-text-muted)]">Preferred truck *</label>
              {trucks === undefined ? (
                <p className="text-sm text-[var(--fv-text-muted)]">Loading trucks…</p>
              ) : trucks.length === 0 ? (
                <p className="text-sm text-[var(--fv-text-muted)]">No truck configs found in Convex. Enter slug manually:</p>
              ) : null}
              <select
                value={form.preferredTruckSlug}
                onChange={(e) => setForm({ ...form, preferredTruckSlug: e.target.value })}
                className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-[var(--fv-text)] focus:border-[var(--fv-accent)] focus:outline-none"
              >
                <option value="">— Select a truck —</option>
                {trucks?.map((truck: { name: string; oemModel?: string | null; batteryUsableKwh?: number | null }) => (
                  <option key={truck.name} value={truck.name}>
                    {truck.name}
                    {truck.oemModel ? ` (${truck.oemModel})` : ""}
                    {truck.batteryUsableKwh ? ` — ${truck.batteryUsableKwh} kWh` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Slider
                label="Default payload (lbs)"
                value={form.defaultPayloadLbs}
                min={0}
                max={80000}
                step={500}
                onChange={(v) => setForm({ ...form, defaultPayloadLbs: v })}
              />
              <p className="mt-1 text-[10px] text-[var(--fv-text-muted)]">
                {form.defaultPayloadLbs.toLocaleString()} lbs — used in ConditionsSpec.payload_lbs
              </p>
            </div>
          </div>
        )}
        {/* Step 3: Operating preferences */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--fv-text-muted)]">Default weather preset</label>
              <div className="grid grid-cols-2 gap-2">
                {WEATHER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, defaultWeatherPreset: opt.value })}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      form.defaultWeatherPreset === opt.value
                        ? "border-[var(--fv-accent)] bg-[var(--fv-accent)]/5"
                        : "border-black/8 bg-[var(--fv-surface)] hover:border-[var(--fv-accent)]/30"
                    }`}
                  >
                    <p className="text-sm font-medium text-[var(--fv-text)]">{opt.label}</p>
                    <p className="text-[10px] text-[var(--fv-text-muted)]">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-black/8 bg-[var(--fv-surface)] p-3">
              <div>
                <p className="text-sm font-medium text-[var(--fv-text)]">Port drayage enabled</p>
                <p className="text-[10px] text-[var(--fv-text-muted)]">Toggles ConditionsSpec.port_drayage_enabled</p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, portDrayageEnabled: !form.portDrayageEnabled })}
                className={`relative h-6 w-11 rounded-full transition-colors ${form.portDrayageEnabled ? "bg-[var(--fv-accent)]" : "bg-[var(--fv-surface-muted)]"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${form.portDrayageEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--fv-text-muted)]">Preferred corridor (optional)</label>
              <select
                value={form.preferredCorridorKey}
                onChange={(e) => setForm({ ...form, preferredCorridorKey: e.target.value })}
                className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-[var(--fv-text)] focus:border-[var(--fv-accent)] focus:outline-none"
              >
                <option value="">— None —</option>
                {corridors?.map((c: { corridorKey: string; name: string; distanceMiles?: number | null }) => (
                  <option key={c.corridorKey} value={c.corridorKey}>
                    {c.name}{c.distanceMiles ? ` (${c.distanceMiles} mi)` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {/* Step 4: Charging strategy */}
        {step === 3 && (
          <div className="space-y-5">
            <p className="text-xs text-[var(--fv-text-muted)]">SoC targets used by the charging planner. Defaults mirror the physics engine (18/10/80/10).</p>
            <Slider label="SoC trigger (%)" value={form.chargingPreferences.soc_trigger_pct} min={5} max={50} step={1} unit="%" onChange={(v) => setForm({ ...form, chargingPreferences: { ...form.chargingPreferences, soc_trigger_pct: v } })} />
            <Slider label="SoC floor (%)" value={form.chargingPreferences.soc_floor_pct} min={0} max={30} step={1} unit="%" onChange={(v) => setForm({ ...form, chargingPreferences: { ...form.chargingPreferences, soc_floor_pct: v } })} />
            <Slider label="Target SoC (%)" value={form.chargingPreferences.target_soc_pct} min={50} max={100} step={1} unit="%" onChange={(v) => setForm({ ...form, chargingPreferences: { ...form.chargingPreferences, target_soc_pct: v } })} />
            <Slider label="Min arrival SoC (%)" value={form.chargingPreferences.min_arrival_soc_pct} min={0} max={30} step={1} unit="%" onChange={(v) => setForm({ ...form, chargingPreferences: { ...form.chargingPreferences, min_arrival_soc_pct: v } })} />
          </div>
        )}
        {/* Step 5: Physics overrides */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--fv-text)]">Advanced: physics overrides</p>
                <p className="text-[10px] text-[var(--fv-text-muted)]">Override OEM params within ±20% bounds. Optional.</p>
              </div>
              <button type="button" onClick={() => setForm({ ...form, physicsOverrides: {} })} className="rounded-md bg-[var(--fv-surface-muted)] px-3 py-1.5 text-[11px] font-medium text-[var(--fv-text-secondary)] hover:bg-[var(--fv-accent)]/10">Reset to OEM</button>
            </div>
            <Slider label="Rolling resistance (C_rr)" value={form.physicsOverrides.C_rr ?? 0.008} min={0.004} max={0.012} step={0.0001} onChange={(v) => setForm({ ...form, physicsOverrides: { ...form.physicsOverrides, C_rr: v } })} />
            <Slider label="Drag coefficient" value={form.physicsOverrides.drag_coefficient ?? 0.65} min={0.4} max={0.9} step={0.01} onChange={(v) => setForm({ ...form, physicsOverrides: { ...form.physicsOverrides, drag_coefficient: v } })} />
            <Slider label="Usable kWh" value={form.physicsOverrides.usable_kwh ?? 438} min={300} max={600} step={1} unit=" kWh" onChange={(v) => setForm({ ...form, physicsOverrides: { ...form.physicsOverrides, usable_kwh: v } })} />
            <Slider label="Auxiliary power base (kW)" value={form.physicsOverrides.aux_kw_base ?? 3} min={0} max={10} step={0.1} unit=" kW" onChange={(v) => setForm({ ...form, physicsOverrides: { ...form.physicsOverrides, aux_kw_base: v } })} />
            <Slider label="Regen efficiency" value={form.physicsOverrides.regen_efficiency ?? 0.7} min={0.3} max={0.95} step={0.01} onChange={(v) => setForm({ ...form, physicsOverrides: { ...form.physicsOverrides, regen_efficiency: v } })} />
            <p className="text-[10px] text-[var(--fv-text-muted)]">The physics engine validates these against ±20% OEM bounds at simulation time (convex/physics/overrides.ts). Values outside bounds will be rejected.</p>
          </div>
        )}
        {/* Step 6: Carrier association */}
        {step === 5 && (
          <div>
            <p className="mb-4 text-xs text-[var(--fv-text-muted)]">Browse carriers near your home terminal. Optionally associate with one — this links your profile to a carrier in the POLB registry.</p>
            <CarrierFinder
              lat={form.homeTerminal.lat}
              lng={form.homeTerminal.lng}
              selectedCarrierKey={form.associatedCarrierKey}
              onAssociate={(key: string) => setForm({ ...form, associatedCarrierKey: key })}
            />
          </div>
        )}
        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="rounded-md px-3 py-2 text-sm font-medium text-[var(--fv-text-secondary)] disabled:opacity-30">← Back</button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => setStep(step + 1)} disabled={!canProceed} className="rounded-md bg-[var(--fv-accent)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-30">Next →</button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={!form.displayName} className="rounded-md bg-[var(--fv-accent-green)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-30">Save Profile</button>
          )}
        </div>
      </FvInsetCard>
      {/* Summary preview */}
      <div className="mt-4 rounded-lg bg-[var(--fv-surface-muted)] p-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--fv-text-muted)]">Profile preview</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-[var(--fv-text-secondary)]">
          <span>Name: {form.displayName || "—"}</span>
          <span>Truck: {form.preferredTruckSlug || "—"}</span>
          <span>Payload: {form.defaultPayloadLbs.toLocaleString()} lbs</span>
          <span>Weather: {form.defaultWeatherPreset}</span>
          <span>Drayage: {form.portDrayageEnabled ? "yes" : "no"}</span>
          <span>Charging: {form.chargingPreferences.soc_trigger_pct}/{form.chargingPreferences.soc_floor_pct}/{form.chargingPreferences.target_soc_pct}/{form.chargingPreferences.min_arrival_soc_pct}</span>
          <span>Overrides: {Object.keys(form.physicsOverrides).length} fields</span>
          <span>Carrier: {form.associatedCarrierKey ?? "none"}</span>
        </div>
      </div>
    </RoutePlannerFrame>
  );
}
