import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  GOOGLE_TRUCK_ROUTE_WARNING,
  buildGoogleRoutesRequest,
  decodeGoogleEncodedPolyline,
  fetchGoogleRouteGeometry,
  getRouteRequestHash,
  routeGeometryFallback,
  toConvexRouteGeometryArgs,
} from "./google-routes";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("google-routes", () => {
  it("decodes Google encoded polylines into latitude/longitude coordinates", () => {
    assert.deepEqual(decodeGoogleEncodedPolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@"), [
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });

  it("builds server-side Google Routes requests without leaking the API key into the body or URL", async () => {
    const args = toConvexRouteGeometryArgs({
      origin: { latitude: 33.7542, longitude: -118.2165 },
      destination: { latitude: 34.3133, longitude: -117.4747 },
      provider: "google",
    });
    const request = buildGoogleRoutesRequest(args, "secret-google-key");

    assert.equal(request.url, "https://routes.googleapis.com/directions/v2:computeRoutes");
    assert.equal(request.headers["X-Goog-Api-Key"], "secret-google-key");
    assert.equal(request.headers["X-Goog-FieldMask"], "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.localizedValues");
    assert.equal(request.body.includes("secret-google-key"), false);
    assert.equal(request.url.includes("secret-google-key"), false);
    assert.deepEqual(JSON.parse(request.body), {
      origin: { location: { latLng: { latitude: 33.7542, longitude: -118.2165 } } },
      destination: { location: { latLng: { latitude: 34.3133, longitude: -117.4747 } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
      polylineQuality: "HIGH_QUALITY",
      polylineEncoding: "ENCODED_POLYLINE",
      units: "IMPERIAL",
    });
  });

  it("fetches Google Routes geometry, propagates honest warnings, and reuses cache by request hash", async () => {
    const fetchCalls: string[] = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push(`${url} ${JSON.stringify(init)}`);
      return new Response(
        JSON.stringify({
          routes: [
            {
              distanceMeters: 12345,
              duration: "678s",
              polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const request = {
      origin: { latitude: 38.5, longitude: -120.2 },
      destination: { latitude: 43.252, longitude: -126.453 },
      provider: "google" as const,
    };

    const first = await fetchGoogleRouteGeometry(request, { apiKey: "server-only-key" });
    const second = await fetchGoogleRouteGeometry(request, { apiKey: "server-only-key" });

    assert.equal(first.provider, "google");
    assert.deepEqual(first.coordinates, [
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
    assert.equal(first.distanceMeters, 12345);
    assert.equal(first.durationSeconds, 678);
    assert.equal(first.encodedPolyline, "_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    assert.equal(first.metadata?.requestHash, await getRouteRequestHash(request));
    assert.equal(second.metadata?.cacheStatus, "hit");
    assert.deepEqual(first.warnings, [GOOGLE_TRUCK_ROUTE_WARNING]);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0]?.includes("server-only-key"), true);
  });

  it("returns an empty fallback with warnings when Google has no route", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ routes: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const result = await fetchGoogleRouteGeometry(
      {
        origin: { latitude: 33.7542, longitude: -118.2165 },
        destination: { latitude: 34.3133, longitude: -117.4747 },
      },
      { apiKey: "server-only-key" },
    );

    assert.deepEqual(result.coordinates, []);
    assert.equal(result.distanceMeters, undefined);
    assert.equal(result.durationSeconds, undefined);
    assert.equal(result.encodedPolyline, undefined);
    assert.deepEqual(result.warnings, [
      GOOGLE_TRUCK_ROUTE_WARNING,
      "Google Routes returned no route geometry",
    ]);
    assert.equal(result.metadata?.fallback, true);
  });

  it("returns an empty fallback with warnings when Google errors", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { message: "quota exceeded" } }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });

    const result = await fetchGoogleRouteGeometry(
      {
        origin: { latitude: 33.7542, longitude: -118.2165 },
        destination: { latitude: 34.3133, longitude: -117.4747 },
      },
      { apiKey: "server-only-key" },
    );

    assert.deepEqual(result.coordinates, []);
    assert.deepEqual(result.warnings, [
      GOOGLE_TRUCK_ROUTE_WARNING,
      "Google Routes request failed: 429 quota exceeded",
    ]);
    assert.equal(result.metadata?.fallback, true);
  });

  it("keeps a future PTV seam explicit without pretending Google is truck-certified", () => {
    const result = routeGeometryFallback(
      {
        origin: { latitude: 33.7542, longitude: -118.2165 },
        destination: { latitude: 34.3133, longitude: -117.4747 },
        provider: "ptv",
      },
      "PTV route geometry provider is not configured yet",
    );

    assert.equal(result.provider, "ptv");
    assert.deepEqual(result.coordinates, []);
    assert.deepEqual(result.warnings, [
      "PTV route geometry provider is not configured yet",
    ]);
  });
});
