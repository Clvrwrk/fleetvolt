"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { components } from "@fleetvolt/shared-types";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  payloadLbsFromAdjustmentPercent,
  weatherPresetFromSensitivity,
  weatherPresetFromTemperatureOffset,
} from "@/lib/scenario-schema";
import { useScenarioStore } from "@/stores/scenario-store";

type SimulateRequest = components["schemas"]["SimulateRequest"];

const DEBOUNCE_MS = 500;

function useDebouncedCommit(onCommit: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleCommit = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onCommit();
    }, DEBOUNCE_MS);
  }, [onCommit]);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  return scheduleCommit;
}

export function SensitivitySliders() {
  const pollResult = useScenarioStore((s) => s.pollResult);
  const isSensitivityUpdating = useScenarioStore((s) => s.isSensitivityUpdating);
  const submitSensitivityRun = useScenarioStore((s) => s.submitSensitivityRun);

  const baselineInputs = pollResult?.inputs as SimulateRequest | null | undefined;
  const baselinePayload = baselineInputs?.conditions?.payload_lbs ?? 34000;

  const [payloadAdjustPct, setPayloadAdjustPct] = useState(0);
  const [temperatureOffsetC, setTemperatureOffsetC] = useState(0);
  const [headwindMs, setHeadwindMs] = useState(0);

  const adjustedPayload = payloadLbsFromAdjustmentPercent(
    baselinePayload,
    payloadAdjustPct,
  );
  const temperaturePreset = weatherPresetFromTemperatureOffset(
    temperatureOffsetC,
  );
  const effectivePreset = weatherPresetFromSensitivity(
    temperatureOffsetC,
    headwindMs,
  );

  const runSensitivity = useCallback(async () => {
    if (!baselineInputs) {
      return;
    }

    const body: SimulateRequest = {
      ...baselineInputs,
      conditions: {
        weather_preset: effectivePreset,
        payload_lbs: adjustedPayload,
        port_drayage_enabled:
          baselineInputs.conditions?.port_drayage_enabled ?? false,
        ...(baselineInputs.conditions?.charging
          ? { charging: baselineInputs.conditions.charging }
          : {}),
      },
    };

    await submitSensitivityRun(body);
  }, [adjustedPayload, baselineInputs, effectivePreset, submitSensitivityRun]);

  const scheduleCommit = useDebouncedCommit(runSensitivity);

  if (pollResult?.status !== "COMPLETE" || !baselineInputs) {
    return null;
  }

  return (
    <div className="space-y-4 border-t border-[var(--fv-stroke)] pt-4" data-testid="sensitivity-sliders">
      <div>
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Sensitivity
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Adjust on release — re-runs simulation after 500ms debounce.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="payload-adjust">Payload adjustment</Label>
          <span className="text-xs text-muted-foreground">
            {payloadAdjustPct > 0 ? "+" : ""}
            {payloadAdjustPct}% → {adjustedPayload.toLocaleString()} lbs
          </span>
        </div>
        <Slider
          id="payload-adjust"
          min={-20}
          max={20}
          step={1}
          value={[payloadAdjustPct]}
          onValueChange={([value]) => setPayloadAdjustPct(value ?? 0)}
          onValueCommit={scheduleCommit}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="temperature-offset">Temperature offset</Label>
          <span className="text-xs text-muted-foreground">
            {temperatureOffsetC > 0 ? "+" : ""}
            {temperatureOffsetC}°C → {temperaturePreset} preset
          </span>
        </div>
        <Slider
          id="temperature-offset"
          min={-20}
          max={20}
          step={1}
          value={[temperatureOffsetC]}
          onValueChange={([value]) => setTemperatureOffsetC(value ?? 0)}
          onValueCommit={scheduleCommit}
        />
        <p className="text-xs text-muted-foreground">
          Maps to weather preset: &lt;−10°C cold, &gt;+10°C hot, else ideal
          (unless headwind overrides).
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="headwind">Headwind</Label>
          <span className="text-xs text-muted-foreground">
            {headwindMs} m/s
            {headwindMs >= 8 ? " → headwind preset" : ""}
          </span>
        </div>
        <Slider
          id="headwind"
          min={0}
          max={15}
          step={1}
          value={[headwindMs]}
          onValueChange={([value]) => setHeadwindMs(value ?? 0)}
          onValueCommit={scheduleCommit}
        />
        <p className="text-xs text-muted-foreground">
          At 8 m/s or above, weather preset switches to headwind.
        </p>
      </div>

      {isSensitivityUpdating ? (
        <p
          className="text-xs font-medium text-[var(--fv-accent)]"
          role="status"
          data-testid="sensitivity-updating"
        >
          Updating scenario…
        </p>
      ) : null}
    </div>
  );
}
