import { lineString, nearestPointOnLine, point } from "@turf/turf";
import type { components } from "@fleetvolt/shared-types";
import type { RouteCoordinates } from "./route-geometry.js";

type Segment = components["schemas"]["SegmentResult"];
type ChargingStop = components["schemas"]["ChargingStopResult"];

export type SegmentChartPoint = {
  distM: number;
  distMi: number;
  socPct: number;
  energyKwh: number;
  grade: number;
};

export function distMToMiles(distM: number): number {
  return distM / 1609.34;
}

export function segmentEndDistancesM(segments: Segment[]): number[] {
  let cumulative = 0;
  return segments.map((segment) => {
    cumulative += segment.dist_m;
    return cumulative;
  });
}

export function findSegmentIndexByDistanceM(
  segments: Segment[],
  distanceM: number,
): number {
  if (segments.length === 0) {
    return -1;
  }

  if (distanceM <= 0) {
    return 0;
  }

  let cumulative = 0;
  let nearestIndex = 0;
  let nearestDelta = Number.POSITIVE_INFINITY;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    const midM = cumulative + segment.dist_m / 2;
    const delta = Math.abs(midM - distanceM);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearestIndex = index;
    }
    cumulative += segment.dist_m;
  }

  return nearestIndex;
}

export function segmentsToChartData(segments: Segment[]): SegmentChartPoint[] {
  let cumulative = 0;
  return segments.map((segment) => {
    cumulative += segment.dist_m;
    return {
      distM: cumulative,
      distMi: distMToMiles(cumulative),
      socPct: segment.soc_pct,
      energyKwh: segment.energy_kwh,
      grade: segment.grade,
    };
  });
}

export function chargingStopDistanceM(
  segments: Segment[],
  stop: ChargingStop,
  routeCoords: RouteCoordinates,
  totalDistM: number,
): number {
  if (routeCoords.length >= 2 && totalDistM > 0) {
    const line = lineString(routeCoords);
    const nearest = nearestPointOnLine(line, point([stop.lon, stop.lat]));
    const location = nearest.properties?.location;
    if (typeof location === "number") {
      return location * totalDistM;
    }
  }

  let cumulative = 0;
  for (const segment of segments) {
    cumulative += segment.dist_m;
    if (segment.charging_event) {
      return cumulative;
    }
  }

  return cumulative;
}
