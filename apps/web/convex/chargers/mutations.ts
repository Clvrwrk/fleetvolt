// Charger ingest mutations (P12-07) — batched, idempotent internalMutations
// that upsert AFDC chargers by stationId AND spatial-index each row at write
// time (12-02 spatial.insertPoint) so nearestChargers()/class8Gap() are
// immediately queryable. Called from chargers/ingest.ts (the fetch action),
// which chunks the classified rows to ≤500/call (stays under the 1s mutation
// cap + 5MiB arg limit — the full CA dc_fast set is ~2,867 rows / ~12MB
// mapped, ~2.9MB per 500-row batch).
//
// Idempotency: upsert keyed by stationId (by_stationId index) — re-running the
// ingest patches existing rows, never duplicates. One fetchedAt is stamped by
// the action and threaded through every call.
//
// Provenance (P12-07): {source:"AFDC", year, fetchedAt, usefulnessScore,
// matchMethod:"api", method:"measured"} — the connector power is a MEASURED
// value from the AFDC feed, not modeled.
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { insertPoint } from "../lib/spatial";

const VEHICLE_CLASSES = new Set(["LD", "MD", "HD"]);

const chargerRow = v.object({
  stationId: v.string(),
  name: v.optional(v.union(v.string(), v.null())),
  location: v.object({ lat: v.number(), lng: v.number() }),
  powerKw: v.number(),
  connectorTypes: v.array(v.string()),
  operator: v.optional(v.union(v.string(), v.null())),
  accessCode: v.optional(v.union(v.string(), v.null())),
  statusCode: v.optional(v.union(v.string(), v.null())),
  maxVehicleClass: v.optional(v.union(v.string(), v.null())),
  evDcFastNum: v.optional(v.union(v.number(), v.null())),
  isClass8Capable: v.boolean(),
  isMcsCapable: v.optional(v.boolean()),
  dateLastConfirmed: v.optional(v.union(v.string(), v.null())),
  connectors: v.optional(v.any()),
});

export const upsertChargerBatch = internalMutation({
  args: {
    rows: v.array(chargerRow),
    fetchedAt: v.number(),
    year: v.number(),
    usefulnessScore: v.number(),
  },
  handler: async (ctx, { rows, fetchedAt, year, usefulnessScore }) => {
    let inserted = 0;
    let patched = 0;
    let class8 = 0;

    for (const r of rows) {
      if (r.isClass8Capable) class8 += 1;

      // maxVehicleClass column is a strict LD/MD/HD union — coerce anything
      // else (or null) to undefined so the schema validator accepts the row.
      const maxVehicleClass =
        r.maxVehicleClass && VEHICLE_CLASSES.has(r.maxVehicleClass)
          ? (r.maxVehicleClass as "LD" | "MD" | "HD")
          : undefined;

      const doc = {
        stationId: r.stationId,
        name: r.name ?? undefined,
        location: r.location,
        powerKw: r.powerKw,
        connectorTypes: r.connectorTypes,
        operator: r.operator ?? undefined,
        accessCode: r.accessCode ?? undefined,
        statusCode: r.statusCode ?? undefined,
        maxVehicleClass,
        evDcFastNum: r.evDcFastNum ?? undefined,
        isClass8Capable: r.isClass8Capable,
        isMcsCapable: r.isMcsCapable,
        dateLastConfirmed: r.dateLastConfirmed ?? undefined,
        connectors: r.connectors,
        provenance: {
          source: "AFDC" as const,
          year,
          fetchedAt,
          usefulnessScore,
          matchMethod: "api",
          method: "measured" as const,
        },
      };

      // Fully-selective upsert on the by_stationId index (reads at most one row).
      const existing = await ctx.db
        .query("chargers")
        .withIndex("by_stationId", (q) => q.eq("stationId", r.stationId))
        .unique();

      let id;
      if (existing) {
        await ctx.db.patch(existing._id, doc);
        id = existing._id;
        patched += 1;
      } else {
        id = await ctx.db.insert("chargers", doc);
        inserted += 1;
      }

      // Spatial-index the row at write time (12-02). No-op on the haversine
      // backend (it scans the table's own rows at query time). filterFields
      // {class8} enables the in-index Class-8 filter for nearestClass8.
      await insertPoint(ctx, {
        table: "chargers",
        id,
        location: r.location,
        filterFields: { class8: r.isClass8Capable },
      });
    }

    return { inserted, patched, class8, total: rows.length };
  },
});
