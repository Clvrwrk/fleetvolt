// Feasibility verdict and infrastructure tier classifier — port of feasibility.py (CHRG-04, CHRG-05, D-10–D-13).

import { injectSocFromIndex, planGreedyStops, socDeficitKwh, type ChargerSearchCtx, type PlannerStatus } from "./chargingPlanner";
import type {
  AssumptionEntry,
  ChargeBreakpoint,
  ChargingConditionsSpec,
  ChargingStopResult,
  FeasibilityResult,
  PhysicsSegment,
  TruckParams,
} from "./types";

export const CRITICAL_SOC_FLOOR_PCT = 5.0;
export const MIN_DWELL_BUFFER_S = 1800.0;

export const GREEDY_ASSUMPTION_NOTE =
  "CHRG-06 deferred to v2 scored-greedy: intended weights time=0.4, energy=0.35, cost=0.25. " +
  "v1 uses first-feasible greedy with shortest detour then highest power tie-break.";

export type BlockingReason =
  | "no_charger_in_radius"
  | "detour_exceeded"
  | "cannot_reach_destination";

export interface PlannerOutcome {
  public_complete: boolean;
  shadow_depot_complete?: boolean | null;
  blocking_reason?: BlockingReason | null;
  soc_deficit_kwh?: number | null;
}

function isCritical(
  finalSocPct: number,
  stops: ChargingStopResult[],
  conditions: ChargingConditionsSpec,
): boolean {
  const minArrival = conditions.min_arrival_soc_pct ?? 10.0;
  if (CRITICAL_SOC_FLOOR_PCT <= finalSocPct && finalSocPct < minArrival) {
    return true;
  }
  if (stops.length === 1 && stops[0].dwell_s < MIN_DWELL_BUFFER_S) {
    return true;
  }
  return false;
}

function resolveTier(plannerOutcome: PlannerOutcome): "public_hd" | "depot_required" | "infrastructure_gap" {
  if (plannerOutcome.public_complete) return "public_hd";
  if (plannerOutcome.shadow_depot_complete) return "depot_required";
  return "infrastructure_gap";
}

/** Pure classifier — no side effects (D-10, D-22). */
export function classifyFeasibility(
  stops: ChargingStopResult[],
  finalSocPct: number,
  conditions: ChargingConditionsSpec,
  plannerOutcome: PlannerOutcome,
): FeasibilityResult {
  const tier = resolveTier(plannerOutcome);
  const completable =
    plannerOutcome.public_complete || plannerOutcome.shadow_depot_complete === true;

  if (!completable) {
    return {
      verdict: "infeasible",
      tier,
      soc_deficit_kwh: plannerOutcome.soc_deficit_kwh ?? null,
      blocking_reason: (plannerOutcome.blocking_reason as any) ?? null,
      stop_count: stops.length,
    };
  }

  const verdict = isCritical(finalSocPct, stops, conditions) ? "critical" : "feasible";
  return {
    verdict,
    tier,
    stop_count: stops.length,
  };
}

/** Document CHRG-06 deferred multi-objective weights per D-07. */
export function getChargingAssumptions(): AssumptionEntry[] {
  return [
    {
      field: "charging_greedy_strategy",
      value: 0.4,
      source: "documented_deferred_v2",
      oem_default: 0.35,
      category: "charging",
      note: GREEDY_ASSUMPTION_NOTE,
    },
  ];
}

/** Shadow pass: unlimited depot charge at route origin (D-11, RESEARCH Q1). */
export async function shadowPassDepotAtOrigin(
  ctx: ChargerSearchCtx,
  segments: PhysicsSegment[],
  socPct: number[],
  coordinates: number[][],
  truck: TruckParams,
  chargeCurve: ChargeBreakpoint[],
  conditions: ChargingConditionsSpec,
): Promise<boolean> {
  const soc = [...socPct];
  const energyToFull = ((100.0 - soc[0]) / 100.0) * truck.usable_kwh;
  if (energyToFull > 0) {
    injectSocFromIndex(soc, 0, energyToFull, truck.usable_kwh);
  }

  const { status } = await planGreedyStops(
    ctx,
    segments,
    soc,
    coordinates,
    truck,
    chargeCurve,
    conditions,
  );
  return status.complete;
}

/** Build classifier input from greedy planner status. */
export function plannerOutcomeFromStatus(
  publicStatus: PlannerStatus,
  shadowDepotComplete?: boolean | null,
): PlannerOutcome {
  if (publicStatus.complete) {
    return { public_complete: true };
  }

  return {
    public_complete: false,
    shadow_depot_complete: shadowDepotComplete,
    blocking_reason: (publicStatus.blocking_reason as BlockingReason | undefined) ?? null,
    soc_deficit_kwh: publicStatus.soc_deficit_kwh ?? null,
  };
}
