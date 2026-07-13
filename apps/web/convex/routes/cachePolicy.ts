import type { RouteGeometryResult } from "../../src/lib/maps/google-routes";

export const PTV_ROUTE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const PTV_REFRESH_LEASE_MS = 2 * 60 * 1000;
export const MIN_ROAD_ROUTE_POINTS = 8;

export type RouteCachePolicyRecord = {
  coordinates: Array<{ latitude: number; longitude: number }>;
  expiresAt: number;
  refreshLeaseUntil?: number;
};

export type RouteCacheDisposition =
  | "fresh"
  | "refresh-owner"
  | "stale-refreshing";

export function hasUsableRoadGeometry(
  value:
    | Pick<RouteGeometryResult, "coordinates">
    | RouteCachePolicyRecord
    | null
    | undefined,
): boolean {
  return Boolean(value && value.coordinates.length >= MIN_ROAD_ROUTE_POINTS);
}

export function cacheDisposition(
  record: RouteCachePolicyRecord | null,
  now: number,
): RouteCacheDisposition {
  if (!record) return "refresh-owner";
  if (hasUsableRoadGeometry(record) && record.expiresAt > now) return "fresh";
  if (
    record.refreshLeaseUntil !== undefined &&
    record.refreshLeaseUntil > now
  ) {
    return "stale-refreshing";
  }
  return "refresh-owner";
}

export function cacheAgeDays(pulledAt: number, now: number): number {
  return Math.max(0, Math.floor((now - pulledAt) / (24 * 60 * 60 * 1000)));
}
