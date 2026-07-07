// FAF freight-out-of-port QUERIES (P12-03 / P12-10e / report freightContext
// P12-15f). These power the flagship query's "freight volume out of the port"
// context. Bounded by design: every read uses the by_orig_year index for a
// single (dmsOrig, year) so it never scans the whole freightOD table (the
// 32k-doc read limit that the unindexed upsert originally tripped).
//
// Units are explicit and NEVER conflated (Phase-7 PITFALLS #7):
//   tonsKtons = FAF thousand-tons (ktons); valueUSD = FAF millions USD.
import { v } from "convex/values";
import { query } from "../_generated/server";

const PORT_ZONE = "061"; // LA-Long Beach FAF zone (this ingest's origin)
const TRUCK_MODE = "1"; // FAF dms_mode: 1=truck

/**
 * freightContext: outbound freight summary for the port zone in a given year.
 * Returns totals (all modes + truck-only) plus the top destinations and
 * commodities by tonnage — the flagship "$X value / Y truck-ktons out of the
 * port" context. Reads only the (061, year) index partition.
 */
export const freightContext = query({
  args: {
    year: v.number(),
    dmsOrig: v.optional(v.string()),
    topN: v.optional(v.number()),
  },
  handler: async (ctx, { year, dmsOrig, topN }) => {
    const orig = dmsOrig ?? PORT_ZONE;
    const limit = topN ?? 10;

    const rows = await ctx.db
      .query("freightOD")
      .withIndex("by_orig_year", (q) => q.eq("dmsOrig", orig).eq("year", year))
      .collect();

    let totalKtons = 0;
    let totalValueUSD = 0;
    let truckKtons = 0;
    let truckValueUSD = 0;
    const byDest = new Map<string, number>();
    const byCommodity = new Map<string, number>();

    for (const r of rows) {
      const k = r.tonsKtons ?? 0;
      const val = r.valueUSD ?? 0;
      totalKtons += k;
      totalValueUSD += val;
      if (r.dmsMode === TRUCK_MODE) {
        truckKtons += k;
        truckValueUSD += val;
      }
      byDest.set(r.dmsDest, (byDest.get(r.dmsDest) ?? 0) + k);
      if (r.sctg2) byCommodity.set(r.sctg2, (byCommodity.get(r.sctg2) ?? 0) + k);
    }

    const top = (m: Map<string, number>) =>
      [...m.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([key, ktons]) => ({ key, ktons }));

    return {
      origin: orig,
      year,
      rowCount: rows.length,
      // explicit units — ktons = thousand tons, valueUSD = millions USD
      totalKtons,
      totalValueUSD,
      truckKtons,
      truckValueUSD,
      topDestinations: top(byDest),
      topCommodities: top(byCommodity),
      provenance: { source: "FAF5" as const, matchMethod: "FAF_region_join" },
    };
  },
});
