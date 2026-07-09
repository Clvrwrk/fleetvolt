export const GOOGLE_TRUCK_ROUTE_WARNING =
  "Google route geometry is not truck-restriction-certified";

export type RouteGeometryProvider = "google" | "ptv" | "valhalla" | "mock";

export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type RouteGeometryRequest = {
  origin: RoutePoint;
  destination: RoutePoint;
  waypoints?: RoutePoint[];
  provider?: RouteGeometryProvider;
};

export type RouteGeometryResult = {
  provider: RouteGeometryProvider;
  coordinates: RoutePoint[];
  distanceMeters?: number;
  durationSeconds?: number;
  encodedPolyline?: string;
  warnings: string[];
  metadata?: Record<string, unknown>;
};

type GoogleRoutesOptions = {
  apiKey: string;
  fetchImpl?: typeof fetch;
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

type GoogleRoutesRequest = {
  origin: { location: { latLng: RoutePoint } };
  destination: { location: { latLng: RoutePoint } };
  intermediates?: Array<{ location: { latLng: RoutePoint } }>;
  travelMode: "DRIVE";
  routingPreference: "TRAFFIC_AWARE";
  computeAlternativeRoutes: false;
  polylineQuality: "HIGH_QUALITY";
  polylineEncoding: "ENCODED_POLYLINE";
  units: "IMPERIAL";
};

const GOOGLE_ROUTES_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";
const GOOGLE_ROUTES_FIELD_MASK =
  "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.localizedValues";

const routeGeometryCache = new Map<string, RouteGeometryResult>();

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

function normalizeCoordinate(value: RoutePoint): RoutePoint {
  return {
    latitude: Number(value.latitude.toFixed(6)),
    longitude: Number(value.longitude.toFixed(6)),
  };
}

function canonicalizeRouteRequest(
  request: RouteGeometryRequest,
): Required<Pick<RouteGeometryRequest, "origin" | "destination" | "provider">> & {
  waypoints: RoutePoint[];
} {
  return {
    provider: request.provider ?? "google",
    origin: normalizeCoordinate(request.origin),
    destination: normalizeCoordinate(request.destination),
    waypoints: (request.waypoints ?? []).map(normalizeCoordinate),
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function getRouteRequestHash(
  request: RouteGeometryRequest,
): Promise<string> {
  const canonical = canonicalizeRouteRequest(request);
  const payload = JSON.stringify(canonical);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(payload),
  );
  return bytesToHex(new Uint8Array(digest));
}

export function toConvexRouteGeometryArgs(
  request: RouteGeometryRequest,
): RouteGeometryRequest {
  return canonicalizeRouteRequest(request);
}

/** Convex arrays max out at 8192 items — keep road polylines under that.
 *  Prefer ~800 for fast client transfer while still looking road-accurate. */
export const MAX_ROUTE_COORDINATES = 800;

/** Evenly sample a dense polyline while always keeping endpoints. */
export function downsampleRouteCoordinates(
  coordinates: RoutePoint[],
  maxPoints = MAX_ROUTE_COORDINATES,
): RoutePoint[] {
  if (coordinates.length <= maxPoints) return coordinates;
  if (maxPoints < 2) return coordinates.slice(0, maxPoints);

  const lastIndex = coordinates.length - 1;
  const sampled: RoutePoint[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const index = Math.round((i / (maxPoints - 1)) * lastIndex);
    const point = coordinates[index]!;
    const prev = sampled[sampled.length - 1];
    if (
      !prev ||
      prev.latitude !== point.latitude ||
      prev.longitude !== point.longitude
    ) {
      sampled.push(point);
    }
  }
  return sampled;
}

export function decodeGoogleEncodedPolyline(encoded: string): RoutePoint[] {
  const coordinates: RoutePoint[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({
      latitude: Number((latitude / 1e5).toFixed(6)),
      longitude: Number((longitude / 1e5).toFixed(6)),
    });
  }

  return coordinates;
}

export function routeGeometryFallback(
  request: RouteGeometryRequest,
  warning: string,
  metadata: Record<string, unknown> = {},
): RouteGeometryResult {
  const provider = request.provider ?? "google";
  const warnings =
    provider === "google" ? [GOOGLE_TRUCK_ROUTE_WARNING, warning] : [warning];

  return {
    provider,
    coordinates: [],
    warnings,
    metadata: {
      ...metadata,
      fallback: true,
    },
  };
}

export function buildGoogleRoutesRequest(
  request: RouteGeometryRequest,
  apiKey: string,
): {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
} {
  const canonical = canonicalizeRouteRequest(request);
  const body: GoogleRoutesRequest = {
    origin: { location: { latLng: canonical.origin } },
    destination: { location: { latLng: canonical.destination } },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    computeAlternativeRoutes: false,
    polylineQuality: "HIGH_QUALITY",
    polylineEncoding: "ENCODED_POLYLINE",
    units: "IMPERIAL",
  };

  if (canonical.waypoints.length > 0) {
    body.intermediates = canonical.waypoints.map((waypoint) => ({
      location: { latLng: waypoint },
    }));
  }

  return {
    url: GOOGLE_ROUTES_URL,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_ROUTES_FIELD_MASK,
    },
    body: JSON.stringify(body),
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

export async function fetchGoogleRouteGeometry(
  request: RouteGeometryRequest,
  options: GoogleRoutesOptions,
): Promise<RouteGeometryResult> {
  const canonical = canonicalizeRouteRequest(request);
  const provider = canonical.provider;
  const requestHash = await getRouteRequestHash(canonical);

  if (provider !== "google") {
    return routeGeometryFallback(canonical, `${provider.toUpperCase()} route geometry provider is not configured yet`, {
      requestHash,
    });
  }

  if (!isFiniteCoordinate(canonical.origin) || !isFiniteCoordinate(canonical.destination)) {
    return routeGeometryFallback(canonical, "Route origin or destination coordinates are invalid", {
      requestHash,
    });
  }

  if (!options.apiKey) {
    return routeGeometryFallback(canonical, "Google Routes API key is not configured", {
      requestHash,
    });
  }

  const cached = routeGeometryCache.get(requestHash);
  if (cached) {
    return {
      ...cached,
      metadata: {
        ...(cached.metadata ?? {}),
        cacheStatus: "hit",
      },
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const googleRequest = buildGoogleRoutesRequest(canonical, options.apiKey);

  try {
    const response = await fetchImpl(googleRequest.url, {
      method: googleRequest.method,
      headers: googleRequest.headers,
      body: googleRequest.body,
    });

    if (!response.ok) {
      const message = await readGoogleError(response);
      return routeGeometryFallback(
        canonical,
        `Google Routes request failed: ${response.status} ${message}`,
        { requestHash },
      );
    }

    const data = (await response.json()) as GoogleRouteResponse;
    const route = data.routes?.[0];
    const encodedPolyline = route?.polyline?.encodedPolyline;

    if (!route || !encodedPolyline) {
      return routeGeometryFallback(
        canonical,
        "Google Routes returned no route geometry",
        { requestHash },
      );
    }

    const decoded = decodeGoogleEncodedPolyline(encodedPolyline);
    const result: RouteGeometryResult = {
      provider: "google",
      coordinates: downsampleRouteCoordinates(decoded),
      distanceMeters: route.distanceMeters,
      durationSeconds: parseGoogleDurationSeconds(route.duration),
      encodedPolyline,
      warnings: [GOOGLE_TRUCK_ROUTE_WARNING],
      metadata: {
        requestHash,
        cacheStatus: "miss",
        coordinateCountRaw: decoded.length,
        coordinateCountReturned: Math.min(decoded.length, MAX_ROUTE_COORDINATES),
      },
    };

    routeGeometryCache.set(requestHash, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return routeGeometryFallback(canonical, `Google Routes request failed: ${message}`, {
      requestHash,
    });
  }
}

export function clearGoogleRouteGeometryCacheForTests(): void {
  routeGeometryCache.clear();
}
