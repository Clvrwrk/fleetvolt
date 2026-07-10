// Single source of truth for "Class-8-capable chargers within radius of a point".
//
// WHY THIS EXISTS: the Class-8 charger gap — the Hunter's primary siting signal —
// was previously computed three independent ways with divergent fetch methods:
//   • report.ts (point-radius)          — nearest-N ANY-class → JS filter
//   • chargers/queries.ts class8Gap     — in-index `class8` filter (correct)
//   • caas/queries.ts getChargerGapByArea (zone aggregate) — nearest-N ANY-class → JS filter
// The nearest-N-then-filter paths UNDERCOUNT: if the N nearest chargers are all
// LD stalls, real Class-8 stations within radius fall outside the fetch window,
// so the same location could read "gap" (report) and "no gap" (class8Gap). This
// module is the ONE read primitive all three now delegate to.
//
// The DEFINITION of Class-8-capable is still set once at ingest
// (chargers/classify.ts:isClass8Capable → persisted doc.isClass8Capable + the
// in-index `class8` filterKey, chargers/mutations.ts). This module never
// re-derives it — it fetches via that in-index filter (budget-safe, never
// undercounts) and re-checks the persisted flag as defense in depth against a
// drifted index row. Callers layer their spatial scope (single point, corridor
// union, zone set) on top of this one primitive.
import type { QueryCtx } from "../_generated/server";
import { nearestPoints } from "../lib/spatial";

export interface ChargerConfigRow {
  stationId: string;
  name: string | null;
  /** Required for workbench map pins — without lat/lng the canvas cannot place markers. */
  location: { lat: number; lng: number } | null;
  powerKw: number;
  maxVehicleClass: "LD" | "MD" | "HD" | null;
  connectorTypes: string[];
  evDcFastNum: number | null;
  isClass8Capable: boolean;
  operator: string | null;
  distanceM: number;
}

type ChargerDocLike = {
  stationId: string;
  name?: string | null;
  location?: { lat: number; lng: number } | null;
  powerKw: number;
  maxVehicleClass?: "LD" | "MD" | "HD" | null;
  connectorTypes: string[];
  evDcFastNum?: number | null;
  isClass8Capable: boolean;
  operator?: string | null;
};

/** Shape a charger doc into the flagship "config row" (5-closest / class8 lists). */
export function toConfigRow(doc: ChargerDocLike, distanceM: number): ChargerConfigRow {
  return {
    stationId: doc.stationId,
    name: doc.name ?? null,
    location: doc.location ?? null,
    powerKw: doc.powerKw,
    maxVehicleClass: doc.maxVehicleClass ?? null,
    connectorTypes: doc.connectorTypes,
    evDcFastNum: doc.evDcFastNum ?? null,
    isClass8Capable: doc.isClass8Capable,
    operator: doc.operator ?? null,
    distanceM,
  };
}

/**
 * Canonical read-side predicate — defense-in-depth on the persisted flag so a
 * drifted in-index `class8` row can never inflate a gap count.
 */
export function isClass8Doc(doc: { isClass8Capable?: boolean }): boolean {
  return doc.isClass8Capable === true;
}

export interface Class8WithinRadius {
  chargers: ChargerConfigRow[];
  count: number;
  closestDistanceM: number | null;
}

/**
 * THE single Class-8-within-radius read. Uses the in-index `class8` filterKey so
 * the gap is never inflated NOR undercounted (a nearest-N ANY-class fetch + JS
 * filter can miss Class-8 stations sitting beyond the N nearest LD stalls — the
 * bug that let report.ts and caas disagree with class8Gap). Rows ascending by
 * distance. `limit` bounds the read budget; the default (64) matches the report.
 */
export async function class8WithinRadius(
  ctx: QueryCtx,
  args: { point: { lat: number; lng: number }; radiusM: number; limit?: number },
): Promise<Class8WithinRadius> {
  const hits = await nearestPoints(ctx, {
    table: "chargers",
    point: args.point,
    maxDistanceM: args.radiusM,
    // In-index `class8` filter — no JS-filter over-fetch, no undercount (T-12-04b).
    limit: args.limit ?? 64,
    filterEq: { field: "class8", value: true },
  });
  const chargers = hits
    .filter(({ doc }) => isClass8Doc(doc))
    .map(({ doc, distanceM }) => toConfigRow(doc, distanceM))
    .sort((a, b) => a.distanceM - b.distanceM);
  return {
    chargers,
    count: chargers.length,
    closestDistanceM: chargers.length > 0 ? chargers[0]!.distanceM : null,
  };
}
