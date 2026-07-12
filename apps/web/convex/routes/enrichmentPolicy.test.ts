import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ENRICHMENT_TTL_MS,
  aadtStatistics,
  cacheDisposition,
  coverage,
  dedupeNearest,
  expandedRouteBbox,
  polylineDistanceM,
  sampleRoute,
} from "./enrichmentPolicy";

const NOW = Date.UTC(2026, 6, 11, 12);

describe("route enrichment policy", () => {
  it("is fresh until, but not including, the seven-day boundary", () => {
    const row = { hasSnapshot: true, expiresAt: NOW + ENRICHMENT_TTL_MS };
    assert.equal(cacheDisposition(row, NOW + ENRICHMENT_TTL_MS - 1), "fresh");
    assert.equal(cacheDisposition(row, NOW + ENRICHMENT_TTL_MS), "refresh-owner");
  });

  it("serves stale while a different caller owns the refresh lease", () => {
    assert.equal(
      cacheDisposition(
        { hasSnapshot: true, expiresAt: NOW - 1, refreshLeaseUntil: NOW + 60_000 },
        NOW,
      ),
      "stale-refreshing",
    );
  });

  it("samples the complete road path with stable endpoints", () => {
    const route = Array.from({ length: 101 }, (_, index) => ({
      lat: 33 + index / 100,
      lng: -118 + index / 100,
    }));
    const sampled = sampleRoute(route, 16);
    assert.equal(sampled.length, 16);
    assert.deepEqual(sampled[0], route[0]);
    assert.deepEqual(sampled.at(-1), route.at(-1));
    assert.equal(new Set(sampled.map((point) => `${point.lat},${point.lng}`)).size, 16);
  });

  it("expands a route bbox beyond every road vertex", () => {
    const bbox = expandedRouteBbox(
      [
        { lat: 33.75, lng: -118.22 },
        { lat: 35.5, lng: -119.27 },
      ],
      2_000,
    );
    assert.ok(bbox.minLat < 33.75);
    assert.ok(bbox.maxLat > 35.5);
    assert.ok(bbox.minLng < -119.27);
    assert.ok(bbox.maxLng > -118.22);
  });

  it("measures polyline proximity instead of endpoint distance", () => {
    const plannedRoad = [
      { lat: 33.75, lng: -118.2 },
      { lat: 34, lng: -118.2 },
      { lat: 34.25, lng: -118.2 },
    ];
    const crossingRoad = [
      { lat: 34, lng: -118.4 },
      { lat: 34, lng: -118 },
    ];
    assert.ok(polylineDistanceM(plannedRoad, crossingRoad) < 100);
  });

  it("computes AADT stats only from measured numeric values", () => {
    assert.deepEqual(aadtStatistics([100, null, 300, undefined, 200]), {
      min: 100,
      max: 300,
      mean: 200,
      p90: 300,
      sampleCount: 3,
    });
    assert.equal(aadtStatistics([null, undefined]), null);
  });

  it("deduplicates assets and keeps their closest road distance", () => {
    const rows = dedupeNearest(
      [
        { id: "A", distanceM: 900, value: 1 },
        { id: "A", distanceM: 200, value: 2 },
        { id: "B", distanceM: 400, value: 3 },
      ],
      (row) => row.id,
    );
    assert.deepEqual(rows.map((row) => [row.id, row.distanceM]), [
      ["A", 200],
      ["B", 400],
    ]);
  });

  it("distinguishes unavailable source data from a measured empty corridor", () => {
    assert.equal(coverage(false, 0, "AFDC", "route_proximity").state, "unavailable");
    assert.equal(coverage(true, 0, "AFDC", "route_proximity").state, "available");
  });
});
