import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { components } from "@fleetvolt/shared-types";
import {
  distMToMiles,
  findSegmentIndexByDistanceM,
  segmentsToChartData,
} from "./segment-lookup.js";

type Segment = components["schemas"]["SegmentResult"];

/** Per-segment lengths (simulator contract); cumulative ends at 1k, 5k, 10k m. */
const monotonicSegments: Segment[] = [
  {
    dist_m: 1000,
    soc_pct: 90,
    grade: 0,
    speed: 55,
    energy_kwh: 8,
    charging_event: false,
  },
  {
    dist_m: 4000,
    soc_pct: 70,
    grade: 1,
    speed: 50,
    energy_kwh: 10,
    charging_event: false,
  },
  {
    dist_m: 5000,
    soc_pct: 50,
    grade: 2,
    speed: 45,
    energy_kwh: 12,
    charging_event: false,
  },
];

describe("findSegmentIndexByDistanceM", () => {
  it("test_nearest_segment_at_distance", () => {
    assert.equal(findSegmentIndexByDistanceM(monotonicSegments, 4800), 1);
    assert.equal(findSegmentIndexByDistanceM(monotonicSegments, 1000), 0);
    assert.equal(findSegmentIndexByDistanceM(monotonicSegments, 10000), 2);
  });

  it("test_edge_before_first", () => {
    assert.equal(findSegmentIndexByDistanceM(monotonicSegments, 0), 0);
    assert.equal(findSegmentIndexByDistanceM([], 100), -1);
  });
});

describe("distMToMiles", () => {
  it("test_miles_conversion", () => {
    const miles = distMToMiles(1609.34);
    assert.ok(Math.abs(miles - 1) < 0.001);
  });
});

describe("segmentsToChartData", () => {
  it("maps cumulative distance in miles for chart axis", () => {
    const data = segmentsToChartData(monotonicSegments);
    assert.equal(data.length, monotonicSegments.length);
    assert.ok(Math.abs(data[0]!.distMi - distMToMiles(1000)) < 0.001);
    assert.ok(Math.abs(data[2]!.distMi - distMToMiles(10000)) < 0.001);
  });
});
