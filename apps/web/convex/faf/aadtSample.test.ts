import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateTruckAadt,
  bboxFromPath,
  nearestTruckAadt,
  samplePathVertices,
  tierFromTruckAadtMean,
} from "./aadtSample";

describe("aadtSample", () => {
  it("samples path endpoints and midpoints", () => {
    const path = Array.from({ length: 100 }, (_, i) => ({
      lat: 33 + i * 0.01,
      lng: -118 + i * 0.01,
    }));
    const sampled = samplePathVertices(path, 5);
    assert.equal(sampled.length, 5);
    assert.deepEqual(sampled[0], path[0]);
    assert.deepEqual(sampled[4], path[99]);
  });

  it("finds nearest truck AADT within radius", () => {
    const candidates = [
      {
        location: { lat: 34.0, lng: -117.0 },
        truckAADT: 500,
        route: "15",
      },
      {
        location: { lat: 34.1, lng: -117.1 },
        truckAADT: 2000,
        route: "15",
      },
    ];
    const near = nearestTruckAadt({ lat: 34.01, lng: -117.01 }, candidates, 50_000);
    assert.equal(near, 500);
  });

  it("aggregates stats and tiers", () => {
    const stats = aggregateTruckAadt([100, 200, 300, 400, 5000]);
    assert.ok(stats);
    assert.equal(stats!.min, 100);
    assert.equal(stats!.max, 5000);
    assert.equal(stats!.sampleCount, 5);
    assert.equal(tierFromTruckAadtMean(1500), "heavy");
    assert.equal(tierFromTruckAadtMean(500), "medium");
    assert.equal(tierFromTruckAadtMean(100), "low");
  });

  it("builds bbox from path", () => {
    const bbox = bboxFromPath([
      { lat: 33, lng: -118 },
      { lat: 36, lng: -115 },
    ]);
    assert.equal(bbox.minLat, 33);
    assert.equal(bbox.maxLat, 36);
    assert.equal(bbox.minLng, -118);
    assert.equal(bbox.maxLng, -115);
  });
});
