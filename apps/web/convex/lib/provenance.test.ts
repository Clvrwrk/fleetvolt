// Provenance-contract unit test (DINT-01 / SRC-01 / P12-12).
//
// Pure unit test — no Convex server import — so it runs under
//   node --import tsx --test convex/lib/provenance.test.ts
// It asserts the SINGLE runtime enforcement path (assertProvenance) accepts
// every one of the 13 sources + the modeled method/inputs shape, and still
// rejects a bad source, an out-of-range usefulnessScore, an empty matchMethod,
// a bad method, and a non-array inputs.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertProvenance,
  PROVENANCE_SOURCES,
} from "./provenance";

const base = { fetchedAt: 1_700_000_000_000, usefulnessScore: 7, matchMethod: "api" };

test("all 13 sources pass with the four required fields", () => {
  assert.equal(PROVENANCE_SOURCES.length, 13);
  for (const source of PROVENANCE_SOURCES) {
    assert.doesNotThrow(
      () => assertProvenance({ ...base, source }),
      `source ${source} should validate`,
    );
  }
});

test("modeled method + inputs[] passes (P12-12 modeled-score shape)", () => {
  assert.doesNotThrow(() =>
    assertProvenance({
      source: "SIMULATED",
      fetchedAt: 1_700_000_000_000,
      usefulnessScore: 6,
      matchMethod: "modeled_score",
      method: "modeled",
      inputs: ["NATD_parking", "Caltrans_5axle", "FAF_flow", "carrier_density"],
    }),
  );
});

test("unknown source FOO throws", () => {
  assert.throws(() => assertProvenance({ ...base, source: "FOO" }), /source/);
});

test("usefulnessScore 11 and -1 throw", () => {
  assert.throws(
    () => assertProvenance({ ...base, source: "FAF5", usefulnessScore: 11 }),
    /usefulnessScore/,
  );
  assert.throws(
    () => assertProvenance({ ...base, source: "FAF5", usefulnessScore: -1 }),
    /usefulnessScore/,
  );
});

test("empty matchMethod throws", () => {
  assert.throws(
    () => assertProvenance({ ...base, source: "FAF5", matchMethod: "" }),
    /matchMethod/,
  );
});

test("method 'bogus' throws", () => {
  assert.throws(
    () => assertProvenance({ ...base, source: "FAF5", method: "bogus" }),
    /method/,
  );
});

test("inputs 'notarray' throws", () => {
  assert.throws(
    () => assertProvenance({ ...base, source: "FAF5", inputs: "notarray" }),
    /inputs/,
  );
});
