import {
  bboxAround,
  distanceToPolylineM,
  type Bbox,
  type LatLng,
} from "../lib/haversine";

export const ENRICHMENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ENRICHMENT_REFRESH_LEASE_MS = 2 * 60 * 1000;
export const ROUTE_POINT_RADIUS_M = 8_000;
export const ROUTE_HIGHWAY_RADIUS_M = 2_000;
export const MAX_ROUTE_PROBES = 16;

export type EnrichmentDisposition =
  | "fresh"
  | "refresh-owner"
  | "stale-refreshing";

export function cacheDisposition(
  row: {
    hasSnapshot: boolean;
    expiresAt: number;
    refreshLeaseUntil?: number;
  } | null,
  now: number,
): EnrichmentDisposition {
  if (!row) return "refresh-owner";
  if (row.hasSnapshot && row.expiresAt > now) return "fresh";
  if (row.refreshLeaseUntil !== undefined && row.refreshLeaseUntil > now) {
    return "stale-refreshing";
  }
  return "refresh-owner";
}

export function sampleRoute(points: LatLng[], maxPoints = MAX_ROUTE_PROBES): LatLng[] {
  if (points.length <= maxPoints) return points;
  if (maxPoints <= 1) return [points[0]!];
  const last = points.length - 1;
  const sampled: LatLng[] = [];
  for (let index = 0; index < maxPoints; index += 1) {
    sampled.push(points[Math.round((index / (maxPoints - 1)) * last)]!);
  }
  return sampled;
}

export function expandedRouteBbox(points: LatLng[], radiusM: number): Bbox {
  if (points.length === 0) {
    throw new Error("Cannot build a route bbox without road coordinates");
  }
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const point of points) {
    const around = bboxAround(point, radiusM);
    minLat = Math.min(minLat, around.minLat);
    minLng = Math.min(minLng, around.minLng);
    maxLat = Math.max(maxLat, around.maxLat);
    maxLng = Math.max(maxLng, around.maxLng);
  }
  return { minLat, minLng, maxLat, maxLng };
}

export function polylineDistanceM(a: LatLng[], b: LatLng[]): number {
  if (a.length === 0 || b.length === 0) return Infinity;
  let best = Infinity;
  for (const point of sampleRoute(a, 24)) {
    best = Math.min(best, distanceToPolylineM(point, b));
  }
  for (const point of sampleRoute(b, 24)) {
    best = Math.min(best, distanceToPolylineM(point, a));
  }
  return best;
}

export function aadtStatistics(
  values: Array<number | null | undefined>,
): {
  min: number;
  max: number;
  mean: number;
  p90: number;
  sampleCount: number;
} | null {
  const measured = values
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b);
  if (measured.length === 0) return null;
  const sum = measured.reduce((total, value) => total + value, 0);
  const p90Index = Math.min(measured.length - 1, Math.ceil(measured.length * 0.9) - 1);
  return {
    min: measured[0]!,
    max: measured.at(-1)!,
    mean: Math.round((sum / measured.length) * 10) / 10,
    p90: measured[p90Index]!,
    sampleCount: measured.length,
  };
}

export function dedupeNearest<T extends { distanceM: number }>(
  rows: T[],
  key: (row: T) => string,
): T[] {
  const closest = new Map<string, T>();
  for (const row of rows) {
    const id = key(row);
    const current = closest.get(id);
    if (!current || row.distanceM < current.distanceM) closest.set(id, row);
  }
  return [...closest.values()].sort((a, b) => a.distanceM - b.distanceM);
}

export function coverage(
  sourceLoaded: boolean,
  itemCount: number,
  source: string,
  method: string,
  extra: Record<string, unknown> = {},
) {
  return {
    state: sourceLoaded ? ("available" as const) : ("unavailable" as const),
    itemCount,
    source,
    method,
    ...extra,
    ...(!sourceLoaded ? { reason: `${source} source data is not loaded` } : {}),
  };
}
