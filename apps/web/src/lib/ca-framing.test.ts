// Unit tests for the CA-coast framing helpers (node --test).
// Run: node --import tsx --test src/lib/ca-framing.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CA_PORT_COORDS,
  DEFAULT_CA_BOUNDS,
  bboxTupleToBounds,
  computeCaCoastBounds,
} from "./ca-framing";

test("default bounds contain all six port coordinates", () => {
  const b = computeCaCoastBounds();
  for (const p of CA_PORT_COORDS) {
    assert.ok(
      p.lat >= b.south && p.lat <= b.north,
      `port lat ${p.lat} outside [${b.south}, ${b.north}]`,
    );
    assert.ok(
      p.lng >= b.west && p.lng <= b.east,
      `port lng ${p.lng} outside [${b.west}, ${b.east}]`,
    );
  }
});

test("default bounds equal the documented CA-coast framing", () => {
  assert.deepEqual(computeCaCoastBounds(), DEFAULT_CA_BOUNDS);
});

test("bbox tuple [w,s,e,n] maps to the bounds object correctly", () => {
  // turf.bbox order: [west, south, east, north]
  const bounds = bboxTupleToBounds([-122.7, 32.5, -116.5, 38.0]);
  assert.deepEqual(bounds, {
    west: -122.7,
    south: 32.5,
    east: -116.5,
    north: 38.0,
  });
});

test("supplying points tightens the bounds vs. the default", () => {
  const tight = computeCaCoastBounds(CA_PORT_COORDS);
  // The derived bbox around the ports must be strictly inside the padded default.
  assert.ok(tight.south >= DEFAULT_CA_BOUNDS.south);
  assert.ok(tight.north <= DEFAULT_CA_BOUNDS.north);
  assert.ok(tight.west >= DEFAULT_CA_BOUNDS.west);
  assert.ok(tight.east <= DEFAULT_CA_BOUNDS.east);
  // And it must still contain every port (it is their exact bbox).
  for (const p of CA_PORT_COORDS) {
    assert.ok(p.lat >= tight.south && p.lat <= tight.north);
    assert.ok(p.lng >= tight.west && p.lng <= tight.east);
  }
});

test("a single point yields a degenerate (point) bbox at that coordinate", () => {
  const one = computeCaCoastBounds([{ lat: 33.74, lng: -118.26 }]);
  assert.equal(one.north, 33.74);
  assert.equal(one.south, 33.74);
  assert.equal(one.east, -118.26);
  assert.equal(one.west, -118.26);
});
