"use node";

/**
 * Build road-traced freight corridors via PTV Class-8 routing + CalTrans AADT sample.
 *
 *   npx convex run faf/buildCorridors:run
 *
 * Requires PTV_DEVELOPER_API_KEY on Convex.
 */
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { fetchPtvRouteGeometry } from "../../src/lib/maps/ptv-routes";
import { PTV_TRUCK_ROUTE_NOTE } from "../../src/lib/maps/ptv-routes";
import {
  bboxFromPath,
  colorForTier,
  sampleAadtAlongPath,
  tierFromAadtPercentile,
  type LatLng,
} from "./aadtSample";

type CorridorSpec = {
  corridorKey: string;
  name: string;
  originPortCode: string;
  destLabel: string;
  viaRouteLabel: string;
  compareGroup?: string;
  intensity: number;
  directionHint: string;
  origin: LatLng;
  dest: LatLng;
  via?: LatLng;
};

/** Flagship + west-coast OD set. Via waypoints force I-15 vs I-40. */
const CORRIDOR_SPECS: CorridorSpec[] = [
  {
    corridorKey: "polb-vegas-i15",
    name: "POLB → Las Vegas via I-15",
    originPortCode: "POLB",
    destLabel: "Las Vegas",
    viaRouteLabel: "I-15",
    compareGroup: "polb-vegas",
    intensity: 72,
    directionHint: "I-15 via Barstow",
    origin: { lat: 33.75, lng: -118.2 },
    dest: { lat: 36.1699, lng: -115.1398 },
    via: { lat: 34.8958, lng: -117.0173 }, // Barstow
  },
  {
    corridorKey: "polb-vegas-i40",
    name: "POLB → Las Vegas via I-40",
    originPortCode: "POLB",
    destLabel: "Las Vegas",
    viaRouteLabel: "I-40",
    compareGroup: "polb-vegas",
    intensity: 48,
    directionHint: "I-40 via Needles",
    origin: { lat: 33.75, lng: -118.2 },
    dest: { lat: 36.1699, lng: -115.1398 },
    via: { lat: 34.8404, lng: -114.614 }, // Needles
  },
  {
    corridorKey: "pola-vegas-i15",
    name: "POLA → Las Vegas via I-15",
    originPortCode: "POLA",
    destLabel: "Las Vegas",
    viaRouteLabel: "I-15",
    compareGroup: "pola-vegas",
    intensity: 68,
    directionHint: "I-15 via Barstow",
    origin: { lat: 33.74, lng: -118.26 },
    dest: { lat: 36.1699, lng: -115.1398 },
    via: { lat: 34.8958, lng: -117.0173 },
  },
  {
    corridorKey: "pola-vegas-i40",
    name: "POLA → Las Vegas via I-40",
    originPortCode: "POLA",
    destLabel: "Las Vegas",
    viaRouteLabel: "I-40",
    compareGroup: "pola-vegas",
    intensity: 44,
    directionHint: "I-40 via Needles",
    origin: { lat: 33.74, lng: -118.26 },
    dest: { lat: 36.1699, lng: -115.1398 },
    via: { lat: 34.8404, lng: -114.614 },
  },
  {
    corridorKey: "polb-ontario-i10",
    name: "POLB → Ontario via I-10",
    originPortCode: "POLB",
    destLabel: "Ontario / I-10",
    viaRouteLabel: "I-10",
    intensity: 78,
    directionHint: "I-10 east",
    origin: { lat: 33.75, lng: -118.2 },
    dest: { lat: 34.0633, lng: -117.6509 },
  },
  {
    corridorKey: "polb-barstow-i15",
    name: "POLB → Barstow via I-15",
    originPortCode: "POLB",
    destLabel: "Barstow / I-15",
    viaRouteLabel: "I-15",
    intensity: 92,
    directionHint: "I-15 inland",
    origin: { lat: 33.75, lng: -118.2 },
    dest: { lat: 34.8958, lng: -117.0173 },
  },
  {
    corridorKey: "oak-stockton",
    name: "Oakland → Stockton",
    originPortCode: "OAK",
    destLabel: "Stockton / I-5",
    viaRouteLabel: "I-580",
    intensity: 74,
    directionHint: "I-580 / I-205",
    origin: { lat: 37.8, lng: -122.32 },
    dest: { lat: 37.9577, lng: -121.2908 },
  },
  {
    corridorKey: "oak-tracy",
    name: "Oakland → Tracy",
    originPortCode: "OAK",
    destLabel: "Tracy / I-205",
    viaRouteLabel: "I-580",
    intensity: 68,
    directionHint: "I-580 east",
    origin: { lat: 37.8, lng: -122.32 },
    dest: { lat: 37.7397, lng: -121.4252 },
  },
  // Statewide spine — San Diego → Crescent City framing
  {
    corridorKey: "sd-la-i5",
    name: "San Diego → LA Basin via I-5",
    originPortCode: "SD",
    destLabel: "LA Basin / I-5",
    viaRouteLabel: "I-5",
    intensity: 76,
    directionHint: "I-5 north",
    origin: { lat: 32.7157, lng: -117.1611 },
    dest: { lat: 33.75, lng: -118.2 },
  },
  {
    corridorKey: "polb-bakersfield-i5",
    name: "POLB → Bakersfield via I-5",
    originPortCode: "POLB",
    destLabel: "Bakersfield / CA-99",
    viaRouteLabel: "I-5",
    intensity: 55,
    directionHint: "I-5 / CA-99 north",
    origin: { lat: 33.75, lng: -118.2 },
    dest: { lat: 35.3733, lng: -119.0187 },
    via: { lat: 34.8527, lng: -118.886 },
  },
  {
    corridorKey: "oak-redding-i5",
    name: "Oakland → Redding via I-5",
    originPortCode: "OAK",
    destLabel: "Redding / I-5",
    viaRouteLabel: "I-5",
    intensity: 42,
    directionHint: "I-5 north",
    origin: { lat: 37.8, lng: -122.32 },
    dest: { lat: 40.5865, lng: -122.3917 },
    via: { lat: 38.5816, lng: -121.4944 },
  },
  {
    corridorKey: "oak-crescent-city-us101",
    name: "Bay Area → Crescent City via US-101",
    originPortCode: "OAK",
    destLabel: "Crescent City / US-101",
    viaRouteLabel: "US-101",
    intensity: 28,
    directionHint: "US-101 north coast",
    origin: { lat: 37.8, lng: -122.32 },
    dest: { lat: 41.7558, lng: -124.2016 },
    via: { lat: 40.8021, lng: -124.1637 }, // Eureka
  },
  {
    corridorKey: "oak-sacramento-i80",
    name: "Oakland → Sacramento via I-80",
    originPortCode: "OAK",
    destLabel: "Sacramento / I-80",
    viaRouteLabel: "I-80",
    intensity: 52,
    directionHint: "I-80 east",
    origin: { lat: 37.8, lng: -122.32 },
    dest: { lat: 38.5816, lng: -121.4944 },
  },
  {
    corridorKey: "pola-fresno-ca99",
    name: "POLA → Fresno via CA-99",
    originPortCode: "POLA",
    destLabel: "Fresno / CA-99",
    viaRouteLabel: "CA-99",
    intensity: 42,
    directionHint: "I-5 / CA-99",
    origin: { lat: 33.74, lng: -118.26 },
    dest: { lat: 36.7378, lng: -119.7871 },
    via: { lat: 35.3733, lng: -119.0187 },
  },
  // Energy Forward ZE corridors — 60-truck fleet planning
  {
    corridorKey: "polb-shafter-ze",
    name: "Long Beach → Shafter (ZE corridor)",
    originPortCode: "POLB",
    destLabel: "Shafter / CA-99",
    viaRouteLabel: "I-5",
    compareGroup: "energy-forward-ze",
    intensity: 85,
    directionHint: "I-710 / I-5 / CA-99 — Energy Forward 60-truck",
    origin: { lat: 33.7542, lng: -118.2165 },
    dest: { lat: 35.5005, lng: -119.2718 }, // Shafter, CA
    via: { lat: 35.3733, lng: -119.0187 }, // Bakersfield approach
  },
  {
    corridorKey: "polb-tijuana-ze",
    name: "Long Beach → Tijuana / Otay Mesa (ZE corridor)",
    originPortCode: "POLB",
    destLabel: "Otay Mesa / Tijuana border",
    viaRouteLabel: "I-5",
    compareGroup: "energy-forward-ze",
    intensity: 80,
    directionHint: "I-5 / I-805 — US side to Otay Mesa; MX capacity separate",
    origin: { lat: 33.7542, lng: -118.2165 },
    dest: { lat: 32.555, lng: -116.938 }, // Otay Mesa POE
    via: { lat: 32.7157, lng: -117.1611 }, // San Diego
  },
];

async function fetchPtvCorridorRoute(args: {
  apiKey: string;
  origin: LatLng;
  dest: LatLng;
  via?: LatLng;
}): Promise<{
  path: LatLng[];
  distanceMeters?: number;
  durationSeconds?: number;
  warnings: string[];
}> {
  const result = await fetchPtvRouteGeometry(
    {
      origin: { latitude: args.origin.lat, longitude: args.origin.lng },
      destination: { latitude: args.dest.lat, longitude: args.dest.lng },
      waypoints: args.via
        ? [{ latitude: args.via.lat, longitude: args.via.lng }]
        : [],
      provider: "ptv",
    },
    { apiKey: args.apiKey },
  );

  if (result.coordinates.length < 2) {
    throw new Error(
      result.warnings.join("; ") || "PTV returned no route geometry",
    );
  }

  const path = result.coordinates.map((c) => ({
    lat: c.latitude,
    lng: c.longitude,
  }));

  return {
    path,
    distanceMeters: result.distanceMeters,
    durationSeconds: result.durationSeconds,
    warnings: result.warnings.length > 0 ? result.warnings : [PTV_TRUCK_ROUTE_NOTE],
  };
}

function straightFallback(origin: LatLng, dest: LatLng, via?: LatLng): LatLng[] {
  if (via) return [origin, via, dest];
  return [origin, dest];
}

export const run = action({
  args: {
    corridorKeys: v.optional(v.array(v.string())),
  },
  returns: v.object({
    built: v.number(),
    failed: v.array(v.string()),
    warnings: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const apiKey = process.env.PTV_DEVELOPER_API_KEY;
    if (!apiKey) {
      throw new Error("PTV_DEVELOPER_API_KEY required on Convex for corridor rebuild");
    }

    const specs = args.corridorKeys?.length
      ? CORRIDOR_SPECS.filter((s) => args.corridorKeys!.includes(s.corridorKey))
      : CORRIDOR_SPECS;

    const fetchedAt = Date.now();
    const failed: string[] = [];
    const warnings: string[] = [];

    type BuiltRow = {
      spec: (typeof CORRIDOR_SPECS)[number];
      path: LatLng[];
      distanceMeters?: number;
      durationSeconds?: number;
      bbox: ReturnType<typeof bboxFromPath>;
      stats: ReturnType<typeof sampleAadtAlongPath>;
      intensityTierFallback: "low" | "medium" | "heavy";
    };

    const rows: BuiltRow[] = [];

    for (const spec of specs) {
      try {
        let path: LatLng[];
        let distanceMeters: number | undefined;
        let durationSeconds: number | undefined;
        try {
          const routed = await fetchPtvCorridorRoute({
            apiKey,
            origin: spec.origin,
            dest: spec.dest,
            via: spec.via,
          });
          path = routed.path;
          distanceMeters = routed.distanceMeters;
          durationSeconds = routed.durationSeconds;
          warnings.push(...routed.warnings.map((w) => `${spec.corridorKey}: ${w}`));
        } catch (err) {
          path = straightFallback(spec.origin, spec.dest, spec.via);
          warnings.push(
            `${spec.corridorKey}: PTV routing failed — using straight fallback (${
              err instanceof Error ? err.message : String(err)
            })`,
          );
        }

        const bbox = bboxFromPath(path);
        const pad = 0.15;
        const segments = await ctx.runQuery(
          internal.faf.corridorInternal.highwaySamplesInBbox,
          {
            minLat: bbox.minLat - pad,
            minLng: bbox.minLng - pad,
            maxLat: bbox.maxLat + pad,
            maxLng: bbox.maxLng + pad,
          },
        );

        const stats = sampleAadtAlongPath(path, segments);
        // Intensity fallback when AADT sample is missing (raised cutoffs).
        const intensityTierFallback =
          spec.intensity >= 85
            ? ("heavy" as const)
            : spec.intensity >= 50
              ? ("medium" as const)
              : ("low" as const);

        rows.push({
          spec,
          path,
          distanceMeters,
          durationSeconds,
          bbox,
          stats,
          intensityTierFallback,
        });
      } catch (err) {
        failed.push(
          `${spec.corridorKey}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const sortedMeans = rows
      .map((r) => r.stats?.mean)
      .filter((m): m is number => typeof m === "number")
      .sort((a, b) => a - b);

    let built = 0;
    for (const row of rows) {
      const tier = row.stats
        ? tierFromAadtPercentile(row.stats.mean, sortedMeans)
        : row.intensityTierFallback;

      await ctx.runMutation(internal.faf.corridorMutations.upsertFreightCorridor, {
        corridorKey: row.spec.corridorKey,
        name: row.spec.name,
        originPortCode: row.spec.originPortCode,
        destLabel: row.spec.destLabel,
        viaRouteLabel: row.spec.viaRouteLabel,
        ...(row.spec.compareGroup ? { compareGroup: row.spec.compareGroup } : {}),
        origin: row.spec.origin,
        dest: row.spec.dest,
        path: row.path,
        ...(typeof row.distanceMeters === "number"
          ? {
              distanceMiles:
                Math.round((row.distanceMeters / 1609.344) * 10) / 10,
            }
          : {}),
        ...(typeof row.durationSeconds === "number"
          ? { durationSeconds: row.durationSeconds }
          : {}),
        intensity: row.spec.intensity,
        tier,
        color: colorForTier(tier),
        directionHint: row.spec.directionHint,
        ...(row.stats ? { truckAadtStats: row.stats } : {}),
        bbox: row.bbox,
        fetchedAt,
      });
      built += 1;
    }

    return { built, failed, warnings };
  },
});
