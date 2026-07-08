"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { components } from "@fleetvolt/shared-types";
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
    <div className="fv-inset-card space-y-3" data-testid="sensitivity-sliders">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="fv-field-label mb-0">Payload adjustment</span>
          <span className="font-mono text-[10px] text-[#8a8a92]">
            {payloadAdjustPct > 0 ? "+" : ""}
            {payloadAdjustPct}% → {adjustedPayload.toLocaleString()} lb
          </span>
        </div>
        <input
          id="payload-adjust"
          type="range"
          className="fv-range"
          min={-20}
          max={20}
          step={1}
          value={payloadAdjustPct}
          onChange={(e) => setPayloadAdjustPct(Number(e.target.value))}
          onMouseUp={scheduleCommit}
          onTouchEnd={scheduleCommit}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="fv-field-label mb-0">Temperature offset</span>
          <span className="font-mono text-[10px] text-[#8a8a92]">
            {temperatureOffsetC > 0 ? "+" : ""}
            {temperatureOffsetC}°C
          </span>
        </div>
        <input
          id="temperature-offset"
          type="range"
          className="fv-range"
          min={-20}
          max={20}
          step={1}
          value={temperatureOffsetC}
          onChange={(e) => setTemperatureOffsetC(Number(e.target.value))}
          onMouseUp={scheduleCommit}
          onTouchEnd={scheduleCommit}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="fv-field-label mb-0">Headwind</span>
          <span className="font-mono text-[10px] text-[#8a8a92]">
            {headwindMs} m/s
          </span>
        </div>
        <input
          id="headwind"
          type="range"
          className="fv-range"
          min={0}
          max={15}
          step={1}
          value={headwindMs}
          onChange={(e) => setHeadwindMs(Number(e.target.value))}
          onMouseUp={scheduleCommit}
          onTouchEnd={scheduleCommit}
        />
      </div>

      {isSensitivityUpdating ? (
        <p
          className="font-mono text-[10px] text-[#4c8fb8]"
          role="status"
          data-testid="sensitivity-updating"
        >
          Updating scenario…
        </p>
      ) : null}
    </div>
  );
}
