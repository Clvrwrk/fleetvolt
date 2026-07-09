import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatKwhPerMi, formatPct, formatUsd } from "./format.js";

describe("catalog format", () => {
  it("formats USD without cents", () => {
    assert.equal(formatUsd(22680), "$22,680");
    assert.equal(formatUsd(null), "—");
  });

  it("formats kWh/mi to one decimal", () => {
    assert.equal(formatKwhPerMi(2.165), "2.2");
    assert.equal(formatKwhPerMi(null), "—");
  });

  it("formats pctCo2e fraction as percent", () => {
    assert.equal(formatPct(0.68), "68%");
    assert.equal(formatPct(null), "—");
  });
});
