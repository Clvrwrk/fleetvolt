import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRouteRequestHash } from "../../src/lib/maps/google-routes";
import {
  PTV_REFRESH_LEASE_MS,
  PTV_ROUTE_TTL_MS,
  cacheAgeDays,
  cacheDisposition,
  hasUsableRoadGeometry,
} from "./cachePolicy";

const NOW = Date.UTC(2026, 6, 11);
const road = Array.from({ length: 8 }, (_, index) => ({
  latitude: 33.75 + index * 0.01,
  longitude: -118.21 + index * 0.01,
}));

describe("PTV route cache policy", () => {
  it("treats geometry as fresh until, but not including, the 90-day boundary", () => {
    assert.equal(cacheDisposition({ coordinates: road, expiresAt: NOW + 1 }, NOW), "fresh");
    assert.equal(cacheDisposition({ coordinates: road, expiresAt: NOW }, NOW), "refresh-owner");
    assert.equal(PTV_ROUTE_TTL_MS, 7_776_000_000);
  });

  it("serves usable stale geometry while another caller owns the lease", () => {
    assert.equal(
      cacheDisposition({ coordinates: road, expiresAt: NOW - 1, refreshLeaseUntil: NOW + PTV_REFRESH_LEASE_MS }, NOW),
      "stale-refreshing",
    );
  });

  it("allows refresh after the lease expires", () => {
    assert.equal(
      cacheDisposition({ coordinates: road, expiresAt: NOW - 1, refreshLeaseUntil: NOW }, NOW),
      "refresh-owner",
    );
  });

  it("never treats endpoint-only geometry as a usable road route", () => {
    assert.equal(hasUsableRoadGeometry({ coordinates: road }), true);
    assert.equal(hasUsableRoadGeometry({ coordinates: road.slice(0, 2) }), false);
  });

  it("keeps direction in the canonical request identity", async () => {
    const a = { latitude: 33.7542, longitude: -118.2165 };
    const b = { latitude: 35.5005, longitude: -119.2718 };
    const outbound = await getRouteRequestHash({ origin: a, destination: b, provider: "ptv" });
    const inbound = await getRouteRequestHash({ origin: b, destination: a, provider: "ptv" });
    assert.notEqual(outbound, inbound);
  });

  it("reports whole non-negative cache age days", () => {
    assert.equal(cacheAgeDays(NOW - 3.9 * 86_400_000, NOW), 3);
    assert.equal(cacheAgeDays(NOW + 86_400_000, NOW), 0);
  });
});
