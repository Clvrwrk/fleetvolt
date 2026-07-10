import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateTruckAadt,
  bboxFromPath,
  nearestTruckAadt,
  samplePathVertices,
  tierFromAadtPercentile,
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
    // Contract: idx = round(i / (maxSamples-1) * last) for i in 0..4 → 0,25,50,74,99
    assert.deepEqual(sampled[0], path[0]);
    assert.deepEqual(sampled[1], path[25]);
    assert.deepEqual(sampled[2], path[50]);
    assert.deepEqual(sampled[3], path[74]);
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

  it("returns no match when all candidates are beyond radius", () => {
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
    // ~1.4 km to nearest candidate — 100 m radius must miss.
    const none = nearestTruckAadt({ lat: 34.01, lng: -117.01 }, candidates, 100);
    assert.equal(none, null);
  });

  it("aggregates stats and tiers", () => {
    const stats = aggregateTruckAadt([100, 200, 300, 400, 5000]);
    assert.ok(stats);
    assert.equal(stats!.min, 100);
    assert.equal(stats!.max, 5000);
    assert.equal(stats!.sampleCount, 5);
    assert.equal(tierFromTruckAadtMean(6000), "heavy");
    assert.equal(tierFromTruckAadtMean(2000), "medium");
    assert.equal(tierFromTruckAadtMean(500), "low");
    assert.equal(tierFromTruckAadtMean(100), "low");
  });

  it("assigns percentile tiers across a high-AADT cohort", () => {
    const sorted = [2000, 2500, 3000, 4000, 5000, 8000];
    assert.equal(tierFromAadtPercentile(2000, sorted), "low");
    assert.equal(tierFromAadtPercentile(3000, sorted), "medium");
    assert.equal(tierFromAadtPercentile(8000, sorted), "heavy");
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
