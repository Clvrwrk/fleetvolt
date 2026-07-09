"use node";

/**
 * Build road-traced freight corridors via Google Routes + CalTrans AADT sample.
 *
 *   npx convex run faf/buildCorridors:run
 *
 * Requires GOOGLE_MAPS_API_KEY (or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) on Convex.
 */
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  decodeGoogleEncodedPolyline,
  downsampleRouteCoordinates,
  GOOGLE_TRUCK_ROUTE_WARNING,
} from "../../src/lib/maps/google-routes";
import {
  bboxFromPath,
  colorForTier,
  sampleAadtAlongPath,
  tierFromTruckAadtMean,
  type LatLng,
} from "./aadtSample";

const GOOGLE_ROUTES_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";
const GOOGLE_ROUTES_FIELD_MASK =
  "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline";

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
];

async function fetchGoogleRoute(args: {
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
  const body: Record<string, unknown> = {
    origin: {
      location: {
        latLng: { latitude: args.origin.lat, longitude: args.origin.lng },
      },
    },
    destination: {
      location: {
        latLng: { latitude: args.dest.lat, longitude: args.dest.lng },
      },
    },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    computeAlternativeRoutes: false,
    polylineQuality: "HIGH_QUALITY",
    polylineEncoding: "ENCODED_POLYLINE",
    units: "IMPERIAL",
  };
  if (args.via) {
    body.intermediates = [
      {
        location: {
          latLng: { latitude: args.via.lat, longitude: args.via.lng },
        },
      },
    ];
  }

  const response = await fetch(GOOGLE_ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": args.apiKey,
      "X-Goog-FieldMask": GOOGLE_ROUTES_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Routes ${response.status}: ${text.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    routes?: Array<{
      distanceMeters?: number;
      duration?: string;
      polyline?: { encodedPolyline?: string };
    }>;
  };
  const route = json.routes?.[0];
  const encoded = route?.polyline?.encodedPolyline;
  if (!encoded) {
    throw new Error("Google Routes returned no polyline");
  }

  const decoded = decodeGoogleEncodedPolyline(encoded);
  const down = downsampleRouteCoordinates(decoded, 600);
  const path = down.map((c) => ({ lat: c.latitude, lng: c.longitude }));
  let durationSeconds: number | undefined;
  if (route?.duration) {
    const m = /^(\d+(?:\.\d+)?)s$/.exec(route.duration);
    if (m) durationSeconds = Math.round(parseFloat(m[1]!));
  }

  return {
    path,
    distanceMeters: route?.distanceMeters,
    durationSeconds,
    warnings: [GOOGLE_TRUCK_ROUTE_WARNING],
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
    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ??
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GOOGLE_MAPS_API_KEY (or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) required on Convex",
      );
    }

    const specs = args.corridorKeys?.length
      ? CORRIDOR_SPECS.filter((s) => args.corridorKeys!.includes(s.corridorKey))
      : CORRIDOR_SPECS;

    const fetchedAt = Date.now();
    const failed: string[] = [];
    const warnings: string[] = [];
    let built = 0;

    for (const spec of specs) {
      try {
        let path: LatLng[];
        let distanceMeters: number | undefined;
        let durationSeconds: number | undefined;
        try {
          const routed = await fetchGoogleRoute({
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
            `${spec.corridorKey}: Google Routes failed — using straight fallback (${
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
        const tier = stats
          ? tierFromTruckAadtMean(stats.mean)
          : spec.intensity >= 70
            ? "heavy"
            : spec.intensity >= 40
              ? "medium"
              : "low";

        await ctx.runMutation(internal.faf.corridorMutations.upsertFreightCorridor, {
          corridorKey: spec.corridorKey,
          name: spec.name,
          originPortCode: spec.originPortCode,
          destLabel: spec.destLabel,
          viaRouteLabel: spec.viaRouteLabel,
          ...(spec.compareGroup ? { compareGroup: spec.compareGroup } : {}),
          origin: spec.origin,
          dest: spec.dest,
          path,
          ...(typeof distanceMeters === "number"
            ? { distanceMiles: Math.round((distanceMeters / 1609.344) * 10) / 10 }
            : {}),
          ...(typeof durationSeconds === "number" ? { durationSeconds } : {}),
          intensity: spec.intensity,
          tier,
          color: colorForTier(tier),
          directionHint: spec.directionHint,
          ...(stats ? { truckAadtStats: stats } : {}),
          bbox,
          fetchedAt,
        });
        built += 1;
      } catch (err) {
        failed.push(
          `${spec.corridorKey}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { built, failed, warnings };
  },
});
