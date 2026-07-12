import assert from "node:assert/strict";
import test from "node:test";
import { getChoroplethRing } from "./choropleth-geometry";

test("accepts a verified polygon ring", () => {
  const ring = [
    { lat: 34, lng: -118 },
    { lat: 35, lng: -117 },
    { lat: 33, lng: -116 },
  ];

  assert.deepEqual(getChoroplethRing(ring), ring);
});

test("rejects absent or underspecified geometry", () => {
  assert.equal(getChoroplethRing(undefined), null);
  assert.equal(
    getChoroplethRing([
      { lat: 34, lng: -118 },
      { lat: 35, lng: -117 },
    ]),
    null,
  );
});

test("rejects invalid coordinates instead of drawing false geography", () => {
  assert.equal(
    getChoroplethRing([
      { lat: 34, lng: -118 },
      { lat: 35, lng: -117 },
      { lat: 95, lng: -116 },
    ]),
    null,
  );
});
