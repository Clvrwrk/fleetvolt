/** Client-side route proximity helpers for on-route vs detour labeling. */

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;
const METERS_PER_DEG_LAT = 111_320;
const METERS_PER_MILE = 1609.344;

/** Within this distance of the route polyline counts as on-route. */
export const ON_ROUTE_MAX_M = 800;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type NearestOnPolyline = {
  point: LatLng;
  distanceM: number;
  /** Segment index (0 = first edge). */
  segmentIndex: number;
};

/**
 * Closest point on a polyline to `point` (equirectangular local projection).
 * Used for detour egress/rejoin stubs off the main A→B corridor.
 */
export function nearestPointOnPolyline(
  point: LatLng,
  path: LatLng[],
): NearestOnPolyline | null {
  if (path.length === 0) return null;
  if (path.length === 1) {
    return {
      point: path[0]!,
      distanceM: haversineMeters(point, path[0]!),
      segmentIndex: 0,
    };
  }

  const cosLat = Math.cos(toRad(point.lat));
  const toLocal = (p: LatLng): [number, number] => [
    (p.lng - point.lng) * METERS_PER_DEG_LAT * cosLat,
    (p.lat - point.lat) * METERS_PER_DEG_LAT,
  ];
  const fromLocal = (x: number, y: number): LatLng => ({
    lat: point.lat + y / METERS_PER_DEG_LAT,
    lng: point.lng + x / (METERS_PER_DEG_LAT * Math.max(cosLat, 1e-6)),
  });

  let bestDist = Number.POSITIVE_INFINITY;
  let bestPoint: LatLng = path[0]!;
  let bestSeg = 0;

  for (let i = 0; i < path.length - 1; i += 1) {
    const [ax, ay] = toLocal(path[i]!);
    const [bx, by] = toLocal(path[i + 1]!);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (-ax * dx + -ay * dy) / len2));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const dist = Math.hypot(cx, cy);
    if (dist < bestDist) {
      bestDist = dist;
      bestPoint = fromLocal(cx, cy);
      bestSeg = i;
    }
  }

  return { point: bestPoint, distanceM: bestDist, segmentIndex: bestSeg };
}

/** Minimum distance from a point to a polyline (equirectangular local projection). */
export function distanceToPolylineM(point: LatLng, path: LatLng[]): number {
  return nearestPointOnPolyline(point, path)?.distanceM ?? Number.POSITIVE_INFINITY;
}

export type RouteProximity = {
  distanceM: number;
  distanceMiles: number;
  onRoute: boolean;
  /** Driver-facing label, e.g. "ON ROUTE" or "DETOUR 5 mi off route". */
  label: string;
};

export function assessRouteProximity(
  point: LatLng,
  routePath: LatLng[],
  onRouteMaxM = ON_ROUTE_MAX_M,
): RouteProximity {
  const distanceM = distanceToPolylineM(point, routePath);
  const distanceMiles = distanceM / METERS_PER_MILE;
  const onRoute = Number.isFinite(distanceM) && distanceM <= onRouteMaxM;

  if (!Number.isFinite(distanceM)) {
    return {
      distanceM: Number.POSITIVE_INFINITY,
      distanceMiles: Number.POSITIVE_INFINITY,
      onRoute: false,
      label: "ROUTE DISTANCE UNAVAILABLE",
    };
  }

  if (onRoute) {
    return {
      distanceM,
      distanceMiles,
      onRoute: true,
      label: "ON ROUTE",
    };
  }

  const milesLabel =
    distanceMiles < 10
      ? `${distanceMiles.toFixed(1)} mi`
      : `${Math.round(distanceMiles)} mi`;

  return {
    distanceM,
    distanceMiles,
    onRoute: false,
    label: `DETOUR ${milesLabel} off route`,
  };
}
