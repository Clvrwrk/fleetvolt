// Route segmentation — port of segment_builder.py.
// 10 US mile base cuts with 6% grade subdivision (D-05, D-07).

import {
  BASE_SEGMENT_M,
  GRADE_SCAN_INTERVAL_M,
  GRADE_SPLIT_THRESHOLD_PCT,
  MAX_PHYSICS_SEGMENTS,
} from "./constants";
import type { ElevationPoint, PhysicsSegment } from "./types";

const EARTH_RADIUS_M = 6_371_000.0;

/** Great-circle distance in meters between two WGS84 points. */
export function haversineM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Linearly interpolate elevation at distance along profile. */
export function interpolateElev(
  profile: ElevationPoint[],
  distM: number,
): number {
  if (profile.length === 0) return 0.0;
  if (distM <= profile[0].dist_m) return profile[0].elev_m;
  if (distM >= profile[profile.length - 1].dist_m)
    return profile[profile.length - 1].elev_m;

  for (let i = 1; i < profile.length; i++) {
    const d1 = profile[i - 1].dist_m;
    const d2 = profile[i].dist_m;
    if (d1 <= distM && distM <= d2) {
      const e1 = profile[i - 1].elev_m;
      const e2 = profile[i].elev_m;
      const span = d2 - d1;
      if (span <= 0) return e1;
      const frac = (distM - d1) / span;
      return e1 + frac * (e2 - e1);
    }
  }
  return profile[profile.length - 1].elev_m;
}

/** Average grade percent between start and end distances. */
export function gradeBetween(
  profile: ElevationPoint[],
  startM: number,
  endM: number,
): number {
  const dist = endM - startM;
  if (dist <= 0) return 0.0;
  const elevStart = interpolateElev(profile, startM);
  const elevEnd = interpolateElev(profile, endM);
  return ((elevEnd - elevStart) / dist) * 100.0;
}

/** Interpolate [lon, lat] at distance along route polyline. */
export function interpolatePointAtDist(
  coordinates: number[][],
  distM: number,
): [number, number] {
  if (coordinates.length === 0) return [0.0, 0.0];
  if (coordinates.length === 1)
    return [coordinates[0][0], coordinates[0][1]];

  const cum: number[] = [0.0];
  for (let i = 1; i < coordinates.length; i++) {
    const [lon0, lat0] = coordinates[i - 1];
    const [lon1, lat1] = coordinates[i];
    cum.push(cum[cum.length - 1] + haversineM(lat0, lon0, lat1, lon1));
  }

  if (distM <= 0) return [coordinates[0][0], coordinates[0][1]];
  if (distM >= cum[cum.length - 1])
    return [
      coordinates[coordinates.length - 1][0],
      coordinates[coordinates.length - 1][1],
    ];

  for (let i = 1; i < cum.length; i++) {
    if (cum[i] >= distM) {
      const segLen = cum[i] - cum[i - 1];
      const frac = segLen > 0 ? (distM - cum[i - 1]) / segLen : 0.0;
      const [lon0, lat0] = coordinates[i - 1];
      const [lon1, lat1] = coordinates[i];
      return [lon0 + frac * (lon1 - lon0), lat0 + frac * (lat1 - lat0)];
    }
  }
  return [
    coordinates[coordinates.length - 1][0],
    coordinates[coordinates.length - 1][1],
  ];
}

/** Split a base segment where |grade| exceeds threshold at 150m scan resolution. */
export function subdivideBaseSegment(
  profile: ElevationPoint[],
  baseStart: number,
  baseEnd: number,
): Array<[number, number]> {
  const span = baseEnd - baseStart;
  if (span <= GRADE_SCAN_INTERVAL_M) return [[baseStart, baseEnd]];

  const scanPoints: number[] = [baseStart];
  let d = baseStart + GRADE_SCAN_INTERVAL_M;
  while (d < baseEnd) {
    scanPoints.push(d);
    d += GRADE_SCAN_INTERVAL_M;
  }
  if (scanPoints[scanPoints.length - 1] !== baseEnd) {
    scanPoints.push(baseEnd);
  }

  const intervals: Array<[number, number, boolean]> = [];
  for (let i = 0; i < scanPoints.length - 1; i++) {
    const s = scanPoints[i];
    const e = scanPoints[i + 1];
    const g = gradeBetween(profile, s, e);
    intervals.push([s, e, Math.abs(g) > GRADE_SPLIT_THRESHOLD_PCT]);
  }

  if (!intervals.some(([, , steep]) => steep)) {
    return [[baseStart, baseEnd]];
  }

  const merged: Array<[number, number]> = [];
  let segStart = intervals[0][0];
  let segSteep = intervals[0][2];
  for (const [s, , steep] of intervals) {
    if (steep !== segSteep && s > segStart) {
      merged.push([segStart, s]);
      segStart = s;
      segSteep = steep;
    }
  }
  merged.push([segStart, baseEnd]);
  return merged;
}

/** Build physics segments with 10-mile base cuts and 6% grade splits. */
export function buildSegments(
  distanceM: number,
  coordinates: number[][],
  elevationProfile: ElevationPoint[],
): PhysicsSegment[] {
  if (distanceM <= 0) return [];

  const baseCuts: number[] = [0.0];
  let d = BASE_SEGMENT_M;
  while (d < distanceM) {
    baseCuts.push(d);
    d += BASE_SEGMENT_M;
  }
  baseCuts.push(distanceM);

  const rawSegments: Array<[number, number]> = [];
  for (let i = 0; i < baseCuts.length - 1; i++) {
    rawSegments.push(
      ...subdivideBaseSegment(elevationProfile, baseCuts[i], baseCuts[i + 1]),
    );
  }

  if (rawSegments.length > MAX_PHYSICS_SEGMENTS) {
    throw new Error(
      `Segment count ${rawSegments.length} exceeds cap ${MAX_PHYSICS_SEGMENTS}`,
    );
  }

  const segments: PhysicsSegment[] = [];
  for (const [startM, endM] of rawSegments) {
    const segDist = endM - startM;
    const midM = (startM + endM) / 2.0;
    const [midLon, midLat] = interpolatePointAtDist(coordinates, midM);
    const gradePct = gradeBetween(elevationProfile, startM, endM);
    segments.push({
      dist_m: Math.round(segDist * 100) / 100,
      grade_pct: Math.round(gradePct * 10000) / 10000,
      start_m: Math.round(startM * 100) / 100,
      end_m: Math.round(endM * 100) / 100,
      mid_lon: Math.round(midLon * 1_000_000) / 1_000_000,
      mid_lat: Math.round(midLat * 1_000_000) / 1_000_000,
    });
  }

  return segments;
}
