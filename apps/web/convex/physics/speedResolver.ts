// Posted speed limits with route-history overlay — port of speed_resolver.py (D-08).

import { DEFAULT_TRUCK_TOP_SPEED_MPH } from "./constants";
import { edgeEndM, type EdgeSpeed, type PhysicsSegment } from "./types";

export const OVERLAY_MIN = 0.85;
export const OVERLAY_MAX = 1.0;
export const DEFAULT_POSTED_MPH = 55.0;

/** Truck speed cap for Class 8 costing limits. */
export interface TruckSpeedParams {
  top_speed_mph: number;
}

export function defaultTruckSpeedParams(): TruckSpeedParams {
  return { top_speed_mph: DEFAULT_TRUCK_TOP_SPEED_MPH };
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** Distance-weighted average posted speed across segment span. */
export function postedSpeedForSegment(
  startM: number,
  endM: number,
  edgeSpeeds: EdgeSpeed[],
  defaultMph: number = DEFAULT_POSTED_MPH,
): number {
  if (endM <= startM) return defaultMph;
  if (edgeSpeeds.length === 0) return defaultMph;

  let totalDist = 0.0;
  let weightedSpeed = 0.0;

  for (const edge of edgeSpeeds) {
    const overlapStart = Math.max(startM, edge.start_m);
    const overlapEnd = Math.min(endM, edgeEndM(edge));
    const overlap = overlapEnd - overlapStart;
    if (overlap <= 0) continue;
    totalDist += overlap;
    weightedSpeed += overlap * edge.speed_limit_mph;
  }

  if (totalDist <= 0) return defaultMph;
  return weightedSpeed / totalDist;
}

/** Forward pass: posted limits with route-history overlay per D-08. */
export function resolveSpeeds(
  segments: PhysicsSegment[],
  edgeSpeeds: EdgeSpeed[],
  truckParams: TruckSpeedParams,
): number[] {
  if (segments.length === 0) return [];

  const effectiveSpeeds: number[] = [];
  let priorRealizedDist = 0.0;
  let priorRealizedSpeedSum = 0.0;
  let priorPostedDist = 0.0;
  let priorPostedSpeedSum = 0.0;

  for (const segment of segments) {
    const startM = segment.start_m;
    const endM = segment.end_m;
    const distM = segment.dist_m;
    const postedMph = postedSpeedForSegment(startM, endM, edgeSpeeds);

    let overlayFactor: number;
    if (priorRealizedDist <= 0 || priorPostedDist <= 0) {
      overlayFactor = OVERLAY_MAX;
    } else {
      const priorAvgRealized = priorRealizedSpeedSum / priorRealizedDist;
      const priorAvgPosted = priorPostedSpeedSum / priorPostedDist;
      if (priorAvgPosted <= 0) {
        overlayFactor = OVERLAY_MAX;
      } else {
        overlayFactor = clamp(
          priorAvgRealized / priorAvgPosted,
          OVERLAY_MIN,
          OVERLAY_MAX,
        );
      }
    }

    const effective = Math.min(postedMph * overlayFactor, truckParams.top_speed_mph);
    effectiveSpeeds.push(effective);

    priorRealizedDist += distM;
    priorRealizedSpeedSum += effective * distM;
    priorPostedDist += distM;
    priorPostedSpeedSum += postedMph * distM;
  }

  return effectiveSpeeds;
}

/** Estimate segment travel time for orchestrator hooks. */
export function segmentTravelTimeS(distM: number, speedMph: number): number {
  if (speedMph <= 0) return 0.0;
  return distM / (speedMph * 0.44704);
}
