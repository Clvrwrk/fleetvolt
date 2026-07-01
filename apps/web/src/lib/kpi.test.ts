import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { components } from "@fleetvolt/shared-types";
import {
  deriveKpiSummary,
  feasibilityBadgeClasses,
  feasibilityBadgeVariant,
  formatDurationSeconds,
  formatKwh,
  formatWhPerMi,
  totalDwellSeconds,
} from "./kpi.js";

type SimulateResponse = components["schemas"]["SimulateResponse"];

describe("formatDurationSeconds", () => {
  it("test_formats_trip_time", () => {
    assert.equal(formatDurationSeconds(7200), "2h 00m");
    assert.equal(formatDurationSeconds(3661), "1h 01m");
    assert.equal(formatDurationSeconds(900), "0h 15m");
  });
});

describe("totalDwellSeconds", () => {
  it("test_dwell_sum", () => {
    const stops: NonNullable<SimulateResponse["charging_stops"]> = [
      {
        station_id: "a",
        lat: 34,
        lon: -117,
        power_kw: 350,
        arrival_soc_pct: 20,
        departure_soc_pct: 80,
        dwell_s: 1800,
        energy_added_kwh: 50,
        detour_s: 0,
      },
      {
        station_id: "b",
        lat: 34.1,
        lon: -117.1,
        power_kw: 250,
        arrival_soc_pct: 25,
        departure_soc_pct: 75,
        dwell_s: 900,
        energy_added_kwh: 30,
        detour_s: 0,
      },
    ];

    assert.equal(totalDwellSeconds(stops), 2700);
    assert.equal(totalDwellSeconds([]), 0);
    assert.equal(totalDwellSeconds(null), 0);
  });
});

describe("feasibilityBadgeVariant", () => {
  it("test_feasibility_badge_variant", () => {
    assert.equal(feasibilityBadgeVariant("feasible"), "feasible");
    assert.equal(feasibilityBadgeVariant("critical"), "critical");
    assert.equal(feasibilityBadgeVariant("infeasible"), "infeasible");
    assert.equal(feasibilityBadgeVariant(null), null);

    assert.match(
      feasibilityBadgeClasses("feasible"),
      /DCFCE7|166534/,
    );
    assert.match(
      feasibilityBadgeClasses("critical"),
      /FEF3C7|92400E/,
    );
    assert.match(
      feasibilityBadgeClasses("infeasible"),
      /FEE2E2|991B1B/,
    );
  });
});

describe("formatters", () => {
  it("formats kWh and Wh/mi", () => {
    assert.equal(formatKwh(120.456), "120.5 kWh");
    assert.equal(formatWhPerMi(2100.7), "2101 Wh/mi");
  });
});

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
    assert.equal(summary.tripTimeFormatted, "2h 00m");
    assert.equal(summary.totalDwellFormatted, "0h 30m");
  });
});
