import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { annualEmissionsVsDiesel } from "./emissions.js";

describe("catalog emissions", () => {
  it("compares BEV vs diesel at 60k mi for CO2e, NOx, PM2.5", () => {
    const result = annualEmissionsVsDiesel({
      kwhPerMi: 2.1,
      milesPerYear: 60_000,
    });
    assert.ok(result.diesel.co2eT > result.bev.co2eT);
    assert.equal(result.bev.noxKg, 0);
    assert.equal(result.bev.pm25Kg, 0);
    assert.ok(result.avoided.co2eT > 0);
    assert.ok(result.avoided.pctCo2e > 0 && result.avoided.pctCo2e < 1);
    assert.equal(result.milesPerYear, 60_000);
  });
});
