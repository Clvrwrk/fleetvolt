import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { components } from "@fleetvolt/shared-types";
import { mergeRouteWithSegments } from "./route-geometry.js";
import {
  buildRouteGeoJsonSource,
  buildSocGradientExpression,
  socColor,
} from "./segment-geojson.js";

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

const fixtureRouteCoords: [number, number][] = [
  [-118.216, 33.754],
  [-117.9, 34.0],
  [-117.47, 34.28],
];

describe("buildSocGradientExpression", () => {
  it("test_soc_gradient_stops", () => {
    const totalDistM = 30000;
    const expr = buildSocGradientExpression(fixtureSegments, totalDistM);

    assert.equal(expr[0], "step");
    assert.deepEqual(expr[1], ["line-progress"]);
    assert.equal(expr[2], "#16A34A");
    assert.ok(expr.includes(0.5));
    assert.ok(expr.includes("#D97706"));
    assert.ok(expr.includes("#DC2626"));
  });

  it("test_gradient_expression_length", () => {
    const totalDistM = 30000;
    const expr = buildSocGradientExpression(fixtureSegments, totalDistM);
    const progressStops = expr.filter(
      (value): value is number => typeof value === "number" && value > 0,
    );

    assert.ok(progressStops.length >= fixtureSegments.length);
  });
});

describe("mergeRouteWithSegments", () => {
  it("test_merge_route_total_distance", () => {
    const merged = mergeRouteWithSegments(fixtureRouteCoords, fixtureSegments, 30500);
    const segmentSum = fixtureSegments.reduce((sum, s) => sum + s.dist_m, 0);

    assert.ok(Math.abs(merged.totalDistM - segmentSum) / segmentSum < 0.01);
    assert.ok(merged.totalDistM > 0);
    assert.equal(merged.routeCoords.length, fixtureRouteCoords.length);
  });
});

describe("buildRouteGeoJsonSource", () => {
  it("returns a LineString feature for Mapbox lineMetrics source", () => {
    const feature = buildRouteGeoJsonSource(fixtureRouteCoords);

    assert.equal(feature.type, "Feature");
    assert.equal(feature.geometry.type, "LineString");
    assert.deepEqual(feature.geometry.coordinates, fixtureRouteCoords);
  });
});
