/**
 * PTV Developer Routing API — Class-8 truck geometry.
 * Port of services/simulator/app/simulation/route_provider.py (P11-04).
 */
import {
  downsampleRouteCoordinates,
  getRouteRequestHash,
  routeGeometryFallback,
  type RouteGeometryRequest,
  type RouteGeometryResult,
  type RoutePoint,
} from "./google-routes";

export const PTV_TRUCK_ROUTE_NOTE =
  "PTV Class-8 truck profile (USA_8_SEMITRAILER_5AXLE)";

const PTV_BASE_URL =
  process.env.PTV_ROUTING_URL?.replace(/\/$/, "") ??
  "https://api.myptv.com/routing/v1";

const PTV_TRUCK_PROFILE = "USA_8_SEMITRAILER_5AXLE";

/** eCascadia / Class-8 semitrailer vehicle params (PTV units). */
const CLASS8_VEHICLE = {
  height: 411, // cm
  totalPermittedWeight: 36287, // kg
  numberOfAxles: 5,
  length: 2200, // cm
  width: 259, // cm
};

type PtvRoutesOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

type PtvRoutePayload = {
  distance?: number;
  travelTime?: number;
  polyline?:
    | string
    | {
        type?: string;
        coordinates?: Array<[number, number] | number[]>;
      };
};

function isFiniteCoordinate(value: RoutePoint): boolean {
  return (
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

/** Decode Google-encoded polyline (precision 6) → lat/lng RoutePoints. */
export function decodePtvEncodedPolyline(
  encoded: string,
  precision = 6,
): RoutePoint[] {
  const factor = 10 ** precision;
  const coordinates: RoutePoint[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lon += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({
      latitude: Number((lat / factor).toFixed(6)),
      longitude: Number((lon / factor).toFixed(6)),
    });
  }
  return coordinates;
}

/** Parse PTV /routes RouteResponse into RouteGeometryResult fields. */
export function parsePtvRoutePayload(payload: PtvRoutePayload): {
  coordinates: RoutePoint[];
  distanceMeters: number;
  durationSeconds: number;
} {
  if (
    typeof payload.distance !== "number" ||
    typeof payload.travelTime !== "number"
  ) {
    throw new Error("Unexpected PTV route response: missing distance/travelTime");
  }

  const distanceMeters = payload.distance;
  const durationSeconds = Math.round(payload.travelTime);
  let pl: unknown = payload.polyline;

  if (typeof pl === "string") {
    const encodedPolyline = pl;
    try {
      pl = JSON.parse(encodedPolyline) as unknown;
    } catch {
      const coordinates = decodePtvEncodedPolyline(encodedPolyline, 6);
      if (coordinates.length < 2) {
        throw new Error("PTV encoded polyline decoded to fewer than 2 points");
      }
      return { coordinates, distanceMeters, durationSeconds };
    }
  }

  if (
    pl &&
    typeof pl === "object" &&
    Array.isArray((pl as { coordinates?: unknown }).coordinates)
  ) {
    const raw = (pl as { coordinates: Array<[number, number] | number[]> })
      .coordinates;
    const coordinates: RoutePoint[] = [];
    for (const point of raw) {
      if (Array.isArray(point) && point.length >= 2) {
        // GeoJSON is [lon, lat]
        coordinates.push({
          latitude: Number(point[1]),
          longitude: Number(point[0]),
        });
      }
    }
    if (coordinates.length < 2) {
      throw new Error("PTV GeoJSON polyline had fewer than 2 points");
    }
    return { coordinates, distanceMeters, durationSeconds };
  }

  throw new Error("Unexpected PTV route response: unrecognized polyline");
}

export async function fetchPtvRouteGeometry(
  request: RouteGeometryRequest,
  options: PtvRoutesOptions,
): Promise<RouteGeometryResult> {
  const origin = request.origin;
  const destination = request.destination;
  const waypoints = request.waypoints ?? [];
  const requestHash = await getRouteRequestHash({
    ...request,
    provider: "ptv",
  });

  if (!isFiniteCoordinate(origin) || !isFiniteCoordinate(destination)) {
    return routeGeometryFallback(
      { ...request, provider: "ptv" },
      "Route origin or destination coordinates are invalid",
      { requestHash },
    );
  }

  if (!options.apiKey) {
    return routeGeometryFallback(
      { ...request, provider: "ptv" },
      "PTV_DEVELOPER_API_KEY is not configured",
      { requestHash },
    );
  }

  // PTV waypoint format is "lat,lon"
  const waypointParams = [
    `${origin.latitude},${origin.longitude}`,
    ...waypoints.map((w) => `${w.latitude},${w.longitude}`),
    `${destination.latitude},${destination.longitude}`,
  ];

  const params = new URLSearchParams();
  for (const wp of waypointParams) {
    params.append("waypoints", wp);
  }
  params.set("profile", PTV_TRUCK_PROFILE);
  params.set("results", "POLYLINE");
  params.set("options[polylineFormat]", "GEO_JSON");
  params.set("vehicle[height]", String(CLASS8_VEHICLE.height));
  params.set(
    "vehicle[totalPermittedWeight]",
    String(CLASS8_VEHICLE.totalPermittedWeight),
  );
  params.set("vehicle[numberOfAxles]", String(CLASS8_VEHICLE.numberOfAxles));
  params.set("vehicle[length]", String(CLASS8_VEHICLE.length));
  params.set("vehicle[width]", String(CLASS8_VEHICLE.width));

  const baseUrl = (options.baseUrl ?? PTV_BASE_URL).replace(/\/$/, "");
  const url = `${baseUrl}/routes?${params.toString()}`;
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { apiKey: options.apiKey },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      return routeGeometryFallback(
        { ...request, provider: "ptv" },
        `PTV Routes request failed: ${response.status} ${text.slice(0, 160)}`,
        { requestHash },
      );
    }

    const data = (await response.json()) as PtvRoutePayload;
    const parsed = parsePtvRoutePayload(data);
    const coordinates = downsampleRouteCoordinates(parsed.coordinates);

    return {
      provider: "ptv",
      coordinates,
      distanceMeters: parsed.distanceMeters,
      durationSeconds: parsed.durationSeconds,
      warnings: [PTV_TRUCK_ROUTE_NOTE],
      metadata: {
        requestHash,
        cacheStatus: "miss",
        coordinateCountRaw: parsed.coordinates.length,
        coordinateCountReturned: coordinates.length,
        profile: PTV_TRUCK_PROFILE,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return routeGeometryFallback(
      { ...request, provider: "ptv" },
      `PTV Routes request failed: ${message}`,
      { requestHash },
    );
  }
}
