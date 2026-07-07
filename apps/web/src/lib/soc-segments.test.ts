import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { components } from "@fleetvolt/shared-types";
import { buildActiveCasingPath, buildSocPolylines } from "./soc-segments.js";
import type { RouteCoordinates } from "./route-geometry.js";

type Segment = components["schemas"]["SegmentResult"];

function seg(dist_m: number, soc_pct: number): Segment {
  return {
    dist_m,
    soc_pct,
    grade: 0,
    speed: 55,
    energy_kwh: 10,
    charging_event: false,
  };
}

/**
 * Monotonic SoC descent crossing BOTH legend thresholds:
 * 80% (>40 → green), 50% (>40 → green), 30% (20–40 → amber), 10% (<20 → red).
 */
const descentSegments: Segment[] = [
  seg(1000, 80),
  seg(1000, 50),
  seg(1000, 30),
  seg(1000, 10),
];
const totalDistM = 4000;

/** A straight-ish route with plenty of vertices so turf slicing is stable. */
const routeCoords: RouteCoordinates = Array.from({ length: 41 }, (_, i) => [
  -118 + i * 0.025,
  34,
]);

const GREEN = "#16A34A";
const AMBER = "#D97706";
const RED = "#DC2626";

describe("buildSocPolylines", () => {
  it("emits one polyline per segment colored from the SoC ramp at legend thresholds", () => {
    const polylines = buildSocPolylines(routeCoords, descentSegments, totalDistM);
    assert.equal(polylines.length, descentSegments.length);
    assert.deepEqual(
      polylines.map((p) => p.strokeColor),
      [GREEN, GREEN, AMBER, RED],
      "monotonic descent should transition green→amber→red at 40/20 thresholds",
    );
  });

  it("preserves endpoint continuity (each polyline starts where the previous ended)", () => {
    const polylines = buildSocPolylines(routeCoords, descentSegments, totalDistM);
    for (let i = 1; i < polylines.length; i += 1) {
      const prevLast = polylines[i - 1]!.path[polylines[i - 1]!.path.length - 1]!;
      const currFirst = polylines[i]!.path[0]!;
      assert.deepEqual(
        currFirst,
        prevLast,
        `polyline ${i} must share its start vertex with polyline ${i - 1}'s end`,
      );
    }
    // Every polyline is a real 2+ vertex line.
    for (const p of polylines) {
      assert.ok(p.path.length >= 2, "each polyline must have >=2 vertices");
    }
  });

  it("returns [] for degenerate input without throwing", () => {
    assert.deepEqual(buildSocPolylines([], descentSegments, totalDistM), []);
    assert.deepEqual(buildSocPolylines(routeCoords, [], totalDistM), []);
    assert.deepEqual(buildSocPolylines(routeCoords, descentSegments, 0), []);
    assert.deepEqual(
      buildSocPolylines([[-118, 34]], descentSegments, totalDistM),
      [],
    );
  });
});

describe("buildActiveCasingPath", () => {
  it("derives the casing path for a valid active segment index", () => {
    const casing = buildActiveCasingPath(routeCoords, descentSegments, 1, totalDistM);
    assert.ok(casing.length >= 2, "casing should span the active segment");
    for (const pt of casing) {
      assert.equal(typeof pt.lat, "number");
      assert.equal(typeof pt.lng, "number");
    }
  });

  it("returns [] for index -1 (no active segment) and out-of-range", () => {
    assert.deepEqual(
      buildActiveCasingPath(routeCoords, descentSegments, -1, totalDistM),
      [],
    );
    assert.deepEqual(
      buildActiveCasingPath(routeCoords, descentSegments, 99, totalDistM),
      [],
    );
  });

  it("returns [] for degenerate input without throwing", () => {
    assert.deepEqual(buildActiveCasingPath([], descentSegments, 0, totalDistM), []);
    assert.deepEqual(buildActiveCasingPath(routeCoords, descentSegments, 0, 0), []);
  });
});
