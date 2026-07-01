import type { components } from "@fleetvolt/shared-types";

type SimulateResponse = components["schemas"]["SimulateResponse"];
type FeasibilityResult = components["schemas"]["FeasibilityResult"];

export type KpiSummary = {
  totalKwh: number;
  totalKwhFormatted: string;
  whPerMi: number;
  whPerMiFormatted: string;
  totalTimeS: number;
  tripTimeFormatted: string;
  stopCount: number;
  totalDwellS: number;
  totalDwellFormatted: string;
  finalSocPct: number;
  finalSocFormatted: string;
  feasibilityVerdict: FeasibilityResult["verdict"] | null;
  feasibilityTier: FeasibilityResult["tier"] | null;
};

export function formatDurationSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export function totalDwellSeconds(
  stops: SimulateResponse["charging_stops"],
): number {
  return (stops ?? []).reduce((sum, stop) => sum + stop.dwell_s, 0);
}

export function deriveKpiSummary(outputs: SimulateResponse): KpiSummary {
  const lastSegment = outputs.segments.at(-1);
  const finalSocPct = lastSegment?.soc_pct ?? 0;
  const totalDwellS = totalDwellSeconds(outputs.charging_stops);
  const stopCount =
    outputs.feasibility?.stop_count ?? outputs.charging_stops?.length ?? 0;

  return {
    totalKwh: outputs.kpis.total_kwh,
    totalKwhFormatted: `${outputs.kpis.total_kwh.toFixed(1)} kWh`,
    whPerMi: outputs.kpis.wh_per_mi,
    whPerMiFormatted: `${Math.round(outputs.kpis.wh_per_mi)} Wh/mi`,
    totalTimeS: outputs.kpis.total_time_s,
    tripTimeFormatted: formatDurationSeconds(outputs.kpis.total_time_s),
    stopCount,
    totalDwellS,
    totalDwellFormatted: formatDurationSeconds(totalDwellS),
    finalSocPct,
    finalSocFormatted: `${finalSocPct.toFixed(1)}%`,
    feasibilityVerdict: outputs.feasibility?.verdict ?? null,
    feasibilityTier: outputs.feasibility?.tier ?? null,
  };
}
