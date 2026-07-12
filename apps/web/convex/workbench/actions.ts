import { v } from "convex/values";
import { api } from "../_generated/api";
import { action } from "../_generated/server";
import {
  GOOGLE_TRUCK_ROUTE_WARNING,
  decodeGoogleEncodedPolyline,
  downsampleRouteCoordinates,
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
  maxPoints = 12,
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
  mode: "driver_day_plan" | "fleet_contract_plan";
  severity: "info" | "success" | "warning" | "critical";
  layerId?: "route" | "chargers" | "parking" | "pois" | "class8-gaps";
  metrics?: Record<string, number | string | null>;
  actions?: Array<{ id: string; label: string; kind: "primary" | "secondary" }>;
};

type WorkbenchMapPin = {
  id: string;
  type: "charger" | "parking" | "poi";
  layerId: "chargers" | "parking" | "pois";
  label: string;
  latitude: number;
  longitude: number;
  subtitle?: string;
  metric?: string;
  metadata?: Record<string, unknown>;
};

type DriverDayPlanResult = {
  id: string;
  mode: "driver_day_plan" | "fleet_contract_plan";
  routeGeometry: RouteGeometryResult;
  simulation: unknown;
  gapAnalysis: unknown;
  nearestClass8: unknown[];
  fiveClosestChargers: unknown[];
  parking: unknown;
  pois: unknown;
  /** Live map markers for the calculated corridor (replaces sample POLB pins). */
  mapPins: WorkbenchMapPin[];
  resultCards: DriverPlanCard[];
  providerWarnings: string[];
  assumptions: string[];
};

function asFiniteLatLng(value: unknown): { lat: number; lng: number } | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { lat?: unknown; lng?: unknown; lon?: unknown; latitude?: unknown; longitude?: unknown };
  const lat =
    typeof row.lat === "number"
      ? row.lat
      : typeof row.latitude === "number"
        ? row.latitude
        : null;
  const lng =
    typeof row.lng === "number"
      ? row.lng
      : typeof row.lon === "number"
        ? row.lon
        : typeof row.longitude === "number"
          ? row.longitude
          : null;
  if (
    lat === null ||
    lng === null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }
  return { lat, lng };
}

function buildMapPins(args: {
  nearestClass8: unknown[];
  fiveClosest: unknown[];
  class8AlongRoute: unknown[];
  parking: unknown[];
  pois: unknown[];
  chargingStops: unknown[];
}): WorkbenchMapPin[] {
  const pins: WorkbenchMapPin[] = [];
  const seen = new Set<string>();

  function push(pin: WorkbenchMapPin) {
    if (seen.has(pin.id)) return;
    seen.add(pin.id);
    pins.push(pin);
  }

  for (const raw of [...args.class8AlongRoute, ...args.nearestClass8, ...args.fiveClosest]) {
    const row = raw as {
      stationId?: unknown;
      name?: unknown;
      location?: unknown;
      powerKw?: unknown;
      isClass8Capable?: unknown;
      distanceM?: unknown;
    };
    const loc = asFiniteLatLng(row.location);
    if (!loc) continue;
    const stationId = String(row.stationId ?? `${loc.lat},${loc.lng}`);
    const isClass8 = row.isClass8Capable === true;
    // Driver toolbar only toggles `chargers` — keep Class 8 pins on that layer.
    push({
      id: `charger-${stationId}`,
      type: "charger",
      layerId: "chargers",
      label: String(row.name ?? `Charger ${stationId}`),
      latitude: loc.lat,
      longitude: loc.lng,
      subtitle: isClass8 ? "Class 8 capable" : "Candidate charger",
      metric: typeof row.powerKw === "number" ? `${row.powerKw} kW` : undefined,
      metadata: {
        stationId,
        powerKw: row.powerKw ?? null,
        isClass8Capable: isClass8,
        distanceM: row.distanceM ?? null,
        classification: isClass8 ? "class8" : "any",
      },
    });
  }

  for (const raw of args.chargingStops) {
    const loc = stopPointFromChargingStop(raw);
    if (!loc) continue;
    const row = raw as { name?: unknown; power_kw?: unknown };
    push({
      id: `sim-stop-${loc.lat.toFixed(4)}-${loc.lng.toFixed(4)}`,
      type: "charger",
      layerId: "chargers",
      label: String(row.name ?? "Simulated charge stop"),
      latitude: loc.lat,
      longitude: loc.lng,
      subtitle: "Physics simulation stop",
      metric: typeof row.power_kw === "number" ? `${row.power_kw} kW` : undefined,
      metadata: { source: "simulation" },
    });
  }

  args.parking.forEach((raw, index) => {
    const row = raw as { name?: unknown; location?: unknown; numberOfSpots?: unknown; hgv?: unknown; distanceM?: unknown };
    const loc = asFiniteLatLng(row.location);
    if (!loc) return;
    push({
      id: `parking-${index}-${loc.lat.toFixed(4)}-${loc.lng.toFixed(4)}`,
      type: "parking",
      layerId: "parking",
      label: String(row.name ?? "Truck parking"),
      latitude: loc.lat,
      longitude: loc.lng,
      subtitle: row.hgv === true ? "HGV parking" : "Parking",
      metric: typeof row.numberOfSpots === "number" ? `${row.numberOfSpots} spots` : undefined,
      metadata: { distanceM: row.distanceM ?? null, hgv: row.hgv ?? null },
    });
  });

  args.pois.forEach((raw, index) => {
    const row = raw as { name?: unknown; type?: unknown; location?: unknown; distanceM?: unknown };
    const loc = asFiniteLatLng(row.location);
    if (!loc) return;
    push({
      id: `poi-${index}-${loc.lat.toFixed(4)}-${loc.lng.toFixed(4)}`,
      type: "poi",
      layerId: "pois",
      label: String(row.name ?? row.type ?? "POI"),
      latitude: loc.lat,
      longitude: loc.lng,
      subtitle: typeof row.type === "string" ? row.type.replace(/_/g, " ") : "Amenity",
      metadata: { type: row.type ?? null, distanceM: row.distanceM ?? null },
    });
  });

  return pins;
}

type FleetContractPlanResult = DriverDayPlanResult & {
  mode: "fleet_contract_plan";
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
  return provider ?? "ptv";
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

    // Default: PTV Class-8 truck routing.
    if (request.provider === "ptv" || request.provider === undefined) {
      const { fetchPtvRouteGeometry } = await import("../../src/lib/maps/ptv-routes");
      const ptvKey = process.env.PTV_DEVELOPER_API_KEY;
      if (!ptvKey) {
        // Fall back to Google with an explicit warning if PTV key missing.
        const googleKey =
          process.env.GOOGLE_ROUTES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
        if (!googleKey) {
          return routeGeometryFallback(
            { ...request, provider: "ptv" },
            "PTV_DEVELOPER_API_KEY is not configured (and no Google Routes fallback key)",
            { requestHash },
          );
        }
        const googleResult = await fetchGoogleRouteInternal(
          { ...request, provider: "google" },
          googleKey,
          requestHash,
        );
        return {
          ...googleResult,
          warnings: [
            ...(googleResult.warnings ?? []),
            "PTV_DEVELOPER_API_KEY missing — used Google Routes fallback (not truck-certified).",
          ],
        };
      }
      const result = await fetchPtvRouteGeometry(
        { ...request, provider: "ptv" },
        { apiKey: ptvKey },
      );
      if (result.coordinates.length >= 8) {
        routeCache.set(requestHash, result);
        return result;
      }

      // PTV may return an endpoint fallback on provider/profile failures. Use
      // Google road geometry when available rather than drawing a straight
      // line and presenting it as a route.
      const googleKey =
        process.env.GOOGLE_ROUTES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
      if (googleKey) {
        const googleResult = await fetchGoogleRouteInternal(
          { ...request, provider: "google" },
          googleKey,
          requestHash,
        );
        if (googleResult.coordinates.length >= 8) {
          const fallback = {
            ...googleResult,
            warnings: [
              ...(result.warnings ?? []),
              ...(googleResult.warnings ?? []),
              "PTV road geometry was unavailable — used Google road geometry (not truck-certified).",
            ],
          };
          routeCache.set(requestHash, fallback);
          return fallback;
        }
      }
      return routeGeometryFallback(
        request,
        "Road geometry unavailable from PTV and Google; no route should be drawn",
        { requestHash },
      );
    }

    if (request.provider === "google") {
      const apiKey =
        process.env.GOOGLE_ROUTES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return routeGeometryFallback(
          request,
          "Google Routes API key is not configured",
          { requestHash },
        );
      }
      const result = await fetchGoogleRouteInternal(request, apiKey, requestHash);
      if (result.coordinates.length >= 2) {
        routeCache.set(requestHash, result);
      }
      return result;
    }

    return routeGeometryFallback(
      request,
      `${request.provider?.toUpperCase()} route geometry provider is not configured yet`,
      { requestHash },
    );
  },
});

async function fetchGoogleRouteInternal(
  request: RouteGeometryRequest,
  apiKey: string,
  requestHash: string,
): Promise<RouteGeometryResult> {
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

    const decoded = decodeGoogleEncodedPolyline(encodedPolyline);
    const coordinates = downsampleRouteCoordinates(decoded);
    return {
      provider: "google",
      coordinates,
      distanceMeters: route.distanceMeters,
      durationSeconds: parseGoogleDurationSeconds(route.duration),
      warnings: [GOOGLE_TRUCK_ROUTE_WARNING],
      metadata: {
        requestHash,
        cacheStatus: "miss",
        coordinateCountRaw: decoded.length,
        coordinateCountReturned: coordinates.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return routeGeometryFallback(
      request,
      `Google Routes request failed: ${message}`,
      { requestHash },
    );
  }
}

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
      provider: "ptv" as const,
    });
    const routeHash = await getRouteRequestHash(routeRequest);
    let route = routeGeometryFallback(
      routeRequest,
      "Route provider result unavailable inside driver aggregate action; using endpoint geometry and labeled provider warning.",
      { requestHash: routeHash },
    );
    try {
      // Road-snapped PTV Class-8 truck polyline (same path as fleet contract plan).
      route = await ctx.runAction(api.workbench.actions.routeGeometry, routeRequest);
    } catch {
      // Keep labeled fallback — providerWarnings surface the assumption.
    }

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
    // Also sample origin + mid-corridor so long routes (SF→Barstow) get pins
    // along the path, not only at the destination.
    const originProbe = corridorPoints[0] ?? {
      lat: args.origin.latitude,
      lng: args.origin.longitude,
    };
    const midProbe = corridorPoints[Math.floor(corridorPoints.length / 2)] ?? originProbe;
    const [originFiveClosest, midFiveClosest, originNearestClass8, midNearestClass8] =
      (await Promise.all([
        ctx.runQuery(api.chargers.queries.fiveClosest, {
          lat: originProbe.lat,
          lng: originProbe.lng,
          limit: 4,
        }),
        ctx.runQuery(api.chargers.queries.fiveClosest, {
          lat: midProbe.lat,
          lng: midProbe.lng,
          limit: 4,
        }),
        ctx.runQuery(api.chargers.queries.nearestClass8, {
          lat: originProbe.lat,
          lng: originProbe.lng,
          radiusM: 50_000,
          limit: 3,
        }),
        ctx.runQuery(api.chargers.queries.nearestClass8, {
          lat: midProbe.lat,
          lng: midProbe.lng,
          radiusM: 50_000,
          limit: 3,
        }),
      ])) as [unknown[], unknown[], unknown[], unknown[]];

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

    const mapPins = buildMapPins({
      nearestClass8: [
        ...destinationNearestClass8,
        ...originNearestClass8,
        ...midNearestClass8,
      ],
      fiveClosest: [
        ...destinationFiveClosest,
        ...originFiveClosest,
        ...midFiveClosest,
      ],
      class8AlongRoute: gap?.class8Chargers ?? [],
      parking: parking.parking ?? [],
      pois: pois.pois ?? [],
      chargingStops: sim?.charging_stops ?? [],
    });

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
      mapPins,
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


export const fleetContractPlan = action({
  args: {
    origin: placeValidator,
    destination: placeValidator,
    truckSlug: v.string(),
    payloadLbs: v.number(),
    weatherPreset: v.union(
      v.literal("ideal"),
      v.literal("hot"),
      v.literal("cold"),
      v.literal("headwind"),
    ),
    serviceDate: v.string(),
    scheduleWindow: v.string(),
    containersPerDay: v.number(),
    gateStartHour: v.number(),
    gateEndHour: v.number(),
    portDwellMinutes: v.number(),
    destinationDwellMinutes: v.number(),
    shiftHours: v.number(),
    yardReturn: v.boolean(),
  },
  handler: async (ctx, args): Promise<FleetContractPlanResult> => {
    const containersPerDay = Math.max(1, Math.min(500, Math.round(args.containersPerDay)));
    const gateStartHour = Math.max(0, Math.min(23.5, args.gateStartHour));
    const gateEndHour = Math.max(gateStartHour + 0.5, Math.min(24, args.gateEndHour));
    const gateHours = Math.max(0.5, gateEndHour - gateStartHour);
    const portDwellMinutes = Math.max(0, Math.min(360, args.portDwellMinutes));
    const destinationDwellMinutes = Math.max(0, Math.min(360, args.destinationDwellMinutes));
    const shiftHours = Math.max(4, Math.min(16, args.shiftHours));

    const routeRequest = normalizeRequest({
      origin: coordinateFromPlace(args.origin),
      destination: coordinateFromPlace(args.destination),
      provider: "ptv" as const,
    });
    const routeHash = await getRouteRequestHash(routeRequest);
    let route = routeGeometryFallback(
      routeRequest,
      "Route provider result unavailable inside fleet aggregate action; using endpoint geometry and labeled provider warning.",
      { requestHash: routeHash },
    );
    try {
      route = await ctx.runAction(api.workbench.actions.routeGeometry, routeRequest);
    } catch {
      // Keep the labeled fallback above. The provider warning card makes the assumption visible.
    }

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
            port_drayage_enabled: args.origin.kind === "port" || args.destination.kind === "port",
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
    const midpoint = corridorPoints[Math.floor(corridorPoints.length / 2)] ?? {
      lat: args.destination.latitude,
      lng: args.destination.longitude,
    };
    const accessProbePoint = stopPoints[0] ?? midpoint;
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

    const mapPins = buildMapPins({
      nearestClass8: destinationNearestClass8,
      fiveClosest: destinationFiveClosest,
      class8AlongRoute: gap?.class8Chargers ?? [],
      parking: parking.parking ?? [],
      pois: pois.pois ?? [],
      chargingStops: sim?.charging_stops ?? [],
    });

    const oneWaySeconds = route.durationSeconds ?? sim?.kpis?.total_time_s ?? null;
    const dwellSeconds = (portDwellMinutes + destinationDwellMinutes) * 60;
    const yardReturnSeconds = args.yardReturn ? 30 * 60 : 0;
    const chargingSeconds: number =
      sim?.charging_stops?.reduce<number>((sum, stop) => {
        const dwell = (stop as { dwell_s?: unknown }).dwell_s;
        return sum + (typeof dwell === "number" ? dwell : 0);
      }, 0) ?? 0;
    const roundTripDriveSeconds = typeof oneWaySeconds === "number" ? oneWaySeconds * 2 : null;
    const roundTripSeconds =
      roundTripDriveSeconds === null
        ? null
        : roundTripDriveSeconds + dwellSeconds + chargingSeconds + yardReturnSeconds;
    const effectiveShiftSeconds = Math.min(shiftHours, gateHours) * 3600;
    const tripsPerTruckDay =
      roundTripSeconds && roundTripSeconds > 0
        ? Math.max(0, Math.floor(effectiveShiftSeconds / roundTripSeconds))
        : 0;
    const trucksRequired = tripsPerTruckDay > 0 ? Math.ceil(containersPerDay / tripsPerTruckDay) : null;
    const driversRequired = trucksRequired === null ? null : Math.ceil(trucksRequired * (shiftHours > 10 ? 1.2 : 1));
    const chargeEventsPerTrip = sim?.charging_stops?.length ?? 0;
    const dailyChargeEvents = chargeEventsPerTrip * containersPerDay;
    const dailyChargingDowntimeSeconds = chargingSeconds * containersPerDay;
    const class8Count = gap?.class8WithinCorridor ?? 0;
    const hasSimulationBlocker = sim?.feasibility?.verdict === "critical" || sim?.feasibility?.verdict === "infeasible";
    const trueGap = class8Count === 0 && (gap?.closestClass8DistanceM === null || (gap?.closestClass8DistanceM ?? 0) > CLASS8_GAP_RADIUS_M * 2);
    const gapClassification = trueGap
      ? "true gap"
      : class8Count === 0
        ? "detour-solvable / nearest-charger review"
        : hasSimulationBlocker
          ? "energy-constrained despite Class 8 coverage"
          : "covered";
    const supportTime = gateStartHour + Math.min(2, Math.max(0, gateHours / 3));
    const supportHour = Math.floor(supportTime);
    const supportMinutes = Math.round((supportTime - supportHour) * 60);
    const supportTimeLabel = `${String(supportHour).padStart(2, "0")}:${String(supportMinutes).padStart(2, "0")}`;
    const supportPointLabel = `${round(midpoint.lat, 3)}, ${round(midpoint.lng, 3)}`;

    const cards: DriverPlanCard[] = [
      {
        id: "fleet-capacity-formula",
        title: trucksRequired === null ? "Capacity formula blocked" : "Contract capacity formula",
        summary:
          trucksRequired === null
            ? "Round-trip duration is unavailable or exceeds the shift window; route/simulation assumptions need review before sizing the contract."
            : `Formula: ${containersPerDay} containers/day ÷ ${tripsPerTruckDay} trips/truck/day = ${trucksRequired} truck(s).`,
        mode: "fleet_contract_plan",
        severity: trucksRequired === null ? "critical" : "success",
        layerId: "route",
        metrics: {
          containersPerDay,
          roundTripDuration: formatDuration(roundTripSeconds),
          tripsPerTruckDay,
          trucksRequired,
          driversRequired,
          formula: "ceil(containers/day ÷ trips/truck/day)",
        },
      },
      {
        id: "fleet-shift-assumptions",
        title: "Schedule and dwell assumptions",
        summary: `Assumption labels: ${args.scheduleWindow} on ${args.serviceDate}; gate ${gateStartHour}:00-${gateEndHour}:00; port dwell ${portDwellMinutes} min; destination dwell ${destinationDwellMinutes} min; yard return ${args.yardReturn ? "included" : "excluded"}.`,
        mode: "fleet_contract_plan",
        severity: tripsPerTruckDay > 0 ? "info" : "warning",
        layerId: "route",
        metrics: {
          effectiveWindow: `${round(Math.min(shiftHours, gateHours), 1)} h`,
          gateHours: round(gateHours, 1),
          shiftHours,
          dwellPerTurn: formatDuration(dwellSeconds),
          yardReturn: args.yardReturn ? "30 min modeled" : "not modeled",
          oneContainerPerTrip: "assumed",
        },
      },
      {
        id: "fleet-charging-operations",
        title: "Charging operations",
        summary: simulationError
          ? `Physics simulation unavailable: ${simulationError}. Charging counts are labeled unavailable until simulation returns.`
          : chargeEventsPerTrip > 0
            ? `Formula: ${chargeEventsPerTrip} charge event(s)/turn × ${containersPerDay} turns/day = ${dailyChargeEvents} daily event(s).`
            : "No simulated charge stop was returned; nearest Class 8 chargers remain candidates, not committed stops.",
        mode: "fleet_contract_plan",
        severity: simulationError ? "warning" : chargeEventsPerTrip > 0 ? "info" : "warning",
        layerId: "chargers",
        metrics: {
          chargeEventsPerTrip,
          dailyChargeEvents,
          chargingDowntimePerTrip: formatDuration(chargingSeconds),
          dailyChargingDowntime: formatDuration(dailyChargingDowntimeSeconds),
          nearestClass8Count: destinationNearestClass8.length,
          energyKwhOneWay: round(sim?.kpis?.total_kwh, 1),
        },
      },
      {
        id: "fleet-route-amenities",
        title: "Route amenities near operating point",
        summary: [
          parking.parking?.length ? `Parking: ${parking.parking.slice(0, 2).map(parkingSummary).join("; ")}` : "Parking: no in-radius truck parking returned.",
          pois.pois?.length ? `POIs: ${pois.pois.slice(0, 3).map(poiSummary).join("; ")}` : "POIs: no driver-service POIs returned.",
        ].join(" "),
        mode: "fleet_contract_plan",
        severity: parking.parking?.length || pois.pois?.length ? "info" : "warning",
        layerId: "parking",
        metrics: {
          parkingCount: parking.count ?? 0,
          parkingSpots: parking.totalSpotsWithinRadius ?? null,
          poiCount: pois.total ?? 0,
          amenityProbe: stopPoints.length > 0 ? "first simulated charge stop" : "route midpoint fallback",
        },
      },
      {
        id: "fleet-gap-classification",
        title: trueGap ? "True Class 8 gap" : "Class 8 gap classification",
        summary: trueGap
          ? `No on-corridor Class 8 charger was found; recommend mobile CaaS support near ${supportPointLabel} around ${supportTimeLabel}.`
          : class8Count > 0
            ? `${class8Count} Class 8-capable charger(s) were found within ${formatMiles(CLASS8_GAP_RADIUS_M)} of sampled route points.`
            : `No on-corridor Class 8 charger was found, but nearest distance ${formatMiles(gap?.closestClass8DistanceM)} is in detour review range.`,
        mode: "fleet_contract_plan",
        severity: trueGap ? "critical" : class8Count > 0 ? "success" : "warning",
        layerId: "class8-gaps",
        metrics: {
          gapClassification,
          class8WithinCorridor: class8Count,
          closestClass8Miles: round(metersToMiles(gap?.closestClass8DistanceM ?? null), 1),
          sampledRoutePoints: corridorPoints.length,
          caasSupportPoint: trueGap ? supportPointLabel : "not recommended",
          caasSupportTime: trueGap ? supportTimeLabel : "not recommended",
        },
        actions: [
          {
            id: trueGap ? "stage-mobile-caas" : "review-gap-inputs",
            label: trueGap ? "Stage mobile CaaS support" : "Review gap evidence",
            kind: trueGap ? "primary" : "secondary",
          },
        ],
      },
    ];

    return {
      id: `fleet-contract-plan-${String(route.metadata?.requestHash ?? Date.now())}`,
      mode: "fleet_contract_plan" as const,
      routeGeometry: route,
      simulation,
      gapAnalysis,
      nearestClass8: destinationNearestClass8,
      fiveClosestChargers: destinationFiveClosest,
      parking,
      pois,
      mapPins,
      resultCards: cards,
      providerWarnings,
      assumptions: [
        "Fleet contract sizing assumes one container turn per round trip.",
        "Trips/truck/day = floor(min(shift hours, gate hours) / modeled round-trip duration).",
        "Drivers required equals trucks required, with a 20% relief factor only when shift length exceeds 10 hours.",
        "Mobile CaaS support point uses route midpoint and early gate-window timing until stop-specific demand timing is available.",
        "Google route geometry is not truck-restriction-certified.",
      ],
    };
  },
});
