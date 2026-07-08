"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { components } from "@fleetvolt/shared-types";
import { FvInsetCard } from "@/components/design/fv-inset-card";
import {
  scenarioFormSchema,
  slugFromTruckName,
  type ScenarioFormValues,
} from "@/lib/scenario-schema";
import { useScenarioStore } from "@/stores/scenario-store";

type TruckConfigSummary = components["schemas"]["TruckConfigSummary"];
type CorridorCatalogEntry = components["schemas"]["CorridorCatalogEntry"];

type ScenarioFormProps = {
  trucks: TruckConfigSummary[];
  corridors: CorridorCatalogEntry[];
};

const WEATHER_OPTIONS = [
  { value: "ideal", label: "Clear" },
  { value: "hot", label: "Heat" },
  { value: "cold", label: "Cold" },
  { value: "headwind", label: "Headwind" },
] as const;

export function ScenarioForm({ trucks, corridors }: ScenarioFormProps) {
  const submitScenario = useScenarioStore((s) => s.submitScenario);
  const setFormInputs = useScenarioStore((s) => s.setFormInputs);
  const isPolling = useScenarioStore((s) => s.isPolling);
  const storedInputs = useScenarioStore((s) => s.formInputs);
  const addToComparison = useScenarioStore((s) => s.addToComparison);
  const setAddToComparison = useScenarioStore((s) => s.setAddToComparison);
  const pinCurrentResult = useScenarioStore((s) => s.pinCurrentResult);
  const [comparisonNotice, setComparisonNotice] = useState<string | null>(null);

  const corridorPresets = corridors.filter(
    (c) => c.type === "corridor" && c.corridor_key,
  );

  const form = useForm<ScenarioFormValues>({
    resolver: zodResolver(scenarioFormSchema),
    defaultValues: storedInputs,
  });

  const payloadLbs = form.watch("payload_lbs");
  const truckSlug = form.watch("truck_slug");
  const weatherPreset = form.watch("weather_preset");
  const selectedTruck = trucks.find((t) => slugFromTruckName(t.name) === truckSlug);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormInputs(values);
    setComparisonNotice(null);
    await submitScenario();

    if (!useScenarioStore.getState().addToComparison) {
      return;
    }

    const pinResult = pinCurrentResult();
    if (pinResult === "full") {
      setComparisonNotice("Comparison tray full (3/3). Remove a scenario to pin.");
    }
  });

  return (
    <form
      data-testid="scenario-form"
      className="flex flex-col gap-3"
      onSubmit={onSubmit}
    >
      <FvInsetCard className="flex flex-col gap-2.5">
        <div>
          <div className="fv-field-label">Corridor preset</div>
          <select
            id="corridor"
            className="fv-input"
            value={form.watch("corridor_key")}
            onChange={(e) => {
              form.setValue("corridor_key", e.target.value);
              setFormInputs({ corridor_key: e.target.value });
            }}
          >
            {corridorPresets.map((corridor) => (
              <option key={corridor.corridor_key!} value={corridor.corridor_key!}>
                {corridor.name}
              </option>
            ))}
          </select>
        </div>
      </FvInsetCard>

      <FvInsetCard className="flex flex-col gap-2.5">
        <div>
          <div className="fv-field-label">Weather scenario</div>
          <div className="fv-weather-segment" role="group" aria-label="Weather scenario">
            {WEATHER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                data-active={weatherPreset === opt.value ? "true" : "false"}
                onClick={() => {
                  form.setValue("weather_preset", opt.value);
                  setFormInputs({ weather_preset: opt.value });
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </FvInsetCard>

      <FvInsetCard className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="fv-field-label mb-0">Truck unit</div>
        </div>
        <select
          id="truck"
          className="fv-input"
          value={truckSlug}
          onChange={(e) => {
            form.setValue("truck_slug", e.target.value);
            setFormInputs({ truck_slug: e.target.value });
          }}
        >
          {trucks.map((truck) => {
            const slug = slugFromTruckName(truck.name);
            return (
              <option key={truck.id} value={slug}>
                {truck.name} · {truck.usable_kwh} kWh
              </option>
            );
          })}
        </select>
        {selectedTruck ? (
          <div className="font-mono text-xs font-semibold text-[#111116]">
            {selectedTruck.name} · {selectedTruck.usable_kwh} kWh
          </div>
        ) : null}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="fv-field-label mb-0">Payload</span>
            <span className="font-mono text-[12.5px] font-semibold text-[#111116]">
              {payloadLbs.toLocaleString()} lb
            </span>
          </div>
          <input
            id="payload"
            type="range"
            className="fv-range"
            min={20000}
            max={80000}
            step={1000}
            value={payloadLbs}
            onChange={(e) => {
              const value = Number(e.target.value);
              form.setValue("payload_lbs", value);
              setFormInputs({ payload_lbs: value });
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-[11px] font-medium text-[#2a2a2e]">
          <input
            type="checkbox"
            checked={form.watch("port_drayage_enabled")}
            onChange={(e) => {
              form.setValue("port_drayage_enabled", e.target.checked);
              setFormInputs({ port_drayage_enabled: e.target.checked });
            }}
          />
          Port drayage aux load
        </label>
        <label className="flex items-center gap-2 text-[11px] font-medium text-[#2a2a2e]">
          <input
            type="checkbox"
            checked={addToComparison}
            onChange={(e) => setAddToComparison(e.target.checked)}
          />
          Add to comparison
        </label>
      </FvInsetCard>

      {comparisonNotice ? (
        <p className="font-mono text-[10px] text-[#c0392b]">{comparisonNotice}</p>
      ) : null}

      <button
        type="submit"
        className="fv-btn-primary"
        disabled={isPolling}
        data-testid="run-button"
      >
        {isPolling ? "Running physics simulation…" : "▶ Run Physics Simulation"}
      </button>
    </form>
  );
}
