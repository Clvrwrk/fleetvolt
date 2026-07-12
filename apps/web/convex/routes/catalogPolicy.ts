export type CatalogEndpoint = {
  label: string;
  latitude: number;
  longitude: number;
};

export type RecentRouteCandidate<T extends CatalogEndpoint = CatalogEndpoint> = {
  origin: T;
  destination: T;
  requestHash?: string;
  createdAt: number;
};

export type RouteManifest = {
  road: string;
  traffic: string;
  charge: string;
  stale: boolean;
};

function endpointKey(endpoint: CatalogEndpoint): string {
  return `${endpoint.latitude.toFixed(5)},${endpoint.longitude.toFixed(5)}`;
}

/** Route identity is directional: A→B and B→A are separate planning records. */
export function directionalRouteKey(
  origin: CatalogEndpoint,
  destination: CatalogEndpoint,
): string {
  return `${endpointKey(origin)}>${endpointKey(destination)}`;
}

/** Input is newest-first; preserve the newest usable occurrence per direction. */
export function dedupeRecentRoutes<T extends RecentRouteCandidate>(
  candidates: T[],
  limit = 8,
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const candidate of candidates) {
    if (!candidate.requestHash) continue;
    const key = directionalRouteKey(candidate.origin, candidate.destination);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
    if (result.length >= limit) break;
  }
  return result;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nestedRecord(value: unknown, key: string): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const child = (value as Record<string, unknown>)[key];
  return child && typeof child === "object"
    ? (child as Record<string, unknown>)
    : {};
}

function compact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function buildRouteManifest(args: {
  distanceMeters?: number;
  enrichmentSnapshot?: unknown;
  enrichmentExpiresAt?: number;
  now: number;
}): RouteManifest {
  const miles = finiteNumber(args.distanceMeters);
  const snapshot =
    args.enrichmentSnapshot && typeof args.enrichmentSnapshot === "object"
      ? (args.enrichmentSnapshot as Record<string, unknown>)
      : {};
  const traffic = nestedRecord(snapshot, "traffic");
  const trafficStats = nestedRecord(traffic, "statistics");
  const chargers = nestedRecord(snapshot, "chargers");

  const p90 =
    finiteNumber(trafficStats.p90) ??
    finiteNumber(traffic.p90) ??
    finiteNumber(traffic.dailyTruckTraffic);
  const class8 =
    finiteNumber(chargers.class8WithinCorridor) ??
    finiteNumber(chargers.class8Count) ??
    finiteNumber(chargers.class8CapableCount) ??
    finiteNumber(chargers.class8);

  return {
    road: miles === null ? "Not ready" : `${Math.round(miles / 1609.344)} mi`,
    traffic: p90 === null ? "Not loaded" : `p90 ${compact(p90)}`,
    charge: class8 === null ? "Not loaded" : `${class8} Class 8`,
    stale:
      typeof args.enrichmentExpiresAt === "number" &&
      args.enrichmentExpiresAt <= args.now,
  };
}
