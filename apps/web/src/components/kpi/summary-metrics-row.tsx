"use client";

import type { components } from "@fleetvolt/shared-types";
import { deriveKpiSummary } from "@/lib/kpi";

type SimulateResponse = components["schemas"]["SimulateResponse"];

type SummaryMetricsRowProps = {
  outputs: SimulateResponse;
};

function distanceMi(outputs: SimulateResponse): number {
  const last = outputs.segments.at(-1);
  if (!last?.dist_m) {
    return 0;
  }
  return Math.round((last.dist_m / 1609.344) * 10) / 10;
}

function peakGradePct(outputs: SimulateResponse): number {
  let max = 0;
  for (const seg of outputs.segments) {
    const g = Math.abs(seg.grade ?? 0);
    if (g > max) {
      max = g;
    }
  }
  return Math.round(max * 10) / 10;
}

export function SummaryMetricsRow({ outputs }: SummaryMetricsRowProps) {
  const kpi = deriveKpiSummary(outputs);
  const kwhPerMi = kpi.whPerMi / 1000;

  const metrics = [
    { label: "DISTANCE", value: String(distanceMi(outputs)), unit: "mi" },
    { label: "PEAK GRADE", value: String(peakGradePct(outputs)), unit: "%" },
    {
      label: "NET ENERGY",
      value: kpi.totalKwh.toFixed(0),
      unit: "kWh",
    },
    { label: "kWh/mi", value: kwhPerMi.toFixed(2), unit: "" },
    { label: "CHARGE STOPS", value: String(kpi.stopCount), unit: "" },
  ];

  return (
    <div
      className="fv-summary-metrics"
      data-testid="kpi-card-row"
    >
      {metrics.map((m) => (
        <div key={m.label} className="fv-metric-chip" data-testid={`kpi-${m.label.toLowerCase().replace(/\s+/g, "-")}`}>
          <div className="fv-metric-chip-label">{m.label}</div>
          <div className="fv-metric-chip-value">
            {m.value}
            {m.unit ? (
              <span className="fv-metric-chip-unit"> {m.unit}</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
