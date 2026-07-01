import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderExportHtml } from "./export-template.js";

const MOCK_ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "COMPLETE",
  inputs_hash: "abc123def4567890",
  physics_version: "phys-v1.0.0",
  charger_version: "chrg-v1.0.0",
  inputs: {
    route: { corridor_key: "polb_cajon_pass" },
    truck: { slug: "ecascadia_438" },
    conditions: {
      weather_preset: "ideal",
      payload_lbs: 34000,
      port_drayage_enabled: true,
    },
  },
  outputs: {
    segments: [
      {
        dist_m: 1000,
        grade: 0.5,
        speed: 25,
        energy_kwh: 1.2,
        soc_pct: 95,
        charging_event: false,
      },
    ],
    kpis: {
      total_kwh: 100,
      wh_per_mi: 2000,
      regen_kwh: 5,
      total_time_s: 3600,
    },
    disclaimer: "Planning tool only.",
    assumptions: [
      {
        field: "drag_coefficient",
        value: 0.65,
        source: "oem_default",
        oem_default: 0.65,
      },
    ],
    charging_stops: [
      {
        station_id: "stop-1",
        name: "HD Charger",
        lat: 34.0,
        lon: -117.5,
        power_kw: 350,
        arrival_soc_pct: 20,
        departure_soc_pct: 80,
        dwell_s: 1800,
        energy_added_kwh: 50,
        detour_s: 0,
      },
    ],
    feasibility: {
      verdict: "feasible",
      tier: "public_hd",
      stop_count: 1,
    },
  },
};

describe("renderExportHtml", () => {
  it("test_template_includes_disclaimer", () => {
    const html = renderExportHtml(MOCK_ROW, null, "2026-07-01T12:00:00.000Z");

    assert.match(html, /Planning tool only/);
    assert.match(html, /abc123def4567890/);
    assert.match(html, /phys-v1\.0\.0/);
    assert.match(html, /chrg-v1\.0\.0/);
    assert.match(html, /2026-07-01T12:00:00\.000Z/);
  });

  it("includes KPI summary table", () => {
    const html = renderExportHtml(MOCK_ROW, null, "2026-07-01T12:00:00.000Z");
    assert.match(html, /100\.0 kWh|100 kWh/);
    assert.match(html, /2000 Wh\/mi/);
  });

  it("embeds map snapshot when provided", () => {
    const html = renderExportHtml(
      MOCK_ROW,
      "data:image/png;base64,iVBORw0KGgo=",
      "2026-07-01T12:00:00.000Z",
    );
    assert.match(html, /data:image\/png;base64,iVBORw0KGgo=/);
  });

  it("shows map unavailable placeholder when snapshot missing", () => {
    const html = renderExportHtml(MOCK_ROW, null, "2026-07-01T12:00:00.000Z");
    assert.match(html, /Map unavailable/);
  });
});
