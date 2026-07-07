// P12-07 classifier tests — the Class-8 capability gate that reproduces the
// flagship VERIFIED zero-Class-8-on-corridor gap. The LD-at-75kW Tesla /
// dealership rows (the "5 closest" in FLAGSHIP-QUERY-VERIFIED) MUST classify
// false so the corridor gap is honest, never inflated.
//
// Run: node --import tsx --test convex/chargers/classify.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isClass8Capable,
  stationMaxPowerKw,
  normalizeConnectors,
  isMcsCapable,
  type AfdcChargingUnit,
} from "./classify.js";

test("isClass8Capable: 400kW + HD → true", () => {
  assert.equal(isClass8Capable(400, "HD"), true);
});

test("isClass8Capable: 350kW + MD → true (boundary power, MD site)", () => {
  assert.equal(isClass8Capable(350, "MD"), true);
});

test("isClass8Capable: 75kW + LD → false (the flagship Tesla/dealership rows)", () => {
  assert.equal(isClass8Capable(75, "LD"), false);
});

test("isClass8Capable: 400kW + LD → false (power ok, class not — wrong site)", () => {
  assert.equal(isClass8Capable(400, "LD"), false);
});

test("isClass8Capable: 300kW + HD → false (class ok, power below 350 floor)", () => {
  assert.equal(isClass8Capable(300, "HD"), false);
});

test("isClass8Capable: 349.9kW + HD → false (just under the floor)", () => {
  assert.equal(isClass8Capable(349.9, "HD"), false);
});

test("isClass8Capable: null/undefined vehicle class → false", () => {
  assert.equal(isClass8Capable(400, null), false);
  assert.equal(isClass8Capable(400, undefined), false);
});

test("stationMaxPowerKw: picks the max power across units + connectors", () => {
  const units: AfdcChargingUnit[] = [
    {
      connectors: {
        J1772: { power_kw: null, port_count: 1 },
        CHADEMO: { power_kw: 70, port_count: 1 },
        J1772COMBO: { power_kw: 150, port_count: 1 },
      },
    },
    {
      connectors: {
        J3271: { power_kw: 350, port_count: 1 },
        TESLA: { power_kw: 250, port_count: 1 },
      },
    },
  ];
  assert.equal(stationMaxPowerKw(units), 350);
});

test("stationMaxPowerKw: all-null power → 0 (no numeric power present)", () => {
  const units: AfdcChargingUnit[] = [
    { connectors: { J1772: { power_kw: null, port_count: 1 } } },
  ];
  assert.equal(stationMaxPowerKw(units), 0);
});

test("stationMaxPowerKw: empty / null / undefined → 0", () => {
  assert.equal(stationMaxPowerKw([]), 0);
  assert.equal(stationMaxPowerKw(null), 0);
  assert.equal(stationMaxPowerKw(undefined), 0);
});

test("normalizeConnectors: sorted, unique, upper-cased (array input)", () => {
  assert.deepEqual(
    normalizeConnectors(["J1772COMBO", "chademo", "J1772", "J1772COMBO"]),
    ["CHADEMO", "J1772", "J1772COMBO"],
  );
});

test("normalizeConnectors: delimited string + null → array / []", () => {
  assert.deepEqual(normalizeConnectors("CCS|MCS,j3271"), ["CCS", "J3271", "MCS"]);
  assert.deepEqual(normalizeConnectors(null), []);
  assert.deepEqual(normalizeConnectors(undefined), []);
});

test("isMcsCapable: true only with J3271 / MCS", () => {
  assert.equal(isMcsCapable(["J3271", "J1772"]), true);
  assert.equal(isMcsCapable(["MCS"]), true);
  assert.equal(isMcsCapable(["CCS", "J1772COMBO", "CHADEMO"]), false);
  assert.equal(isMcsCapable([]), false);
});
