import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  kwhPer100Miles,
  annualEnergyCostUsd,
  deriveDutyPair,
} from "./energy.js";

describe("catalog energy", () => {
  it("converts kWh/mi to kWh per 100 miles", () => {
    assert.equal(kwhPer100Miles(2.1), 210);
  });

  it("computes annual energy cost at 60k mi", () => {
    // 2.1 kWh/mi * 60000 * $0.18/kWh = 22680
    assert.equal(annualEnergyCostUsd(2.1, 0.18, 60_000), 22_680);
  });

  it("derives fully laden / drayage from street efficiency band", () => {
    const pair = deriveDutyPair({ min: 2.0, max: 2.3, typical: 2.165 });
    assert.equal(pair.combined, 2.165);
    assert.equal(pair.fullyLaden, 2.3);
    assert.equal(pair.drayage, 2.3);
  });
});
