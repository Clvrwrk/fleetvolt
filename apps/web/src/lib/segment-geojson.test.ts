import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { components } from "@fleetvolt/shared-types";
import { buildSocGradientExpression, socColor } from "./segment-geojson.js";

type Segment = components["schemas"]["SegmentResult"];

const fixtureSegments: Segment[] = [
  {
    dist_m: 5000,
    soc_pct: 50,
    grade: 0,
    speed: 55,
    energy_kwh: 12,
    charging_event: false,
  },
  {
    dist_m: 10000,
    soc_pct: 35,
    grade: 2,
    speed: 50,
    energy_kwh: 15,
    charging_event: false,
  },
  {
    dist_m: 15000,
    soc_pct: 15,
    grade: -1,
    speed: 45,
    energy_kwh: 18,
    charging_event: false,
  },
];

describe("socColor", () => {
  it("uses D-05 three-band thresholds", () => {
    assert.equal(socColor(41), "#16A34A");
    assert.equal(socColor(40), "#D97706");
    assert.equal(socColor(20), "#D97706");
    assert.equal(socColor(19), "#DC2626");
  });
});

describe("buildSocGradientExpression", () => {
  it("test_soc_gradient_stops", () => {
    const expr = buildSocGradientExpression(fixtureSegments, 20000);

    assert.equal(expr[0], "step");
    assert.deepEqual(expr[1], ["line-progress"]);
    assert.equal(expr[2], "#16A34A");
    assert.ok(expr.includes(0.25));
    assert.ok(expr.includes("#D97706"));
    assert.ok(expr.includes("#DC2626"));
  });
});
