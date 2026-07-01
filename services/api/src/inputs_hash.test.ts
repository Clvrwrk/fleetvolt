import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHARGER_VERSION,
  PHYSICS_VERSION,
  TEST_VECTOR_EXPECTED_HASH,
  TEST_VECTOR_SCENARIO,
  computeInputsHash,
} from "./inputs_hash.js";

describe("computeInputsHash", () => {
  it("matches Python committed test vector", () => {
    const digest = computeInputsHash(
      TEST_VECTOR_SCENARIO,
      PHYSICS_VERSION,
      CHARGER_VERSION,
    );
    assert.equal(digest, TEST_VECTOR_EXPECTED_HASH);
    assert.equal(digest.length, 64);
    assert.equal(digest, digest.toLowerCase());
  });

  it("is independent of key order", () => {
    const reordered = {
      options: { include_charging: true },
      overrides: {},
      conditions: {
        port_drayage_enabled: false,
        payload_lbs: 34000,
        weather_preset: "ideal",
      },
      truck: { slug: "ecascadia_438" },
      route: { corridor_key: "polb_cajon_pass" },
    };
    const baseline = computeInputsHash(
      TEST_VECTOR_SCENARIO,
      PHYSICS_VERSION,
      CHARGER_VERSION,
    );
    const shuffled = computeInputsHash(
      reordered,
      PHYSICS_VERSION,
      CHARGER_VERSION,
    );
    assert.equal(baseline, shuffled);
  });
});
