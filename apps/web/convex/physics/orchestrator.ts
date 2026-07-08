// End-to-end simulation pipeline — port of orchestrator.py (D-01).
// Route → elevation → segments → physics → SoC → KPIs → optional charging → feasibility.

import { US_MILE_M } from "./constants";
import { buildSegments } from "./segmentBuilder";
import { segmentForces } from "./physicsEngine";
import { integrateSoc } from "./socIntegrator";
import { aggregateKpis } from "./kpiAggregator";
import { applyWeather } from "./weather";
import { resolveSpeeds, defaultTruckSpeedParams } from "./speedResolver";
import { applyTruckOverrides } from "./overrides";
import { applyPortDrayage } from "./portDrayage";
import { planGreedyStops, type ChargerSearchCtx } from "./chargingPlanner";
import {
  classifyFeasibility,
  getChargingAssumptions,
  plannerOutcomeFromStatus,
  shadowPassDepotAtOrigin,
} from "./feasibility";
import { interpolatePointAtDist } from "./segmentBuilder";
import type {
  AssumptionEntry,
  ChargeBreakpoint,
  ChargingStopResult,
  ConditionsSpec,
  ElevationPoint,
  EdgeSpeed,
  FeasibilityResult,
  KpiResult,
  PhysicsSegment,
  SegmentResult,
  SimulateRequest,
  SimulateResponse,
  TruckParams,
} from "./types";

export const MAX_ROUTE_MI = 800.0;
export const MAX_ROUTE_M = MAX_ROUTE_MI * US_MILE_M;

export const DISCLAIMER =
  "Planning and feasibility tool only — not real-time dispatch guidance. " +
  "Results depend on OEM assumptions, cached elevation, and posted speed limits. " +
  "Verify against manufacturer claims before stakeholder decisions.";

/** Context for orchestrator — provides Convex table reads + charger search. */
export interface OrchestratorCtx {
  /** Load truck config by slug from truckConfigs table. */
  loadTruckConfig(
    slug: string,
    conditions: ConditionsSpec,
  ): Promise<{
    truck: TruckParams;
    oemParams: Record<string, unknown>;
    filePayload: Record<string, unknown>;
  }>;
  /** Resolve route endpoints — corridor or custom O/D. */
  resolveEndpoints(
    request: SimulateRequest,
  ): Promise<{
    originLat: number;
    originLon: number;
    destLat: number;
    destLon: number;
    corridorKey: string | null;
  }>;
  /** Get elevation profile — from elevationProfiles table or compute. */
  getElevationProfile(
    corridorKey: string | null,
    coordinates: number[][],
    originLat: number,
    originLon: number,
    destLat: number,
    destLon: number,
  ): Promise<{
    profile: ElevationPoint[];
    source: string;
    distanceM: number;
    coordinates: number[][];
  }>;
  /** Get edge speeds (posted speed limits). Empty array under Google Routes. */
  getEdgeSpeeds?(coordinates: number[][]): Promise<EdgeSpeed[]>;
  /** Charger search context for the charging planner. */
  chargerSearchCtx: ChargerSearchCtx;
}

/** Synthetic lon/lat interpolation for corridor preset geometry. */
export function syntheticCoordinates(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  numPoints: number = 32,
): number[][] {
  const n = Math.max(2, numPoints);
  const coords: number[][] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const lon = originLon + t * (destLon - originLon);
    const lat = originLat + t * (destLat - originLat);
    coords.push([lon, lat]);
  }
  return coords;
}

/** Run the full simulation pipeline. */
export async function runSimulation(
  ctx: OrchestratorCtx,
  request: SimulateRequest,
): Promise<SimulateResponse> {
  const conditions = request.conditions ?? {};
  const overrides = request.overrides ?? {};
  const options = request.options ?? { include_charging: true };

  // 1. Resolve endpoints
  const { originLat, originLon, destLat, destLon, corridorKey } =
    await ctx.resolveEndpoints(request);

  // 2. Load truck config
  const { truck: baseTruck, oemParams, filePayload } = await ctx.loadTruckConfig(
    request.truck.slug,
    conditions,
  );

  // 3. Apply overrides
  const { truck, assumptions } = applyTruckOverrides(baseTruck, overrides, oemParams, filePayload);

  // 4. Apply weather
  const weather = applyWeather(truck, conditions);

  // 5. Get elevation profile + coordinates
  const coords = corridorKey
    ? syntheticCoordinates(originLat, originLon, destLat, destLon)
    : syntheticCoordinates(originLat, originLon, destLat, destLon); // fallback

  const elevResult = await ctx.getElevationProfile(
    corridorKey,
    coords,
    originLat,
    originLon,
    destLat,
    destLon,
  );
  const { profile, source: elevSource, distanceM, coordinates } = elevResult;

  // 6. Route distance check
  if (distanceM > MAX_ROUTE_M) {
    throw new Error(
      `Route distance ${distanceM / US_MILE_M} mi exceeds cap ${MAX_ROUTE_MI} mi`,
    );
  }

  // 7. Build segments
  const rawSegments = buildSegments(distanceM, coordinates, profile);

  // 8. Resolve speeds (edge_speeds empty under Google Routes — falls back to DEFAULT_POSTED_MPH=55)
  const edgeSpeeds = ctx.getEdgeSpeeds ? await ctx.getEdgeSpeeds(coordinates) : [];
  const speedMph = resolveSpeeds(rawSegments, edgeSpeeds, defaultTruckSpeedParams());

  // Extract arrays
  const distM = rawSegments.map((s) => s.dist_m);
  const gradePct = rawSegments.map((s) => s.grade_pct);

  // 9. Apply port drayage (aux_kw adjusted by weather.aux_mult first)
  const auxKwBase = rawSegments.map(() => truck.aux_kw_base * weather.aux_mult);
  const { speedMph: speedArr, auxKw: auxKwArr } = applyPortDrayage(
    rawSegments,
    speedMph,
    auxKwBase,
    conditions.port_drayage_enabled ?? false,
  );

  // 10. Segment forces
  const { pTraction, auxW } = segmentForces(distM, gradePct, speedArr, truck, {
    rho: weather.rho,
    headwindMph: weather.headwind_mph,
    thermalFactor: weather.thermal_factor,
    auxKw: auxKwArr,
  });

  // 11. Integrate SoC
  const socResult = integrateSoc(pTraction, auxW, distM, speedArr, truck);

  // 12. Aggregate KPIs
  const kpis: KpiResult = aggregateKpis(
    socResult.energyKwh,
    socResult.regenKwh,
    distM,
    speedArr,
  );

  // 13. Optional charging planner
  let socWorking = [...socResult.socPct];
  let chargingStops: ChargingStopResult[] = [];
  let feasibility: FeasibilityResult | null = null;
  let stopSegmentIndices: number[] = [];
  let allAssumptions: AssumptionEntry[] = [...assumptions];

  if (options.include_charging) {
    const chargeCurve = (filePayload.charge_curve as ChargeBreakpoint[]) ?? [];
    const chargingConditions = conditions.charging ?? {};

    const { stops: stopDicts, status: publicStatus } = await planGreedyStops(
      ctx.chargerSearchCtx,
      rawSegments,
      socWorking,
      coordinates,
      truck,
      chargeCurve,
      chargingConditions,
    );
    stopSegmentIndices = stopDicts.map((_, idx) => idx); // segment_index not in ChargingStopResult

    chargingStops = stopDicts;

    let shadowComplete: boolean | null = null;
    if (!publicStatus.complete) {
      shadowComplete = await shadowPassDepotAtOrigin(
        ctx.chargerSearchCtx,
        rawSegments,
        socWorking,
        coordinates,
        truck,
        chargeCurve,
        chargingConditions,
      );
    }

    const plannerOutcome = plannerOutcomeFromStatus(publicStatus, shadowComplete);
    feasibility = classifyFeasibility(
      chargingStops,
      socWorking[socWorking.length - 1],
      chargingConditions,
      plannerOutcome,
    );
    allAssumptions = [...allAssumptions, ...getChargingAssumptions()];
  }

  // 14. Build segment results
  const socForSegments = options.include_charging ? socWorking : socResult.socPct;
  const chargingBySegment = new Map<number, number>();
  stopSegmentIndices.forEach((idx, seq) => chargingBySegment.set(idx, seq + 1));

  const segments: SegmentResult[] = rawSegments.map((seg, i) => ({
    dist_m: Math.round(distM[i] * 100) / 100,
    grade: Math.round(gradePct[i] * 10000) / 10000,
    speed: Math.round(speedArr[i] * 100) / 100,
    energy_kwh: Math.round(socResult.energyKwh[i] * 10000) / 10000,
    soc_pct: Math.round(socForSegments[i] * 100) / 100,
    charging_event: chargingBySegment.has(i),
    stop_sequence: chargingBySegment.get(i) ?? null,
  }));

  // 15. Build response
  const response: SimulateResponse = {
    segments,
    kpis,
    disclaimer: DISCLAIMER,
    assumptions: allAssumptions,
    corridor_key: corridorKey ?? null,
    truck_slug: request.truck.slug,
    metadata: {
      elevation_source: elevSource,
      segment_count: segments.length,
      weather_preset: conditions.weather_preset ?? "ideal",
      port_drayage_enabled: conditions.port_drayage_enabled ?? false,
      payload_lbs: conditions.payload_lbs ?? 0,
    },
  };

  if (options.include_charging) {
    response.charging_stops = chargingStops;
    response.feasibility = feasibility;
  }

  return response;
}
