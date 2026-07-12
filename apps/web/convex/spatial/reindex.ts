/**
 * Rebuild the @convex-dev/geospatial index after remount / empty component state.
 *
 * Remounting the geospatial component (or registering it after it was missing)
 * leaves an empty index while chargers/carriers/parking/pois/ports rows remain
 * in the main tables. nearestPoints() then returns nothing until insertPoint
 * is called again for each row.
 *
 * Run via CLI (batched):
 *   npx convex run spatial/reindex:reindexTable '{"table":"chargers","cursor":null,"limit":100}'
 *   …repeat with returned continueCursor until done=true
 * Or one-shot scheduler kickoff:
 *   npx convex run spatial/reindex:reindexAll '{}'
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { insertPoint, removePoint, type PointTable } from "../lib/spatial";

// Convex's generated `internal` type omits references to the module currently
// being initialized. Runtime self-scheduling is valid, so isolate the narrow
// generated-type escape hatch here instead of spreading casts through handlers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const self = (internal as any)["spatial/reindex"];

const pointTable = v.union(
  v.literal("chargers"),
  v.literal("carriers"),
  v.literal("parking"),
  v.literal("pois"),
  v.literal("ports"),
);

function filterFieldsFor(
  table: PointTable,
  doc: Record<string, unknown>,
): Record<string, string | number | boolean> | undefined {
  if (table === "chargers") {
    return { class8: Boolean(doc.isClass8Capable) };
  }
  if (table === "carriers") {
    return { corridor: doc.corridorCity != null };
  }
  return undefined;
}

/**
 * Re-index one page of a point table. Idempotent: remove-then-insert so
 * re-runs don't leave duplicate keys if the component rejects overwrite.
 */
export const reindexTable = internalMutation({
  args: {
    table: pointTable,
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    table: pointTable,
    indexed: v.number(),
    skipped: v.number(),
    done: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 200);
    const page = await ctx.db
      .query(args.table)
      .paginate({ numItems: limit, cursor: args.cursor });

    let indexed = 0;
    let skipped = 0;

    for (const doc of page.page) {
      const location = (doc as { location?: { lat: number; lng: number } }).location;
      if (
        !location ||
        typeof location.lat !== "number" ||
        typeof location.lng !== "number" ||
        !Number.isFinite(location.lat) ||
        !Number.isFinite(location.lng)
      ) {
        skipped += 1;
        continue;
      }

      const id = doc._id;
      // Best-effort remove so remount/re-run stays idempotent.
      try {
        await removePoint(ctx, { table: args.table, id });
      } catch {
        // Key may not exist yet — fine.
      }

      await insertPoint(ctx, {
        table: args.table,
        id,
        location,
        filterFields: filterFieldsFor(args.table, doc as Record<string, unknown>),
      });
      indexed += 1;
    }

    return {
      table: args.table,
      indexed,
      skipped,
      done: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
    };
  },
});

/**
 * Kick off a full reindex of all point tables via the scheduler (chunked).
 * CLI only (internal): `npx convex run spatial/reindex:reindexAll '{}'`
 */
export const reindexAll = internalMutation({
  args: {},
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx) => {
    const tables: PointTable[] = ["chargers", "carriers", "parking", "pois", "ports"];
    let scheduled = 0;
    for (const table of tables) {
      await ctx.scheduler.runAfter(0, self.reindexTableContinue, {
        table,
        cursor: null,
      });
      scheduled += 1;
    }
    return { scheduled };
  },
});

/** Internal continuation — schedules the next page until done. */
export const reindexTableContinue = internalMutation({
  args: {
    table: pointTable,
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = (await ctx.runMutation(self.reindexTable, {
      table: args.table,
      cursor: args.cursor,
      limit: 100,
    })) as { done: boolean; continueCursor: string | null };
    if (!result.done && result.continueCursor) {
      await ctx.scheduler.runAfter(0, self.reindexTableContinue, {
        table: args.table,
        cursor: result.continueCursor,
      });
    }
    return null;
  },
});
