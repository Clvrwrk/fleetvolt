import { v } from "convex/values";
import { api } from "../_generated/api";
import { action } from "../_generated/server";
import {
  GOOGLE_TRUCK_ROUTE_WARNING,
  decodeGoogleEncodedPolyline,
  getRouteRequestHash,
  routeGeometryFallback,
  type RouteGeometryProvider,
  type RouteGeometryRequest,
  type RouteGeometryResult,
} from "../../src/lib/maps/google-routes";

const GOOGLE_ROUTES_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";
const GOOGLE_ROUTES_FIELD_MASK =
  "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.localizedValues";

const coordinateValidator = v.object({
  latitude: v.number(),
  longitude: v.number(),
});

const placeValidator = v.object({
  id: v.optional(v.string()),
  label: v.string(),
  latitude: v.number(),
  longitude: v.number(),
  kind: v.string(),
  source: v.string(),
  address: v.optional(v.string()),
  metadata: v.optional(v.any()),
});

const TRUCK_ROUTE_WARNING = GOOGLE_TRUCK_ROUTE_WARNING;
const METERS_PER_MILE = 1609.344;
const CLASS8_GAP_RADIUS_M = 8_047;
const NEAR_STOP_RADIUS_M = 3_219;

function metersToMiles(meters: number | null | undefined): number | null {
  if (typeof meters !== "number" || !Number.isFinite(meters)) return null;
  return meters / METERS_PER_MILE;
}

function round(value: number | null | undefined, digits = 0): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatMiles(meters: number | null | undefined): string {
  const miles = metersToMiles(meters);
  if (miles === null) return "unavailable";
  return `${round(miles, miles < 10 ? 1 : 0)} mi`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "unavailable";
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins} min`;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

function coordinateFromPlace(place: { latitude: number; longitude: number }) {
  return { latitude: place.latitude, longitude: place.longitude };
}

function latLngFromCoordinate(point: { latitude: number; longitude: number }) {
  return { lat: point.latitude, lng: point.longitude };
}

function sampleRoutePoints(
  coordinates: Array<{ latitude: number; longitude: number }>,
  maxPoints = 24,
) {
  if (coordinates.length <= maxPoints) return coordinates.map(latLngFromCoordinate);
  const lastIndex = coordinates.length - 1;
  const sampled: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const index = Math.round((i / (maxPoints - 1)) * lastIndex);
    sampled.push(latLngFromCoordinate(coordinates[index]!));
  }
  return sampled;
}

function fallbackRouteCoordinates(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
) {
  return [coordinateFromPlace(origin), coordinateFromPlace(destination)];
}

function stopPointFromChargingStop(stop: unknown) {
  const row = stop as { lat?: unknown; lon?: unknown; lng?: unknown };
  const lat = typeof row.lat === "number" ? row.lat : null;
  const lng = typeof row.lon === "number" ? row.lon : typeof row.lng === "number" ? row.lng : null;
  return lat !== null && lng !== null ? { lat, lng } : null;
}

function chargerLabel(row: unknown): string {
  const charger = row as { name?: unknown; stationId?: unknown; station_id?: unknown };
  return String(charger.name ?? charger.stationId ?? charger.station_id ?? "Unnamed charger");
}

function chargerDistanceM(row: unknown): number | null {
  const charger = row as { distanceM?: unknown; distance_m?: unknown };
  const value = typeof charger.distanceM === "number" ? charger.distanceM : charger.distance_m;
  return typeof value === "number" ? value : null;
}

function chargerPowerKw(row: unknown): number | null {
  const charger = row as { powerKw?: unknown; power_kw?: unknown };
  const value = typeof charger.powerKw === "number" ? charger.powerKw : charger.power_kw;
  return typeof value === "number" ? value : null;
}

function chargerIsClass8(row: unknown): boolean {
  const charger = row as { isClass8Capable?: unknown; hd_capable?: unknown };
  return charger.isClass8Capable === true || charger.hd_capable === true;
}

function parkingSummary(row: unknown): string {
  const parking = row as { name?: unknown; numberOfSpots?: unknown; hgv?: unknown; distanceM?: unknown };
  const name = String(parking.name ?? "Truck parking");
  const spots = typeof parking.numberOfSpots === "number" ? `${parking.numberOfSpots} spots` : "spots unavailable";
  const hgv = parking.hgv === true ? " · HGV" : "";
  const distance = typeof parking.distanceM === "number" ? ` · ${formatMiles(parking.distanceM)}` : "";
  return `${name}: ${spots}${hgv}${distance}`;
}

function poiSummary(row: unknown): string {
  const poi = row as { name?: unknown; type?: unknown; distanceM?: unknown };
  const label = String(poi.name ?? poi.type ?? "POI");
  const distance = typeof poi.distanceM === "number" ? ` · ${formatMiles(poi.distanceM)}` : "";
  return `${label}${distance}`;
}

type DriverPlanCard = {
  id: string;
  title: string;
  summary: string;
  mode: "driver_day_plan";
  severity: "info" | "success" | "warning" | "critical";
  layerId?: "route" | "chargers" | "parking" | "pois" | "class8-gaps";
  metrics?: Record<string, number | string | null>;
  actions?: Array<{ id: string; label: string; kind: "primary" | "secondary" }>;
};

type DriverDayPlanResult = {
  id: string;
  mode: "driver_day_plan";
  routeGeometry: RouteGeometryResult;
  simulation: unknown;
  gapAnalysis: unknown;
  nearestClass8: unknown[];
  fiveClosestChargers: unknown[];
  parking: unknown;
  pois: unknown;
  resultCards: DriverPlanCard[];
  providerWarnings: string[];
  assumptions: string[];
};

type GoogleRouteResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: {
      encodedPolyline?: string;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

const routeCache = new Map<string, RouteGeometryResult>();

function normalizeProvider(provider: RouteGeometryProvider | undefined): RouteGeometryProvider {
  return provider ?? "google";
}

function normalizeRequest(request: RouteGeometryRequest): RouteGeometryRequest {
  return {
    provider: normalizeProvider(request.provider),
    origin: request.origin,
    destination: request.destination,
    waypoints: request.waypoints ?? [],
  };
}

function parseGoogleDurationSeconds(duration: string | undefined): number | undefined {
  if (!duration) return undefined;
  const match = duration.match(/^(\d+(?:\.\d+)?)s$/);
  if (!match) return undefined;
  return Math.round(Number(match[1]));
}

async function readGoogleError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as GoogleRouteResponse;
    return data.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export const routeGeometry = action({
  args: {
    origin: coordinateValidator,
    destination: coordinateValidator,
    waypoints: v.optional(v.array(coordinateValidator)),
    provider: v.optional(
      v.union(
        v.literal("google"),
        v.literal("ptv"),
        v.literal("valhalla"),
        v.literal("mock"),
      ),
    ),
  },
  handler: async (_ctx, args): Promise<RouteGeometryResult> => {
    const request = normalizeRequest(args as RouteGeometryRequest);
    const requestHash = await getRouteRequestHash(request);

    if (request.provider !== "google") {
      return routeGeometryFallback(
        request,
        `${request.provider?.toUpperCase()} route geometry provider is not configured yet`,
        { requestHash },
      );
    }

    const cached = routeCache.get(requestHash);
    if (cached) {
      return {
        ...cached,
        metadata: {
          ...(cached.metadata ?? {}),
          cacheStatus: "hit",
        },
      };
    }

    const apiKey = process.env.GOOGLE_ROUTES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return routeGeometryFallback(request, "Google Routes API key is not configured", {
        requestHash,
      });
    }

    const body = {
      origin: { location: { latLng: request.origin } },
      destination: { location: { latLng: request.destination } },
      intermediates: request.waypoints?.map((waypoint) => ({
        location: { latLng: waypoint },
      })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
      polylineQuality: "HIGH_QUALITY",
      polylineEncoding: "ENCODED_POLYLINE",
      units: "IMPERIAL",
    };

    try {
      const response = await fetch(GOOGLE_ROUTES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": GOOGLE_ROUTES_FIELD_MASK,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const message = await readGoogleError(response);
        return routeGeometryFallback(
          request,
          `Google Routes request failed: ${response.status} ${message}`,
          { requestHash },
        );
      }

      const data = (await response.json()) as GoogleRouteResponse;
      const route = data.routes?.[0];
      const encodedPolyline = route?.polyline?.encodedPolyline;

      if (!route || !encodedPolyline) {
        return routeGeometryFallback(
          request,
          "Google Routes returned no route geometry",
          { requestHash },
        );
      }

      const result: RouteGeometryResult = {
        provider: "google",
        coordinates: decodeGoogleEncodedPolyline(encodedPolyline),
        distanceMeters: route.distanceMeters,
        durationSeconds: parseGoogleDurationSeconds(route.duration),
        encodedPolyline,
        warnings: [GOOGLE_TRUCK_ROUTE_WARNING],
        metadata: {
          requestHash,
          cacheStatus: "miss",
        },
      };

      routeCache.set(requestHash, result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return routeGeometryFallback(
        request,
        `Google Routes request failed: ${message}`,
        { requestHash },
      );
    }
  },
});

export const driverDayPlan = action({
  args: {
    origin: placeValidator,
    destination: placeValidator,
    roundTrips: v.number(),
    truckSlug: v.string(),
    payloadLbs: v.number(),
    weatherPreset: v.union(
      v.literal("ideal"),
      v.literal("hot"),
      v.literal("cold"),
      v.literal("headwind"),
    ),
    workdayHours: v.number(),
    breakMinutes: v.number(),
    includePortDrayage: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<DriverDayPlanResult> => {
    const roundTrips = Math.max(1, Math.min(8, Math.round(args.roundTrips)));
    const workdayHours = Math.max(1, Math.min(18, args.workdayHours));
    const breakMinutes = Math.max(0, Math.min(240, args.breakMinutes));

    const routeRequest = normalizeRequest({
      origin: coordinateFromPlace(args.origin),
      destination: coordinateFromPlace(args.destination),
      provider: "google" as const,
    });
    const routeHash = await getRouteRequestHash(routeRequest);
    const route = routeGeometryFallback(
      routeRequest,
      "Route provider result unavailable inside driver aggregate action; using endpoint geometry and labeled provider warning.",
      { requestHash: routeHash },
    );

    const routeCoordinates =
      route.coordinates.length > 0
        ? route.coordinates
        : fallbackRouteCoordinates(args.origin, args.destination);
    const corridorPoints = sampleRoutePoints(routeCoordinates);
    const providerWarnings = Array.from(new Set([...(route.warnings ?? []), TRUCK_ROUTE_WARNING]));

    let simulation: unknown = null;
    let simulationError: string | null = null;
    try {
      simulation = await ctx.runAction(api.physics.simulate.simulate, {
        request: {
          route: {
            origin: { lat: args.origin.latitude, lon: args.origin.longitude },
            dest: { lat: args.destination.latitude, lon: args.destination.longitude },
          },
          truck: { slug: args.truckSlug },
          conditions: {
            weather_preset: args.weatherPreset,
            payload_lbs: args.payloadLbs,
            port_drayage_enabled: args.includePortDrayage ?? false,
          },
          options: { include_charging: true },
        },
      });
    } catch (error) {
      simulationError = error instanceof Error ? error.message : String(error);
    }

    const sim = simulation as
      | {
          kpis?: { total_kwh?: number; total_time_s?: number; wh_per_mi?: number };
          charging_stops?: unknown[] | null;
          feasibility?: {
            verdict?: "feasible" | "critical" | "infeasible";
            tier?: string;
            stop_count?: number;
            blocking_reason?: string | null;
            soc_deficit_kwh?: number | null;
          } | null;
          disclaimer?: string;
        }
      | null;

    const gapAnalysis = (await ctx.runQuery(api.workbench.queries.analyzeClass8GapAlongRoute, {
      corridorPoints,
      radiusM: CLASS8_GAP_RADIUS_M,
    })) as {
      gap: {
        class8WithinCorridor: number;
        closestClass8DistanceM: number | null;
        class8Chargers: unknown[];
        fiveClosestAnyClass: unknown[];
      } | null;
    };
    const gap = gapAnalysis.gap;

    const destinationNearestClass8 = (await ctx.runQuery(api.chargers.queries.nearestClass8, {
      lat: args.destination.latitude,
      lng: args.destination.longitude,
      radiusM: 50_000,
      limit: 5,
    })) as unknown[];
    const destinationFiveClosest = (await ctx.runQuery(api.chargers.queries.fiveClosest, {
      lat: args.destination.latitude,
      lng: args.destination.longitude,
      limit: 5,
    })) as unknown[];

    const stopPoints =
      sim?.charging_stops?.map(stopPointFromChargingStop).filter((point): point is { lat: number; lng: number } => Boolean(point)) ?? [];
    const accessProbePoint = stopPoints[0] ?? { lat: args.destination.latitude, lng: args.destination.longitude };
    const [parking, pois] = (await Promise.all([
      ctx.runQuery(api.pois.queries.parkingInRadius, {
        ...accessProbePoint,
        radiusM: NEAR_STOP_RADIUS_M,
        limit: 5,
      }),
      ctx.runQuery(api.pois.queries.poisInRadius, {
        ...accessProbePoint,
        radiusM: NEAR_STOP_RADIUS_M,
        types: ["fuel", "food", "rest_area", "truck_stop", "repair"],
        limit: 5,
      }),
    ])) as [
      { count: number; totalSpotsWithinRadius: number; parking: unknown[] },
      { total: number; pois: unknown[]; byType: Record<string, unknown[]> },
    ];

    const oneWaySeconds = route.durationSeconds ?? sim?.kpis?.total_time_s ?? null;
    const oneWayKwh = sim?.kpis?.total_kwh ?? null;
    const dayDriveSeconds = typeof oneWaySeconds === "number" ? oneWaySeconds * roundTrips * 2 : null;
    const breakSeconds = breakMinutes * 60;
    const chargingSeconds: number =
      sim?.charging_stops?.reduce<number>((sum, stop) => {
        const dwell = (stop as { dwell_s?: unknown }).dwell_s;
        return sum + (typeof dwell === "number" ? dwell : 0);
      }, 0) ?? 0;
    const estimatedDaySeconds = dayDriveSeconds === null ? null : dayDriveSeconds + chargingSeconds + breakSeconds;
    const timeFeasible = estimatedDaySeconds !== null ? estimatedDaySeconds <= workdayHours * 3600 : null;
    const simulationVerdict = sim?.feasibility?.verdict ?? (simulationError ? "critical" : null);
    const energyFeasible = simulationVerdict === "feasible" || simulationVerdict === null;
    const feasible = timeFeasible === false || !energyFeasible ? false : timeFeasible === true && energyFeasible;

    const cards: DriverPlanCard[] = [];
    cards.push({
      id: "driver-feasibility",
      title: feasible ? "Day plan feasible" : "Day plan needs attention",
      summary: simulationError
        ? `Route geometry was built, but physics simulation was unavailable: ${simulationError}`
        : feasible
          ? `${roundTrips} round trip(s) fit in ${workdayHours}h with current truck/weather constraints.`
          : `The plan exceeds at least one constraint: ${timeFeasible === false ? "workday time" : sim?.feasibility?.blocking_reason ?? "energy/charging feasibility"}.`,
      mode: "driver_day_plan",
      severity: feasible ? "success" : simulationError ? "warning" : "critical",
      layerId: "route",
      metrics: {
        roundTrips,
        routeMiles: round(route.distanceMeters ? metersToMiles(route.distanceMeters) : null, 1),
        oneWayDriveTime: formatDuration(oneWaySeconds),
        estimatedDay: formatDuration(estimatedDaySeconds),
        workdayHours,
        energyKwhOneWay: round(oneWayKwh, 1),
        simulationVerdict,
      },
    });

    const stops = sim?.charging_stops ?? [];
    cards.push({
      id: "driver-charge-stops",
      title: stops.length > 0 ? "Charge stops from physics simulation" : "Nearest charging options",
      summary:
        stops.length > 0
          ? stops
              .slice(0, 3)
              .map((stop) => {
                const row = stop as { name?: unknown; power_kw?: unknown; dwell_s?: unknown };
                return `${String(row.name ?? "Charge stop")} · ${typeof row.power_kw === "number" ? `${row.power_kw} kW` : "power unavailable"} · ${formatDuration(typeof row.dwell_s === "number" ? row.dwell_s : null)} dwell`;
              })
              .join("; ")
          : destinationNearestClass8.length > 0
            ? destinationNearestClass8.map((charger: unknown) => `${chargerLabel(charger)} (${formatMiles(chargerDistanceM(charger))})`).join("; ")
            : "No simulation charge stop was produced; showing closest known chargers near destination as candidates.",
      mode: "driver_day_plan",
      severity: stops.length > 0 || destinationNearestClass8.length > 0 ? "info" : "warning",
      layerId: "chargers",
      metrics: {
        simulatedStops: stops.length,
        nearestClass8Count: destinationNearestClass8.length,
        fiveClosestChargers: destinationFiveClosest.length,
        chargingDwell: formatDuration(chargingSeconds),
      },
    });

    const class8Count = gap?.class8WithinCorridor ?? 0;
    cards.push({
      id: "driver-class8-gap",
      title: class8Count > 0 ? "Class 8 coverage found on route" : "Class 8 gap / detour check",
      summary:
        class8Count > 0
          ? `${class8Count} Class 8-capable charger(s) were found within ${formatMiles(CLASS8_GAP_RADIUS_M)} of sampled route points.`
          : `No Class 8-capable charger was found within ${formatMiles(CLASS8_GAP_RADIUS_M)} of sampled route points. Nearest viable charger distance is ${formatMiles(gap?.closestClass8DistanceM)}; detour drive time/access details are not computed yet.`,
      mode: "driver_day_plan",
      severity: class8Count > 0 ? "success" : "warning",
      layerId: "class8-gaps",
      metrics: {
        class8WithinCorridor: class8Count,
        closestClass8Miles: round(metersToMiles(gap?.closestClass8DistanceM ?? null), 1),
        sampledRoutePoints: corridorPoints.length,
        detourAccess: "unavailable — route-provider detour not computed",
      },
      actions: [
        {
          id: "review-nearest-viable-charger",
          label: class8Count > 0 ? "Review Class 8 stops" : "Review nearest viable charger",
          kind: "secondary",
        },
      ],
    });

    cards.push({
      id: "driver-site-access",
      title: "Site access guidance near stop",
      summary: [
        parking.parking?.length ? `Parking: ${parking.parking.slice(0, 2).map(parkingSummary).join("; ")}` : "Parking: no in-radius truck parking returned.",
        pois.pois?.length ? `POIs: ${pois.pois.slice(0, 3).map(poiSummary).join("; ")}` : "POIs: no driver-service POIs returned.",
      ].join(" "),
      mode: "driver_day_plan",
      severity: parking.parking?.length || pois.pois?.length ? "info" : "warning",
      layerId: "parking",
      metrics: {
        parkingCount: parking.count ?? 0,
        parkingSpots: parking.totalSpotsWithinRadius ?? null,
        poiCount: pois.total ?? 0,
        accessProbe: stopPoints.length > 0 ? "first simulated charge stop" : "destination fallback",
      },
    });

    return {
      id: `driver-day-plan-${String(route.metadata?.requestHash ?? Date.now())}`,
      mode: "driver_day_plan" as const,
      routeGeometry: route,
      simulation,
      gapAnalysis,
      nearestClass8: destinationNearestClass8,
      fiveClosestChargers: destinationFiveClosest,
      parking,
      pois,
      resultCards: cards,
      providerWarnings,
      assumptions: [
        "Google route geometry is not truck-restriction-certified.",
        "Physics simulation uses available FleetVolt truck config and synthetic flat elevation when route elevation is not cached.",
        "Detour drive time and site driveway/trailer sweep access are unavailable unless explicitly returned by a provider/data source.",
      ],
    };
  },
});
