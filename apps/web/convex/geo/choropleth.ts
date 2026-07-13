/**
 * CaaS choropleth: air districts (aggregated counties) + counties.
 * Fill opacity capped at 50% so basemap always remains visible.
 * Zip polygons are deferred — zip lists surface in region popups.
 */
import { v } from "convex/values";
import { query } from "../_generated/server";

const MAX_FILL = 0.5;

type TrafficTier = "low" | "medium" | "heavy";

/** Absolute fallback when fewer than 3 scored regions exist. */
function tierFromScoreAbsolute(score: number | null | undefined): TrafficTier {
  if (typeof score !== "number") return "low";
  if (score >= 0.75) return "heavy";
  if (score >= 0.45) return "medium";
  return "low";
}

/**
 * Percentile tiers so CA choropleth always shows a R/Y/G mix when scores cluster high.
 * Top third → heavy, middle → medium, bottom → low.
 */
function tierFromPercentile(
  score: number | null | undefined,
  sortedScores: number[],
): TrafficTier {
  if (typeof score !== "number" || sortedScores.length === 0) return "low";
  if (sortedScores.length < 3) return tierFromScoreAbsolute(score);
  const rank = sortedScores.filter((s) => s <= score).length / sortedScores.length;
  if (rank >= 2 / 3) return "heavy";
  if (rank >= 1 / 3) return "medium";
  return "low";
}

function collectScores(
  rows: Array<{ aggregateScore?: number | null }>,
): number[] {
  return rows
    .map((r) => r.aggregateScore)
    .filter((s): s is number => typeof s === "number")
    .sort((a, b) => a - b);
}

function colorForTier(tier: TrafficTier): string {
  if (tier === "heavy") return "#c0392b";
  if (tier === "medium") return "#d4a017";
  return "#3f9b6b";
}

/** Opacity scales with score but never exceeds 50%. */
function fillOpacityForScore(score: number | null | undefined): number {
  if (typeof score !== "number") return 0.18;
  return Math.min(MAX_FILL, 0.18 + score * 0.32);
}

const regionValidator = v.object({
  id: v.string(),
  name: v.string(),
  level: v.union(
    v.literal("air-district"),
    v.literal("county"),
    v.literal("zip"),
  ),
  fips: v.optional(v.string()),
  airDistrict: v.optional(v.string()),
  centroid: v.optional(v.object({ lat: v.number(), lng: v.number() })),
  bbox: v.optional(
    v.object({
      minLat: v.number(),
      minLng: v.number(),
      maxLat: v.number(),
      maxLng: v.number(),
    }),
  ),
  score: v.optional(v.number()),
  tier: v.union(v.literal("low"), v.literal("medium"), v.literal("heavy")),
  color: v.string(),
  fillOpacity: v.number(),
  countyCount: v.optional(v.number()),
  zipCodes: v.optional(v.array(v.string())),
  ring: v.optional(v.array(v.object({ lat: v.number(), lng: v.number() }))),
  rings: v.optional(
    v.array(v.array(v.object({ lat: v.number(), lng: v.number() }))),
  ),
});

export const listCaasChoropleth = query({
  args: {
    level: v.union(
      v.literal("air-district"),
      v.literal("county"),
      v.literal("zip"),
    ),
  },
  returns: v.object({
    level: v.string(),
    regions: v.array(regionValidator),
    note: v.string(),
  }),
  handler: async (ctx, { level }) => {
    const counties = await ctx.db
      .query("geoRegions")
      .withIndex("by_level", (q) => q.eq("level", "county"))
      .collect();

    // Prefer California counties (FIPS 06xxx).
    const caCounties = counties.filter((c) => c.fips.startsWith("06"));

    if (level === "county") {
      const sortedScores = collectScores(caCounties);
      const regions = caCounties.map((c) => {
        const score = c.aggregateScore ?? null;
        const tier = tierFromPercentile(score, sortedScores);
        return {
          id: c.fips,
          name: c.name,
          level: "county" as const,
          fips: c.fips,
          ...(c.airDistrict ? { airDistrict: c.airDistrict } : {}),
          ...(c.centroid
            ? { centroid: { lat: c.centroid.lat, lng: c.centroid.lng } }
            : {}),
          ...(c.bbox ? { bbox: c.bbox } : {}),
          ...(c.rings?.length ? { rings: c.rings } : {}),
          ...(typeof score === "number" ? { score } : {}),
          tier,
          color: colorForTier(tier),
          fillOpacity: fillOpacityForScore(score),
          ...(c.zipCodes?.length ? { zipCodes: c.zipCodes.slice(0, 40) } : {}),
        };
      });
      return {
        level,
        regions,
        note: "County choropleth — percentile R/Y/G tiers from aggregateScore. Fill opacity ≤50%.",
      };
    }

    if (level === "zip") {
      const zctas = await ctx.db.query("geoZcta").collect();
      if (zctas.length === 0) {
        // Fallback: county zip-code lists as centroids until ZCTA ingest runs.
        const sortedScores = collectScores(caCounties);
        const regions = caCounties.flatMap((c) => {
          const zips = c.zipCodes ?? [];
          if (zips.length === 0 || !c.centroid) return [];
          const score = c.aggregateScore ?? null;
          const tier = tierFromPercentile(score, sortedScores);
          return zips.slice(0, 8).map((zip) => ({
            id: `zip-${zip}`,
            name: `ZIP ${zip}`,
            level: "zip" as const,
            fips: c.fips,
            ...(c.airDistrict ? { airDistrict: c.airDistrict } : {}),
            centroid: { lat: c.centroid!.lat, lng: c.centroid!.lng },
            ...(c.bbox ? { bbox: c.bbox } : {}),
            ...(typeof score === "number" ? { score } : {}),
            tier,
            color: colorForTier(tier),
            fillOpacity: Math.min(0.35, fillOpacityForScore(score)),
            zipCodes: [zip],
          }));
        });
        return {
          level,
          regions,
          note:
            "ZIP fallback markers — run `node scripts/zcta_load.mjs` to load California Geoportal ZIP polygons. Fill ≤50%.",
        };
      }
      const sortedScores = collectScores(zctas);
      const regions = zctas.map((z) => {
        const score = z.aggregateScore ?? null;
        const tier = tierFromPercentile(score, sortedScores);
        return {
          id: `zip-${z.zcta}`,
          name: z.name,
          level: "zip" as const,
          ...(z.countyFips ? { fips: z.countyFips } : {}),
          ...(z.airDistrict ? { airDistrict: z.airDistrict } : {}),
          centroid: { lat: z.centroid.lat, lng: z.centroid.lng },
          bbox: z.bbox,
          ring: z.ring,
          ...(typeof score === "number" ? { score } : {}),
          tier,
          color: colorForTier(tier),
          fillOpacity: fillOpacityForScore(score),
          zipCodes: [z.zcta],
        };
      });
      return {
        level,
        regions,
        note:
          "ZIP choropleth from California State Geoportal 2024 ZIP areas (simplified rings). Fill opacity ≤50%.",
      };
    }

    const districtGeometry = await ctx.db.query("geoAirDistricts").collect();

    // Prefer authoritative CARB district polygons. County rollups remain the
    // score source; geometry and score provenance stay separate.
    if (districtGeometry.length > 0) {
      const countyScoresByDistrict = new Map<string, number[]>();
      for (const county of caCounties) {
        if (!county.airDistrict || typeof county.aggregateScore !== "number") continue;
        const scores = countyScoresByDistrict.get(county.airDistrict) ?? [];
        scores.push(county.aggregateScore);
        countyScoresByDistrict.set(county.airDistrict, scores);
      }
      const scoreFor = (code: string) => {
        const scores = countyScoresByDistrict.get(code) ?? [];
        return scores.length
          ? scores.reduce((total, score) => total + score, 0) / scores.length
          : null;
      };
      const scored = districtGeometry.map((district) => ({
        district,
        score: scoreFor(district.code),
      }));
      const sortedScores = scored
        .map((row) => row.score)
        .filter((score): score is number => typeof score === "number")
        .sort((a, b) => a - b);
      return {
        level,
        regions: scored.map(({ district, score }) => {
          const tier = tierFromPercentile(score, sortedScores);
          return {
            id: `air-${district.code}`,
            name: district.name,
            level: "air-district" as const,
            airDistrict: district.code,
            centroid: district.centroid,
            bbox: district.bbox,
            rings: district.rings,
            ...(typeof score === "number" ? { score } : {}),
            tier,
            color: colorForTier(tier),
            fillOpacity: fillOpacityForScore(score),
          };
        }),
        note:
          "Air-district boundaries from CARB GeoJSON; freight score remains a separate county rollup. Fill opacity ≤50%.",
      };
    }

    // Fallback only when the authoritative geometry ingest has not run.
    const byDistrict = new Map<
      string,
      {
        name: string;
        scores: number[];
        minLat: number;
        minLng: number;
        maxLat: number;
        maxLng: number;
        latSum: number;
        lngSum: number;
        n: number;
        counties: string[];
      }
    >();

    for (const c of caCounties) {
      const code = c.airDistrict ?? "UNASSIGNED";
      const cur = byDistrict.get(code) ?? {
        name: code === "UNASSIGNED" ? "Unassigned counties" : code,
        scores: [],
        minLat: Infinity,
        minLng: Infinity,
        maxLat: -Infinity,
        maxLng: -Infinity,
        latSum: 0,
        lngSum: 0,
        n: 0,
        counties: [],
      };
      if (typeof c.aggregateScore === "number") cur.scores.push(c.aggregateScore);
      if (c.bbox) {
        cur.minLat = Math.min(cur.minLat, c.bbox.minLat);
        cur.minLng = Math.min(cur.minLng, c.bbox.minLng);
        cur.maxLat = Math.max(cur.maxLat, c.bbox.maxLat);
        cur.maxLng = Math.max(cur.maxLng, c.bbox.maxLng);
      }
      if (c.centroid) {
        cur.latSum += c.centroid.lat;
        cur.lngSum += c.centroid.lng;
        cur.n += 1;
      }
      cur.counties.push(c.name);
      byDistrict.set(code, cur);
    }

    const districtRows = [...byDistrict.entries()].map(([code, d]) => {
      const score =
        d.scores.length > 0
          ? d.scores.reduce((a, b) => a + b, 0) / d.scores.length
          : null;
      return { code, d, score };
    });
    const sortedScores = districtRows
      .map((r) => r.score)
      .filter((s): s is number => typeof s === "number")
      .sort((a, b) => a - b);

    const regions = districtRows.map(({ code, d, score }) => {
      const tier = tierFromPercentile(score, sortedScores);
      const hasBbox = Number.isFinite(d.minLat);
      return {
        id: `air-${code}`,
        name: d.name,
        level: "air-district" as const,
        airDistrict: code,
        ...(d.n > 0
          ? { centroid: { lat: d.latSum / d.n, lng: d.lngSum / d.n } }
          : {}),
        ...(hasBbox
          ? {
              bbox: {
                minLat: d.minLat,
                minLng: d.minLng,
                maxLat: d.maxLat,
                maxLng: d.maxLng,
              },
            }
          : {}),
        ...(typeof score === "number" ? { score } : {}),
        tier,
        color: colorForTier(tier),
        fillOpacity: fillOpacityForScore(score),
        countyCount: d.counties.length,
      };
    });

    return {
      level,
      regions,
      note:
        "Air districts — percentile R/Y/G from county aggregateScore. Fill opacity ≤50%. True district polygons deferred.",
    };
  },
});

/** Region popup: census/freight summary + carrier deep-link params. */
export const regionPopup = query({
  args: {
    regionId: v.string(),
    level: v.union(
      v.literal("air-district"),
      v.literal("county"),
      v.literal("zip"),
    ),
  },
  returns: v.union(
    v.object({
      id: v.string(),
      name: v.string(),
      level: v.string(),
      score: v.optional(v.number()),
      tier: v.string(),
      airDistrict: v.optional(v.string()),
      fips: v.optional(v.string()),
      countyCount: v.optional(v.number()),
      zipCodes: v.optional(v.array(v.string())),
      carrierHref: v.string(),
      summary: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, { regionId, level }) => {
    if (level === "county" || level === "zip") {
      const fips =
        level === "zip"
          ? regionId.replace(/^zip-\d+-?/, "") || undefined
          : regionId;
      // For zip ids like zip-90802, look up by scanning counties for zip membership.
      let county = null;
      if (level === "county") {
        county = await ctx.db
          .query("geoRegions")
          .withIndex("by_fips", (q) => q.eq("fips", regionId))
          .first();
      } else {
        const zip = regionId.replace(/^zip-/, "");
        const zcta = await ctx.db
          .query("geoZcta")
          .withIndex("by_zcta", (q) => q.eq("zcta", zip))
          .unique();
        if (zcta) {
          const score = zcta.aggregateScore ?? undefined;
          const tier = tierFromScoreAbsolute(score ?? null);
          return {
            id: regionId,
            name: zcta.name,
            level: "zip" as const,
            ...(typeof score === "number" ? { score } : {}),
            tier,
            ...(zcta.airDistrict ? { airDistrict: zcta.airDistrict } : {}),
            ...(zcta.countyFips ? { fips: zcta.countyFips } : {}),
            zipCodes: [zcta.zcta],
            carrierHref: `/caas?view=summary&carriers=1&zip=${zcta.zcta}${
              zcta.countyFips ? `&fips=${zcta.countyFips}` : ""
            }`,
            summary: `California ZIP ${zcta.zcta}. Modeled score ${
              typeof score === "number" ? score.toFixed(2) : "n/a"
            }${zcta.airDistrict ? ` (${zcta.airDistrict})` : ""}. Geometry from California State Geoportal 2024 ZIP areas.`,
          };
        }
        const all = await ctx.db
          .query("geoRegions")
          .withIndex("by_level", (q) => q.eq("level", "county"))
          .collect();
        county =
          all.find((c) => c.zipCodes?.includes(zip)) ??
          all.find((c) => c.fips === fips) ??
          null;
      }
      if (!county) return null;
      const score = county.aggregateScore ?? undefined;
      const tier = tierFromScoreAbsolute(score ?? null);
      const zip = level === "zip" ? regionId.replace(/^zip-/, "") : undefined;
      return {
        id: regionId,
        name: level === "zip" ? `ZIP ${zip}` : county.name,
        level,
        ...(typeof score === "number" ? { score } : {}),
        tier,
        ...(county.airDistrict ? { airDistrict: county.airDistrict } : {}),
        fips: county.fips,
        ...(county.zipCodes?.length
          ? { zipCodes: county.zipCodes.slice(0, 20) }
          : {}),
        carrierHref: `/caas?view=summary&carriers=1&fips=${county.fips}${
          zip ? `&zip=${zip}` : ""
        }`,
        summary: `Modeled freight/opportunity score ${
          typeof score === "number" ? score.toFixed(2) : "n/a"
        } for ${county.name}${
          county.airDistrict ? ` (${county.airDistrict})` : ""
        }.`,
      };
    }

    // air-district
    const code = regionId.replace(/^air-/, "");
    const counties = await ctx.db
      .query("geoRegions")
      .withIndex("by_level", (q) => q.eq("level", "county"))
      .collect();
    const members = counties.filter(
      (c) => (c.airDistrict ?? "UNASSIGNED") === code,
    );
    if (members.length === 0) return null;
    const scores = members
      .map((m) => m.aggregateScore)
      .filter((s): s is number => typeof s === "number");
    const score =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : undefined;
    const tier = tierFromScoreAbsolute(score ?? null);
    return {
      id: regionId,
      name: code === "UNASSIGNED" ? "Unassigned counties" : code,
      level: "air-district",
      ...(typeof score === "number" ? { score } : {}),
      tier,
      airDistrict: code,
      countyCount: members.length,
      carrierHref: `/caas?view=summary&carriers=1&airDistrict=${encodeURIComponent(code)}`,
      summary: `${members.length} counties in this air district. Mean modeled freight score ${
        typeof score === "number" ? score.toFixed(2) : "n/a"
      }.`,
    };
  },
});
