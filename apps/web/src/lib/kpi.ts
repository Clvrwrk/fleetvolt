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

export type FeasibilityBadgeVariant = FeasibilityResult["verdict"];

const FEASIBILITY_BADGE_CLASSES: Record<FeasibilityBadgeVariant, string> = {
  feasible: "bg-[#DCFCE7] text-[#166534]",
  critical: "bg-[#FEF3C7] text-[#92400E]",
  infeasible: "bg-[#FEE2E2] text-[#991B1B]",
};

const FEASIBILITY_TIER_LABELS: Record<FeasibilityResult["tier"], string> = {
  public_hd: "Public HD",
  depot_required: "Depot required",
  infrastructure_gap: "Infrastructure gap",
};

export function formatDurationSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export function formatKwh(kwh: number): string {
  return `${kwh.toFixed(1)} kWh`;
}

export function formatWhPerMi(whPerMi: number): string {
  return `${Math.round(whPerMi)} Wh/mi`;
}

export function feasibilityBadgeVariant(
  verdict: FeasibilityResult["verdict"] | null,
): FeasibilityBadgeVariant | null {
  return verdict;
}

export function feasibilityBadgeClasses(
  variant: FeasibilityBadgeVariant,
): string {
  return FEASIBILITY_BADGE_CLASSES[variant];
}

export function formatFeasibilityTierLabel(
  tier: FeasibilityResult["tier"],
): string {
  return FEASIBILITY_TIER_LABELS[tier];
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
    totalKwhFormatted: formatKwh(outputs.kpis.total_kwh),
    whPerMi: outputs.kpis.wh_per_mi,
    whPerMiFormatted: formatWhPerMi(outputs.kpis.wh_per_mi),
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
