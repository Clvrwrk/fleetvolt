import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodePtvEncodedPolyline,
  parsePtvRoutePayload,
} from "./ptv-routes";

describe("ptv-routes", () => {
  it("parses GeoJSON polyline [lon,lat] pairs", () => {
    const parsed = parsePtvRoutePayload({
      distance: 160934,
      travelTime: 7200.4,
      polyline: {
        type: "LineString",
        coordinates: [
          [-118.2165, 33.7542],
          [-117.5, 34.2],
          [-119.2718, 35.5005],
        ],
      },
    });
    assert.equal(parsed.distanceMeters, 160934);
    assert.equal(parsed.durationSeconds, 7200);
    assert.equal(parsed.coordinates.length, 3);
    assert.equal(parsed.coordinates[0]!.latitude, 33.7542);
    assert.equal(parsed.coordinates[0]!.longitude, -118.2165);
    assert.equal(parsed.coordinates[2]!.latitude, 35.5005);
  });

  it("parses polyline when delivered as JSON string", () => {
    const parsed = parsePtvRoutePayload({
      distance: 1000,
      travelTime: 60,
      polyline: JSON.stringify({
        type: "LineString",
        coordinates: [
          [-118.2, 33.75],
          [-118.1, 33.8],
        ],
      }),
    });
    assert.equal(parsed.coordinates.length, 2);
  });

  it("decodes encoded polyline fallback", () => {
    // Two-point polyline at precision 6 (synthetic short encode via round-trip).
    const pts = decodePtvEncodedPolyline("_p~iF~ps|U_ulLnnqC", 5);
    assert.ok(pts.length >= 1);
  });
});
