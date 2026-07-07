// P12-09 corridor-city normalization tests — the pure city→corridor-cluster tag
// that backs the flagship "companies to target" ranking (P12-10c). The eight
// named clusters must reproduce the flagship VERIFIED distribution from the raw
// registry city text; out-of-corridor cities must partition cleanly to null so
// the in-corridor total is never inflated (T-12-05d).
//
// Run: node --import tsx --test convex/carriers/corridorCity.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCorridorCity,
  CORRIDOR_CITIES,
  type CorridorCity,
} from "./corridorCity.js";

test("exact canonical names normalize to themselves", () => {
  for (const c of CORRIDOR_CITIES) {
    assert.equal(normalizeCorridorCity(c), c, `${c} should map to itself`);
  }
});

test("case-insensitive: LONG BEACH / long beach / Long Beach → Long Beach", () => {
  assert.equal(normalizeCorridorCity("LONG BEACH"), "Long Beach");
  assert.equal(normalizeCorridorCity("long beach"), "Long Beach");
  assert.equal(normalizeCorridorCity("Long Beach"), "Long Beach");
});

test("tolerates a trailing state suffix and extra whitespace", () => {
  assert.equal(normalizeCorridorCity("Long Beach, CA"), "Long Beach");
  assert.equal(normalizeCorridorCity("  Wilmington  "), "Wilmington");
  assert.equal(normalizeCorridorCity("Carson CA"), "Carson");
  assert.equal(normalizeCorridorCity("Chino, CA."), "Chino");
  assert.equal(normalizeCorridorCity("City  of   Industry"), "City of Industry");
});

test("'Industry' variant maps to City of Industry", () => {
  assert.equal(normalizeCorridorCity("Industry"), "City of Industry");
  assert.equal(normalizeCorridorCity("INDUSTRY"), "City of Industry");
});

test("out-of-corridor cities return null (clean partition)", () => {
  assert.equal(normalizeCorridorCity("Sacramento"), null);
  assert.equal(normalizeCorridorCity("Los Angeles"), null);
  assert.equal(normalizeCorridorCity("San Diego"), null);
  assert.equal(normalizeCorridorCity("Bakersfield"), null);
});

test("null / empty / whitespace-only input returns null", () => {
  assert.equal(normalizeCorridorCity(null), null);
  assert.equal(normalizeCorridorCity(undefined), null);
  assert.equal(normalizeCorridorCity(""), null);
  assert.equal(normalizeCorridorCity("   "), null);
});

test("canonical set matches the flagship cluster names exactly", () => {
  // The eight named headline clusters (FLAGSHIP-QUERY-VERIFIED.md) plus the four
  // inland corridor endpoints the plan calls out.
  const expected: CorridorCity[] = [
    "Long Beach",
    "Wilmington",
    "Carson",
    "Gardena",
    "Compton",
    "Ontario",
    "City of Industry",
    "Chino",
    "San Bernardino",
    "Rancho Cucamonga",
    "Fontana",
    "Rialto",
  ];
  assert.deepEqual([...CORRIDOR_CITIES], expected);
});
