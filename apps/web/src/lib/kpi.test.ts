import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { components } from "@fleetvolt/shared-types";
import { deriveKpiSummary } from "./kpi.js";

type SimulateResponse = components["schemas"]["SimulateResponse"];

describe("deriveKpiSummary", () => {
  it("test_kpi_final_soc", () => {
    const outputs: SimulateResponse = {
      segments: [
        {
          dist_m: 1000,
          soc_pct: 80,
          grade: 0,
          speed: 55,
          energy_kwh: 10,
          charging_event: false,
        },
        {
          dist_m: 5000,
          soc_pct: 42.5,
          grade: 1,
          speed: 50,
          energy_kwh: 12,
          charging_event: false,
        },
      ],
      kpis: {
        total_kwh: 120.5,
        wh_per_mi: 2100,
        regen_kwh: 5,
        total_time_s: 7200,
      },
      disclaimer: "Planning tool only.",
      charging_stops: [
        {
          station_id: "station-1",
          lat: 34.0,
          lon: -117.0,
          power_kw: 350,
          arrival_soc_pct: 20,
          departure_soc_pct: 80,
          dwell_s: 1800,
          energy_added_kwh: 50,
          detour_s: 120,
        },
      ],
      feasibility: {
        verdict: "feasible",
        tier: "public_hd",
        stop_count: 1,
      },
    };

    const summary = deriveKpiSummary(outputs);

    assert.equal(summary.finalSocPct, 42.5);
    assert.equal(summary.stopCount, 1);
    assert.equal(summary.feasibilityVerdict, "feasible");
    assert.equal(summary.feasibilityTier, "public_hd");
    assert.equal(summary.totalKwh, 120.5);
    assert.equal(summary.totalDwellS, 1800);
  });
});
