// Unit tests for the pure haversine/bbox primitives (P12-04 fallback).
//
// Pure unit test — no Convex server import — runs under
//   node --import tsx --test convex/lib/haversine.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  haversineMeters,
  bboxAround,
  bboxContains,
  nearestByHaversine,
  distanceToPolylineM,
  type LatLng,
} from "./haversine";

// Flagship corridor endpoints (from services/simulator + FLAGSHIP).
const POLB = { lat: 33.754, lng: -118.216 };
const SAN_BERNARDINO = { lat: 34.108, lng: -117.29 };
const LA = { lat: 34.0522, lng: -118.2437 };
const SB_CITY = { lat: 34.4208, lng: -119.6982 }; // Santa Barbara

test("haversineMeters: LA <-> Santa Barbara ~130 km great-circle", () => {
  const d = haversineMeters(LA, SB_CITY);
  // straight-line LA↔Santa Barbara is ~133 km; allow a few % band
  assert.ok(d > 120_000 && d < 145_000, `expected ~133km, got ${d}m`);
});

test("haversineMeters: POLB <-> San Bernardino straight-line < road (117.4km) and > 90km", () => {
  const d = haversineMeters(POLB, SAN_BERNARDINO);
  // straight-line MUST be shorter than the 117.4km flagship road distance
  assert.ok(d < 117_400, `straight-line ${d}m should be < 117.4km road`);
  // ...but still a real corridor-scale distance
  assert.ok(d > 90_000, `straight-line ${d}m should be > 90km`);
});

test("haversineMeters: identical points -> 0", () => {
  assert.equal(haversineMeters(POLB, { ...POLB }), 0);
});

test("bboxAround: widths sane at lat 34 (lng span wider than lat span)", () => {
  const r = 8047; // 5 mi
  const b = bboxAround({ lat: 34, lng: -117 }, r);
  const latSpanDeg = b.maxLat - b.minLat;
  const lngSpanDeg = b.maxLng - b.minLng;
  // lat span ≈ 2*r/111320 ≈ 0.1446°
  assert.ok(
    Math.abs(latSpanDeg - (2 * r) / 111_320) < 1e-6,
    `lat span ${latSpanDeg}`,
  );
  // at lat 34, cos≈0.829, so lng span must be WIDER in degrees than lat span
  assert.ok(lngSpanDeg > latSpanDeg, `lng ${lngSpanDeg} vs lat ${latSpanDeg}`);
  // the origin is inside its own bbox
  assert.ok(bboxContains(b, { lat: 34, lng: -117 }));
});

test("nearestByHaversine: returns limit-N sorted ascending", () => {
  const pts = [
    { id: "far", location: { lat: 34.5, lng: -117.5 } },
    { id: "near", location: { lat: 33.76, lng: -118.21 } },
    { id: "mid", location: { lat: 34.0, lng: -118.0 } },
  ];
  const res = nearestByHaversine(pts, POLB, { limit: 2 });
  assert.equal(res.length, 2);
  assert.equal(res[0].point.id, "near");
  assert.equal(res[1].point.id, "mid");
  // strictly ascending
  assert.ok(res[0].distanceM <= res[1].distanceM);
});

test("nearestByHaversine: respects maxDistanceM", () => {
  const pts = [
    { id: "in", location: { lat: 33.76, lng: -118.21 } }, // ~1km
    { id: "out", location: { lat: 34.5, lng: -117.5 } }, // ~100km+
  ];
  const res = nearestByHaversine(pts, POLB, { maxDistanceM: 5000 });
  assert.equal(res.length, 1);
  assert.equal(res[0].point.id, "in");
});

test("nearestByHaversine: applies filter before distance", () => {
  const pts = [
    { id: "a", class8: false, location: { lat: 33.76, lng: -118.21 } },
    { id: "b", class8: true, location: { lat: 33.77, lng: -118.22 } },
  ];
  const res = nearestByHaversine(pts, POLB, { filter: (p) => p.class8 });
  assert.equal(res.length, 1);
  assert.equal(res[0].point.id, "b");
});

test("distanceToPolylineM: point on the line -> ~0; off the line -> positive", () => {
  const path: LatLng[] = [POLB, SAN_BERNARDINO];
  // midpoint of the segment should be ~0 from the polyline
  const mid = {
    lat: (POLB.lat + SAN_BERNARDINO.lat) / 2,
    lng: (POLB.lng + SAN_BERNARDINO.lng) / 2,
  };
  assert.ok(distanceToPolylineM(mid, path) < 500, "midpoint near polyline");
  // a point well off the corridor is far
  const off = { lat: 35.0, lng: -117.0 };
  assert.ok(distanceToPolylineM(off, path) > 50_000, "off-corridor is far");
  // single-vertex path degenerates to point distance
  assert.equal(distanceToPolylineM(POLB, [POLB]), 0);
});
