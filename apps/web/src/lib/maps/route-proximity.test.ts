import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessRouteProximity,
  distanceToPolylineM,
  nearestPointOnPolyline,
  ON_ROUTE_MAX_M,
} from "./route-proximity";

describe("route-proximity", () => {
  const polbToBarstow = [
    { lat: 33.7542, lng: -118.2165 },
    { lat: 34.1064, lng: -117.5931 },
    { lat: 34.8958, lng: -117.0173 },
  ];

  it("marks points near the polyline as on-route", () => {
    const mid = { lat: 34.1064, lng: -117.5931 };
    const proximity = assessRouteProximity(mid, polbToBarstow);
    assert.equal(proximity.onRoute, true);
    assert.equal(proximity.label, "ON ROUTE");
    assert.ok(proximity.distanceM <= ON_ROUTE_MAX_M);
  });

  it("labels far points as DETOUR with miles", () => {
    // Roughly 50+ miles west of the corridor.
    const far = { lat: 34.1, lng: -119.5 };
    const distanceM = distanceToPolylineM(far, polbToBarstow);
    assert.ok(distanceM > ON_ROUTE_MAX_M);

    const proximity = assessRouteProximity(far, polbToBarstow);
    assert.equal(proximity.onRoute, false);
    assert.match(proximity.label, /^DETOUR .+ off route$/);
  });

  it("finds a junction point on the corridor for detour spurs", () => {
    const far = { lat: 34.1, lng: -119.5 };
    const nearest = nearestPointOnPolyline(far, polbToBarstow);
    assert.ok(nearest);
    assert.ok(nearest!.distanceM > ON_ROUTE_MAX_M);
    // Junction should lie near the mid corridor vertex for this geometry.
    assert.ok(Math.abs(nearest!.point.lat - 34.1064) < 0.5);
  });
});
