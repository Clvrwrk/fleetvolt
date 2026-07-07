// Pure haversine + bbox spatial primitives (P12-04 fallback path).
//
// NO Convex imports — this module is pure math so it unit-tests fast and is
// reusable by both the Convex query layer (convex/lib/spatial.ts, haversine
// backend) and any downstream caller. It reimplements the PostGIS spatial
// primitives the app relies on (ST_DWithin / ST_Distance / ST_MakePoint) on a
// sphere.
//
// SPHERE vs SPHEROID NOTE (T-12-02d): haversine here uses a SPHERE
// (R = 6,371,000 m). PostGIS `geography` ST_Distance uses a SPHEROID (WGS84).
// The two differ by <~0.5% at corridor scale — well inside the P12-05 parity
// tolerance of 0.1 mi (161 m). Distances are therefore asserted within tolerance,
// never exact-equal.

export const EARTH_RADIUS_M = 6_371_000; // mean Earth radius (sphere)
const METERS_PER_DEG_LAT = 111_320; // ~length of 1° latitude in meters

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Bbox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two points in meters (haversine, sphere).
 * Equivalent to PostGIS ST_Distance(geography) within <~0.5% (see module note).
 */
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

/**
 * Axis-aligned bounding box around a point, expanded by radiusM in every
 * direction. Used as an indexed/scanned pre-filter before the exact haversine
 * refine (mirrors ST_DWithin's bbox short-circuit). Longitude delta widens by
 * 1/cos(lat) because meridians converge toward the poles.
 */
export function bboxAround(point: LatLng, radiusM: number): Bbox {
  const dLat = radiusM / METERS_PER_DEG_LAT;
  const cosLat = Math.cos(toRad(point.lat));
  // guard the pole singularity: never divide by ~0
  const dLng = radiusM / (METERS_PER_DEG_LAT * Math.max(cosLat, 1e-6));
  return {
    minLat: point.lat - dLat,
    minLng: point.lng - dLng,
    maxLat: point.lat + dLat,
    maxLng: point.lng + dLng,
  };
}

/** True if point lies inside (inclusive) the bounding box. */
export function bboxContains(bbox: Bbox, point: LatLng): boolean {
  return (
    point.lat >= bbox.minLat &&
    point.lat <= bbox.maxLat &&
    point.lng >= bbox.minLng &&
    point.lng <= bbox.maxLng
  );
}

export interface NearestResult<T> {
  point: T;
  distanceM: number;
}

export interface NearestOptions<T> {
  limit?: number;
  maxDistanceM?: number;
  filter?: (p: T) => boolean;
}

/**
 * Nearest-N of `points` to `origin`, ascending by distance. Reimplements
 * ST_DWithin + ST_Distance + ORDER BY distance:
 *   1. apply `filter` first (an in-index attribute filter like class8),
 *   2. bbox pre-filter via bboxAround(origin, maxDistanceM) when a radius is set,
 *   3. exact haversine refine + drop anything beyond maxDistanceM,
 *   4. sort ascending, then apply `limit`.
 * Each point must carry a `location: {lat,lng}`.
 */
export function nearestByHaversine<T extends { location: LatLng }>(
  points: T[],
  origin: LatLng,
  opts: NearestOptions<T> = {},
): Array<NearestResult<T>> {
  const { limit, maxDistanceM, filter } = opts;
  const bbox =
    maxDistanceM !== undefined ? bboxAround(origin, maxDistanceM) : undefined;

  const out: Array<NearestResult<T>> = [];
  for (const p of points) {
    if (filter && !filter(p)) continue;
    // coarse bbox reject before the (more expensive) trig refine
    if (bbox && !bboxContains(bbox, p.location)) continue;
    const distanceM = haversineMeters(origin, p.location);
    if (maxDistanceM !== undefined && distanceM > maxDistanceM) continue;
    out.push({ point: p, distanceM });
  }

  out.sort((a, b) => a.distanceM - b.distanceM);
  return limit !== undefined ? out.slice(0, limit) : out;
}

/**
 * Minimum haversine distance (meters) from `point` to a polyline defined by an
 * ordered array of vertices. Used for LINE data (highwaySegments / corridors /
 * nhfnSegments) where "nearest point on a polyline" is required — the geospatial
 * component is point-only, so lines stay on this hand-rolled path (T-12-02e).
 * Distance is approximated as the min over per-segment closest points using a
 * local equirectangular projection (accurate at corridor scale).
 */
export function distanceToPolylineM(point: LatLng, path: LatLng[]): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return haversineMeters(point, path[0]);

  const cosLat = Math.cos(toRad(point.lat));
  // project lat/lng into local meters (equirectangular) around `point`
  const proj = (p: LatLng): [number, number] => [
    (p.lng - point.lng) * METERS_PER_DEG_LAT * cosLat,
    (p.lat - point.lat) * METERS_PER_DEG_LAT,
  ];
  const [px, py] = [0, 0]; // point projects to origin

  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = proj(path[i]);
    const [bx, by] = proj(path[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const segLenSq = dx * dx + dy * dy;
    let t = segLenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / segLenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = Math.hypot(px - cx, py - cy);
    if (d < best) best = d;
  }
  return best;
}
