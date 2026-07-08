// Unit tests for the PURE modeled hotspot score (P12-11 / P12-12). No Convex,
// no live deployment — this proves the math + the HONESTY GUARD (the score can
// never silently drop its modeled label or its four proxy inputs).
//
// Run: node --import tsx --test convex/hotspots/score.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeHotspotScore,
  DEFAULT_WEIGHTS,
  HOTSPOT_SCORE_INPUTS,
  REFERENCE_MAXIMA,
  type HotspotScoreInputs,
} from "./score.js";

const ZERO: HotspotScoreInputs = {
  parkingCapacity: 0,
  truckAADT: 0,
  fafFlowKtons: 0,
  carrierCount: 0,
};

const MAX: HotspotScoreInputs = {
  parkingCapacity: REFERENCE_MAXIMA.parkingCapacity,
  truckAADT: REFERENCE_MAXIMA.truckAADT,
  fafFlowKtons: REFERENCE_MAXIMA.fafFlowKtons,
  carrierCount: REFERENCE_MAXIMA.carrierCount,
};

// (1) all-zero proxies → score 0
test("all-zero proxies → score 0", () => {
  const r = computeHotspotScore(ZERO);
  assert.equal(r.score, 0);
  assert.equal(r.components.parking, 0);
  assert.equal(r.components.truck, 0);
  assert.equal(r.components.faf, 0);
  assert.equal(r.components.carrier, 0);
});

// (2) all-max proxies → score ~1
test("all-at-reference-max proxies → score ~1", () => {
  const r = computeHotspotScore(MAX);
  assert.ok(r.score > 0.99, `expected ~1, got ${r.score}`);
  assert.ok(r.score <= 1, "score must clamp to <= 1");
});

// score always in [0,1] even for absurd over-max inputs
test("score clamps to [0,1] for over-max inputs", () => {
  const r = computeHotspotScore({
    parkingCapacity: 10 * REFERENCE_MAXIMA.parkingCapacity,
    truckAADT: 10 * REFERENCE_MAXIMA.truckAADT,
    fafFlowKtons: 10 * REFERENCE_MAXIMA.fafFlowKtons,
    carrierCount: 10 * REFERENCE_MAXIMA.carrierCount,
  });
  assert.ok(r.score >= 0 && r.score <= 1, `score ${r.score} out of [0,1]`);
});

// (3) monotonicity — raising any proxy (weight>0) raises the score
test("monotonic: raising each proxy raises the score", () => {
  const base: HotspotScoreInputs = {
    parkingCapacity: 100,
    truckAADT: 5000,
    fafFlowKtons: 100_000,
    carrierCount: 30,
  };
  const baseScore = computeHotspotScore(base).score;
  for (const key of [
    "parkingCapacity",
    "truckAADT",
    "fafFlowKtons",
    "carrierCount",
  ] as const) {
    const bumped = { ...base, [key]: base[key] * 1.5 + 1 };
    const bumpedScore = computeHotspotScore(bumped).score;
    assert.ok(
      bumpedScore > baseScore,
      `raising ${key} should raise score: ${baseScore} -> ${bumpedScore}`,
    );
  }
});

// (4) weights change the ranking as expected
test("weights change the ranking of two candidates", () => {
  // A: parking-heavy location. B: truck-heavy location.
  const A: HotspotScoreInputs = {
    parkingCapacity: 400,
    truckAADT: 2000,
    fafFlowKtons: 100_000,
    carrierCount: 10,
  };
  const B: HotspotScoreInputs = {
    parkingCapacity: 50,
    truckAADT: 30_000,
    fafFlowKtons: 100_000,
    carrierCount: 10,
  };
  // Parking-dominant weights → A ranks above B.
  const parkingWeights = { parking: 0.8, truck: 0.1, faf: 0.05, carrier: 0.05 };
  const Ap = computeHotspotScore(A, parkingWeights).score;
  const Bp = computeHotspotScore(B, parkingWeights).score;
  assert.ok(Ap > Bp, `parking-weighted: A(${Ap}) should beat B(${Bp})`);

  // Truck-dominant weights → B ranks above A (ranking flipped by weights).
  const truckWeights = { parking: 0.1, truck: 0.8, faf: 0.05, carrier: 0.05 };
  const At = computeHotspotScore(A, truckWeights).score;
  const Bt = computeHotspotScore(B, truckWeights).score;
  assert.ok(Bt > At, `truck-weighted: B(${Bt}) should beat A(${At})`);
});

// determinism — same inputs+weights ⇒ identical result
test("deterministic: identical inputs produce identical scores", () => {
  const inp: HotspotScoreInputs = {
    parkingCapacity: 217,
    truckAADT: 12_345,
    fafFlowKtons: 393_437,
    carrierCount: 42,
  };
  const a = computeHotspotScore(inp);
  const b = computeHotspotScore(inp);
  assert.deepEqual(a, b);
});

// (5) THE HONESTY GUARD — the return ALWAYS carries method:"modeled" + the four
// inputs. This test FAILS if a future change relabels the score as observed or
// drops a proxy from the inputs list (P12-12, T-12-08a).
test("HONESTY GUARD: always method:'modeled' + exactly the four proxy inputs", () => {
  for (const inp of [ZERO, MAX, { parkingCapacity: 1, truckAADT: 1, fafFlowKtons: 1, carrierCount: 1 }]) {
    const r = computeHotspotScore(inp);
    assert.equal(r.method, "modeled", "score MUST be labeled modeled, never observed");
    assert.deepEqual(
      r.inputs,
      [
        "NATD_parking_capacity",
        "Caltrans_5axle_truckAADT",
        "FAF_zone061_flow",
        "POLB_carrier_concentration",
      ],
      "score MUST list the four proxy inputs",
    );
  }
  // the exported constant is the single source of truth
  assert.deepEqual([...HOTSPOT_SCORE_INPUTS], computeHotspotScore(ZERO).inputs);
});

// weights are echoed for audit (T-12-08e)
test("components + weights are returned for audit", () => {
  const r = computeHotspotScore(MAX, DEFAULT_WEIGHTS);
  assert.deepEqual(r.weights, DEFAULT_WEIGHTS);
  assert.ok("parking" in r.components && "truck" in r.components);
  assert.ok("faf" in r.components && "carrier" in r.components);
});
