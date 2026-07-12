import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRouteManifest,
  dedupeRecentRoutes,
  directionalRouteKey,
} from "./catalogPolicy";

const port = { label: "POLB", latitude: 33.754, longitude: -118.216 };
const yard = { label: "Yard", latitude: 34.1, longitude: -117.9 };

test("directional keys keep reverse routes distinct", () => {
  assert.notEqual(
    directionalRouteKey(port, yard),
    directionalRouteKey(yard, port),
  );
});

test("recent routes keep newest directional occurrence and require a hash", () => {
  const result = dedupeRecentRoutes([
    { origin: port, destination: yard, requestHash: "new", createdAt: 3 },
    { origin: port, destination: yard, requestHash: "old", createdAt: 2 },
    { origin: yard, destination: port, requestHash: "reverse", createdAt: 1 },
    { origin: port, destination: yard, createdAt: 4 },
  ]);
  assert.deepEqual(result.map((row) => row.requestHash), ["new", "reverse"]);
});

test("manifest reports road, traffic, Class 8, and stale state", () => {
  assert.deepEqual(
    buildRouteManifest({
      distanceMeters: 160_934.4,
      enrichmentSnapshot: {
        traffic: { statistics: { p90: 13_420 } },
        chargers: { class8WithinCorridor: 3 },
      },
      enrichmentExpiresAt: 99,
      now: 100,
    }),
    { road: "100 mi", traffic: "p90 13.4K", charge: "3 Class 8", stale: true },
  );
});
