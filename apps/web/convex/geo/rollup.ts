// Geo rollup (P12-13) — aggregate the MODELED hotspot scores up the
// US -> State -> County hierarchy into geoRegions.aggregateScore so the map can
// render three zoom levels without recomputing per pan (T-12-08b).
//
// ASSIGNMENT (T-12-08f): each kind:"modeledDwell" hotspot is assigned to the
// county whose bbox contains its location; ties / bbox-overlap resolved by the
// nearest county centroid. Counties without geometry here (only the 3 corridor
// counties carry bbox/centroid from prep_geo_regions.py) simply receive no
// hotspots — honest: we do not guess a county we cannot place. The county score
// is the MEAN of its assigned hotspot scores (a demand intensity, not a sum, so
// a county with many low hotspots does not out-rank one dense hotspot); state =
// mean of its counties' scores; nation = mean of states' scores. All sums/means
// are computed from persisted rows only — nothing fabricated.
import { internalMutation } from "../_generated/server";

interface LatLng {
  lat: number;
  lng: number;
}
interface Bbox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

function bboxContains(b: Bbox, p: LatLng): boolean {
  return (
    p.lat >= b.minLat && p.lat <= b.maxLat && p.lng >= b.minLng && p.lng <= b.maxLng
  );
}

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function mean(xs: number[]): number | undefined {
  if (xs.length === 0) return undefined;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export const rollupScores = internalMutation({
  args: {},
  handler: async (ctx) => {
    const regions = await ctx.db.query("geoRegions").collect();
    const counties = regions.filter((r) => r.level === "county");
    const states = regions.filter((r) => r.level === "state");
    const nations = regions.filter((r) => r.level === "nation");

    const hotspots = await ctx.db
      .query("hotspots")
      .withIndex("by_kind", (q) => q.eq("kind", "modeledDwell"))
      .collect();

    // 1. Assign each hotspot to a county (bbox containment, then nearest centroid).
    const countyScores = new Map<string, number[]>();
    let assigned = 0;
    let unassigned = 0;
    for (const h of hotspots) {
      if (typeof h.score !== "number") continue;
      const loc = h.location;
      const containing = counties.filter((c) => c.bbox && bboxContains(c.bbox, loc));
      let chosen: (typeof counties)[number] | undefined;
      if (containing.length === 1) {
        chosen = containing[0];
      } else if (containing.length > 1) {
        // overlap → nearest centroid wins
        chosen = containing
          .filter((c) => c.centroid)
          .sort(
            (a, b) => haversineM(a.centroid!, loc) - haversineM(b.centroid!, loc),
          )[0];
      }
      if (!chosen) {
        unassigned += 1;
        continue;
      }
      const arr = countyScores.get(chosen.fips) ?? [];
      arr.push(h.score);
      countyScores.set(chosen.fips, arr);
      assigned += 1;
    }

    // 2. Patch county aggregateScore = mean of assigned hotspot scores.
    const countyAgg = new Map<string, number>();
    for (const c of counties) {
      const scores = countyScores.get(c.fips);
      const agg = mean(scores ?? []);
      countyAgg.set(c.fips, agg ?? 0);
      await ctx.db.patch(c._id, { aggregateScore: agg });
    }

    // 3. State aggregateScore = mean of its counties' aggregateScores (that have any).
    const stateAgg = new Map<string, number>();
    for (const s of states) {
      const childScores = counties
        .filter((c) => c.parentFips === s.fips && (countyScores.get(c.fips)?.length ?? 0) > 0)
        .map((c) => countyAgg.get(c.fips)!)
        .filter((x): x is number => typeof x === "number");
      const agg = mean(childScores);
      if (typeof agg === "number") stateAgg.set(s.fips, agg);
      await ctx.db.patch(s._id, { aggregateScore: agg });
    }

    // 4. Nation aggregateScore = mean of its states' aggregateScores.
    for (const n of nations) {
      const childScores = states
        .filter((s) => s.parentFips === n.fips && stateAgg.has(s.fips))
        .map((s) => stateAgg.get(s.fips)!);
      await ctx.db.patch(n._id, { aggregateScore: mean(childScores) });
    }

    const result = {
      hotspots: hotspots.length,
      assigned,
      unassigned,
      countiesScored: [...countyScores.keys()].length,
      corridorCounties: ["06037", "06065", "06071"].map((fips) => ({
        fips,
        aggregateScore: countyAgg.get(fips) ?? null,
        hotspotCount: countyScores.get(fips)?.length ?? 0,
      })),
    };
    console.log("geo/rollup:rollupScores", JSON.stringify(result));
    return result;
  },
});
