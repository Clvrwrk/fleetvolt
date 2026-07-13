// Provenance contract unit test (DINT-01 / SRC-01).
//
// This is the SHARED enforcement checkpoint that Wave 3 ingest asserts against:
// it exercises the single runtime helper `assertProvenance` from the Convex-side
// provenance module, proving no data record can carry an incomplete or
// out-of-range provenance object.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertProvenance,
  PROVENANCE_SOURCES,
  type Provenance,
} from "../../convex/lib/provenance";

const valid: Provenance = {
  source: "FAF5",
  year: 2022,
  fetchedAt: 1_700_000_000_000,
  usefulnessScore: 8,
  matchMethod: "FAF_region_join",
};

test("a fully-populated provenance object passes", () => {
  assert.doesNotThrow(() => assertProvenance(valid));
});

test("year is optional — omitting it still passes", () => {
  const { year: _year, ...noYear } = valid;
  assert.doesNotThrow(() => assertProvenance(noYear));
});

test("omitting any required field throws", () => {
  for (const field of ["source", "fetchedAt", "usefulnessScore", "matchMethod"] as const) {
    const clone: Record<string, unknown> = { ...valid };
    delete clone[field];
    assert.throws(
      () => assertProvenance(clone),
      new RegExp(field),
      `expected missing ${field} to throw`,
    );
  }
});

test("usefulnessScore below 0 throws", () => {
  assert.throws(() => assertProvenance({ ...valid, usefulnessScore: -1 }), /usefulnessScore/);
});

test("usefulnessScore above 10 throws", () => {
  assert.throws(() => assertProvenance({ ...valid, usefulnessScore: 11 }), /usefulnessScore/);
});

test("usefulnessScore at the 0 and 10 bounds passes", () => {
  assert.doesNotThrow(() => assertProvenance({ ...valid, usefulnessScore: 0 }));
  assert.doesNotThrow(() => assertProvenance({ ...valid, usefulnessScore: 10 }));
});

test("source accepts every supported provenance literal", () => {
  assert.ok(PROVENANCE_SOURCES.length > 0);
  for (const source of PROVENANCE_SOURCES) {
    assert.doesNotThrow(() => assertProvenance({ ...valid, source }));
  }
});

test("an unknown source string is rejected", () => {
  assert.throws(() => assertProvenance({ ...valid, source: "MADE_UP" }), /source/);
});

test("a non-object value is rejected", () => {
  assert.throws(() => assertProvenance(null), /object/);
  assert.throws(() => assertProvenance("nope"), /object/);
});
