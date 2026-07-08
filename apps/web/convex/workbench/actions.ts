import { v } from "convex/values";
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
