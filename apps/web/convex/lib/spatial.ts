// The INTERNAL spatial module (P12-04 / RESEARCH §1).
//
// This is the ONLY module downstream code (12-04 charger gap, 12-06 corridor,
// 12-08 report) imports for spatial operations. Callers never touch
// @convex-dev/geospatial directly, so the backend can swap to the pure
// haversine fallback (convex/lib/haversine.ts) without changing a single query
// (T-12-02a).
//
// CLEAN SPLIT (RESEARCH §1, T-12-02e):
//   • POINT data (chargers, carriers, parking, pois, ports) → nearestPoints /
//     pointsInRectangle, backed by the geospatial component OR haversine.
//   • LINE data (highwaySegments, corridors, nhfnSegments) → segmentsNearPoint /
//     segmentsInBbox, haversine-ONLY (bbox pre-filter + point-to-polyline),
//     because the component is point-only.
//
// BACKEND SWAP: FV_SPATIAL_BACKEND selects "component" (default) or "haversine".
// Every export returns the SAME shape regardless of backend, so callers are
// backend-agnostic. The P12-05 parity test MUST pass on BOTH backends — the
// swap is the availability safety net if the Beta component bites.
import { GeospatialIndex } from "@convex-dev/geospatial";
import { components } from "../_generated/api";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import {
  nearestByHaversine,
  bboxContains,
  distanceToPolylineM,
  type LatLng,
  type Bbox,
} from "./haversine";

export type SpatialBackend = "component" | "haversine";
export const SPATIAL_BACKEND: SpatialBackend =
  (process.env.FV_SPATIAL_BACKEND as SpatialBackend | undefined) ?? "component";

// POINT tables carry a location{lat,lng}. LINE tables carry bbox + path.
export type PointTable = "chargers" | "carriers" | "parking" | "pois" | "ports";
export type LineTable = "highwaySegments" | "corridors" | "nhfnSegments";

// The shared geospatial index. Keys are the Convex doc _id (string); the
// filterKey `table` namespaces the shared index per point table so a nearest()
// over "chargers" never returns a "parking" row. Extra filterKeys (e.g.
// {isClass8Capable}) enable in-index attribute filtering (the ST_DWithin +
// WHERE class8 equivalent).
type GeoFilters = Record<string, string | number | boolean>;
let _index: GeospatialIndex<string, GeoFilters> | null = null;
function geoIndex(): GeospatialIndex<string, GeoFilters> {
  if (!_index) {
    // components.geospatial is generated once convex.config.ts registers it.
    _index = new GeospatialIndex((components as any).geospatial);
  }
  return _index;
}

// ── Index maintenance (called by 12-04's ingest) ──────────────────────────────

/**
 * Register/update a point in the spatial index. component backend inserts into
 * the geospatial index keyed by the doc _id (with filterFields like
 * {isClass8Capable}); haversine backend is a no-op (the fallback scans the
 * table's own rows at query time).
 */
export async function insertPoint(
  ctx: MutationCtx,
  args: {
    table: PointTable;
    id: Id<PointTable>;
    location: LatLng;
    filterFields?: GeoFilters;
  },
): Promise<void> {
  if (SPATIAL_BACKEND !== "component") return; // haversine: no index to maintain
  await geoIndex().insert(
    ctx,
    args.id as string,
    { latitude: args.location.lat, longitude: args.location.lng },
    { table: args.table, ...(args.filterFields ?? {}) },
  );
}

/** Remove a point from the spatial index (component backend only). */
export async function removePoint(
  ctx: MutationCtx,
  args: { table: PointTable; id: Id<PointTable> },
): Promise<void> {
  if (SPATIAL_BACKEND !== "component") return;
  await geoIndex().remove(ctx, args.id as string);
}

// ── Point queries (component OR haversine) ────────────────────────────────────

export interface NearestPointArgs<T extends PointTable> {
  table: T;
  point: LatLng;
  limit?: number;
  maxDistanceM?: number;
  /** JS predicate (haversine backend + component post-filter). */
  filter?: (doc: Doc<T>) => boolean;
  /** Optional in-index eq filter for the component backend (e.g. class8). */
  filterEq?: { field: string; value: string | number | boolean };
}

export interface NearestPointResult<T extends PointTable> {
  doc: Doc<T>;
  distanceM: number;
}

/**
 * Nearest points to `point` within `maxDistanceM`, ascending by distance —
 * the ST_DWithin + ST_Distance + ORDER BY distance replacement. Returns the
 * SAME shape on both backends.
 */
export async function nearestPoints<T extends PointTable>(
  ctx: QueryCtx,
  args: NearestPointArgs<T>,
): Promise<Array<NearestPointResult<T>>> {
  const { table, point, limit, maxDistanceM, filter, filterEq } = args;

  if (SPATIAL_BACKEND === "component") {
    // Over-fetch only when a JS post-filter is present AND we lack an in-index
    // filterEq. With filterEq (e.g. class8), the index already narrows results —
    // multiplying limit×5 was blowing the 32k document-read cap on corridor scans.
    const fetchLimit =
      filter && !filterEq ? (limit ?? 64) * 2 : (limit ?? 64);
    const hits = await geoIndex().nearest(ctx, {
      point: { latitude: point.lat, longitude: point.lng },
      limit: fetchLimit,
      maxDistance: maxDistanceM,
      filter: (q) => {
        let b = q.eq("table", table);
        if (filterEq) b = b.eq(filterEq.field, filterEq.value);
        return b;
      },
    });
    const out: Array<NearestPointResult<T>> = [];
    for (const hit of hits) {
      const doc = await ctx.db.get(hit.key as Id<T>);
      if (!doc) continue;
      if (filter && !filter(doc)) continue;
      out.push({ doc, distanceM: hit.distance });
      if (limit !== undefined && out.length >= limit) break;
    }
    return out;
  }

  // haversine backend: scan the table's own rows + refine.
  const rows = await ctx.db.query(table as TableNames).collect();
  const candidates = (rows as unknown as Array<Doc<T>>).filter(
    (d) => (d as { location?: LatLng }).location !== undefined,
  );
  const results = nearestByHaversine(
    candidates as Array<Doc<T> & { location: LatLng }>,
    point,
    { limit, maxDistanceM, filter },
  );
  return results.map((r) => ({ doc: r.point as Doc<T>, distanceM: r.distanceM }));
}

/**
 * Points inside an axis-aligned rectangle — the ST_MakeEnvelope / bbox region
 * replacement. Returns docs in no particular order.
 */
export async function pointsInRectangle<T extends PointTable>(
  ctx: QueryCtx,
  args: { table: T; bbox: Bbox; filter?: (doc: Doc<T>) => boolean },
): Promise<Array<Doc<T>>> {
  const { table, bbox, filter } = args;

  if (SPATIAL_BACKEND === "component") {
    const res = await geoIndex().query(ctx, {
      shape: {
        type: "rectangle",
        rectangle: {
          west: bbox.minLng,
          east: bbox.maxLng,
          south: bbox.minLat,
          north: bbox.maxLat,
        },
      },
      filter: (q) => q.eq("table", table),
    });
    const out: Array<Doc<T>> = [];
    for (const hit of res.results) {
      const doc = await ctx.db.get(hit.key as Id<T>);
      if (!doc) continue;
      if (filter && !filter(doc)) continue;
      out.push(doc);
    }
    return out;
  }

  const rows = await ctx.db.query(table as TableNames).collect();
  return (rows as unknown as Array<Doc<T>>).filter((d) => {
    const loc = (d as { location?: LatLng }).location;
    if (!loc || !bboxContains(bbox, loc)) return false;
    return filter ? filter(d) : true;
  });
}

// ── Line queries (haversine-ONLY: bbox pre-filter + point-to-polyline) ────────

function bboxesIntersect(a: Bbox, b: Bbox): boolean {
  return !(
    a.maxLat < b.minLat ||
    a.minLat > b.maxLat ||
    a.maxLng < b.minLng ||
    a.minLng > b.maxLng
  );
}

export interface SegmentNearResult<T extends LineTable> {
  doc: Doc<T>;
  distanceM: number;
}

/**
 * Segments (polylines) within `maxDistanceM` of `point`, ascending by the
 * minimum point-to-polyline distance. Uses the table's bbox to pre-filter
 * (expanded by the radius) before the exact per-vertex refine. LINE-ONLY.
 */
export async function segmentsNearPoint<T extends LineTable>(
  ctx: QueryCtx,
  args: { table: T; point: LatLng; maxDistanceM: number },
): Promise<Array<SegmentNearResult<T>>> {
  const { table, point, maxDistanceM } = args;
  // query bbox = point expanded by radius (degree deltas)
  const dLat = maxDistanceM / 111_320;
  const dLng = maxDistanceM / (111_320 * Math.max(Math.cos((point.lat * Math.PI) / 180), 1e-6));
  const queryBbox: Bbox = {
    minLat: point.lat - dLat,
    minLng: point.lng - dLng,
    maxLat: point.lat + dLat,
    maxLng: point.lng + dLng,
  };

  const rows = await ctx.db.query(table as TableNames).collect();
  const out: Array<SegmentNearResult<T>> = [];
  for (const doc of rows as unknown as Array<Doc<T>>) {
    const segBbox = (doc as { bbox?: Bbox }).bbox;
    const path = (doc as { path?: LatLng[] }).path;
    if (!segBbox || !path) continue;
    if (!bboxesIntersect(queryBbox, segBbox)) continue; // coarse reject
    const distanceM = distanceToPolylineM(point, path);
    if (distanceM > maxDistanceM) continue;
    out.push({ doc, distanceM });
  }
  out.sort((a, b) => a.distanceM - b.distanceM);
  return out;
}

/** Segments whose bbox intersects the query rectangle. LINE-ONLY. */
export async function segmentsInBbox<T extends LineTable>(
  ctx: QueryCtx,
  args: { table: T; bbox: Bbox },
): Promise<Array<Doc<T>>> {
  const { table, bbox } = args;
  const rows = await ctx.db.query(table as TableNames).collect();
  return (rows as unknown as Array<Doc<T>>).filter((doc) => {
    const segBbox = (doc as { bbox?: Bbox }).bbox;
    return segBbox ? bboxesIntersect(bbox, segBbox) : false;
  });
}
