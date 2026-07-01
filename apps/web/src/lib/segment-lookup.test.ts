import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { components } from "@fleetvolt/shared-types";
import { findSegmentIndexByDistanceM } from "./segment-lookup.js";

type Segment = components["schemas"]["SegmentResult"];

const fixtureSegments: Segment[] = [
  {
    dist_m: 1000,
    soc_pct: 90,
    grade: 0,
    speed: 55,
    energy_kwh: 8,
    charging_event: false,
  },
  {
    dist_m: 5000,
    soc_pct: 70,
    grade: 1,
    speed: 50,
    energy_kwh: 10,
    charging_event: false,
  },
  {
    dist_m: 10000,
    soc_pct: 50,
    grade: 2,
    speed: 45,
    energy_kwh: 12,
    charging_event: false,
  },
];

describe("findSegmentIndexByDistanceM", () => {
  it("test_nearest_segment", () => {
    assert.equal(findSegmentIndexByDistanceM(fixtureSegments, 4800), 1);
    assert.equal(findSegmentIndexByDistanceM(fixtureSegments, 1000), 0);
    assert.equal(findSegmentIndexByDistanceM(fixtureSegments, 10000), 2);
  });
});
