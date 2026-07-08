// Greedy HD charging stop planner — port of charging_planner.py (CHRG-01, CHRG-02, D-06).
// Uses Convex spatial layer (nearestPoints) instead of PostGIS ST_DWithin.

import { integrateChargeCurve } from "./chargeCurve";
import { detourSeconds } from "./detourValidator";
import { interpolatePointAtDist } from "./segmentBuilder";
import type {
  ChargeBreakpoint,
  ChargingConditionsSpec,
  ChargingStopResult,
  PhysicsSegment,
  TruckParams,
} from "./types";

export const SEARCH_RADIUS_M = 40_234.0; // ~25 miles
export const FALLBACK_RADIUS_M = 80_468.0; // ~50 miles
export const MAX_DETOUR_S = 600.0;
export const MIN_HD_POWER_KW = 350.0;

export interface HdChargerCandidate {
  station_id: string;
  name?: string | null;
  lat: number;
  lon: number;
  power_kw: number;
  hd_capable: boolean;
  distance_m: number;
}

export type BlockingReason =
  | "no_charger_in_radius"
  | "detour_exceeded"
  | "cannot_reach_destination";

export interface PlannerStatus {
  complete: boolean;
  blocking_reason?: BlockingReason | null;
  soc_deficit_kwh?: number | null;
}

/** Context for charger search — abstracts Convex db + spatial layer. */
export interface ChargerSearchCtx {
  /** Search HD-capable chargers near a point within radius. */
  searchHdChargers(
    lat: number,
    lon: number,
    radiusM: number,
  ): Promise<HdChargerCandidate[]>;
  /** Get Google Maps API key for detour validation. */
  getApiKey(): string;
}

function segmentDistM(segments: PhysicsSegment[], index: number): number {
  return segments[index]?.start_m ?? 0.0;
}

function rejoinPoint(
  segments: PhysicsSegment[],
  coordinates: number[][],
  triggerIndex: number,
): { lat: number; lon: number } {
  const rejoinIndex = Math.min(triggerIndex + 1, segments.length - 1);
  const distM = segmentDistM(segments, rejoinIndex);
  const [lon, lat] = interpolatePointAtDist(coordinates, distM);
  return { lat, lon };
}

/** Add charged energy to forward SoC on same segment geometry (D-16). */
export function injectSocFromIndex(
  socPct: number[],
  startIndex: number,
  energyKwh: number,
  usableKwh: number,
): void {
  const boostPct = (energyKwh / usableKwh) * 100.0;
  for (let i = startIndex; i < socPct.length; i++) {
    socPct[i] = Math.max(0.0, Math.min(100.0, socPct[i] + boostPct));
  }
}

function computeChargeTarget(
  socPct: number[],
  stopIndex: number,
  arrivalSoc: number,
  conditions: ChargingConditionsSpec,
): number {
  const defaultTarget = conditions.target_soc_pct ?? 80.0;
  const minArrival = conditions.min_arrival_soc_pct ?? 10.0;

  if (socPct[socPct.length - 1] >= minArrival) {
    return defaultTarget;
  }

  const boostNeededPct = Math.max(0.0, minArrival - socPct[socPct.length - 1]);
  const chargeToSocNeeded = arrivalSoc + boostNeededPct;
  return Math.min(100.0, Math.max(defaultTarget, chargeToSocNeeded));
}

export function socDeficitKwh(
  soc: number[],
  truck: TruckParams,
  minArrivalPct: number,
): number {
  const final = soc[soc.length - 1];
  if (final >= minArrivalPct) return 0.0;
  return ((minArrivalPct - final) / 100.0) * truck.usable_kwh;
}

export interface PlanGreedyStopsResult {
  stops: ChargingStopResult[];
  status: PlannerStatus;
}

/** Greedy first-feasible HD charging stop selection per D-06. */
export async function planGreedyStops(
  ctx: ChargerSearchCtx,
  segments: PhysicsSegment[],
  socPct: number[],
  coordinates: number[][],
  truck: TruckParams,
  chargeCurve: ChargeBreakpoint[],
  conditions: ChargingConditionsSpec,
  stationKw: number = 350.0,
): Promise<PlanGreedyStopsResult> {
  const triggerPct = conditions.soc_trigger_pct ?? 18.0;
  const floorPct = conditions.soc_floor_pct ?? 10.0;
  const minArrivalPct = conditions.min_arrival_soc_pct ?? 10.0;

  const soc = [...socPct]; // writable copy
  const stops: ChargingStopResult[] = [];
  const n = soc.length;
  const apiKey = ctx.getApiKey();

  let i = 1;
  while (i < n) {
    if (soc[i] < floorPct) {
      return {
        stops: [],
        status: {
          complete: false,
          blocking_reason: "cannot_reach_destination",
          soc_deficit_kwh: socDeficitKwh(soc, truck, minArrivalPct),
        },
      };
    }

    const crossedTrigger = soc[i - 1] > triggerPct && soc[i] <= triggerPct;
    if (!crossedTrigger) {
      i++;
      continue;
    }

    const distM = segmentDistM(segments, i);
    const [lon, lat] = interpolatePointAtDist(coordinates, distM);
    const origin = { lat, lon };
    const rejoin = rejoinPoint(segments, coordinates, i);

    // Search with fallback: 25mi then 50mi
    let candidates = await ctx.searchHdChargers(lat, lon, SEARCH_RADIUS_M);
    if (candidates.length === 0) {
      candidates = await ctx.searchHdChargers(lat, lon, FALLBACK_RADIUS_M);
    }

    const feasible: Array<{ candidate: HdChargerCandidate; detourS: number }> = [];
    for (const candidate of candidates) {
      const detourS = await detourSeconds(
        origin,
        { lat: candidate.lat, lon: candidate.lon },
        rejoin,
        apiKey,
      );
      if (detourS <= MAX_DETOUR_S) {
        feasible.push({ candidate, detourS });
      }
    }

    if (feasible.length === 0) {
      return {
        stops: [],
        status: {
          complete: false,
          blocking_reason: "no_charger_in_radius",
          soc_deficit_kwh: socDeficitKwh(soc, truck, minArrivalPct),
        },
      };
    }

    // Sort by detour ascending, then by power descending (tie-break)
    feasible.sort((a, b) => {
      if (a.detourS !== b.detourS) return a.detourS - b.detourS;
      return b.candidate.power_kw - a.candidate.power_kw;
    });

    const { candidate: bestCandidate, detourS: bestDetour } = feasible[0];
    const arrivalSoc = soc[i];
    const chargeTarget = computeChargeTarget(soc, i, arrivalSoc, conditions);
    const effectiveStationKw = Math.min(stationKw, bestCandidate.power_kw);

    const { dwellS, energyKwh, departureSoc } = integrateChargeCurve(
      chargeCurve,
      arrivalSoc,
      chargeTarget,
      effectiveStationKw,
      truck.usable_kwh,
    );
    injectSocFromIndex(soc, i, energyKwh, truck.usable_kwh);

    stops.push({
      station_id: bestCandidate.station_id,
      name: bestCandidate.name,
      lat: bestCandidate.lat,
      lon: bestCandidate.lon,
      power_kw: bestCandidate.power_kw,
      arrival_soc_pct: Math.round(arrivalSoc * 100) / 100,
      departure_soc_pct: Math.round(departureSoc * 100) / 100,
      dwell_s: Math.round(dwellS * 10) / 10,
      energy_added_kwh: Math.round(energyKwh * 10000) / 10000,
      detour_s: Math.round(bestDetour * 10) / 10,
    });

    i++;
  }

  return { stops, status: { complete: true } };
}
