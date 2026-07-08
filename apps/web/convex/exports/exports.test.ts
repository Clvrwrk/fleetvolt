import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderExportHtml } from "./exportTemplate";
import { exportCsv, simulationRowToExportRow } from "./exportCsv";
import { exportJson } from "./exportJson";

describe("renderExportHtml", () => {
  it("produces valid HTML with KPI and table sections", () => {
    const html = renderExportHtml(
      {
        id: "test-1",
        status: "COMPLETE",
        inputs_hash: "abc123",
        physics_version: "phase3-v1",
        charger_version: "afdc-static-v1",
        inputs: {
          truck: { slug: "ecascadia_438" },
          route: { corridor_key: "polb_cajon_pass" },
          conditions: { weather_preset: "ideal", payload_lbs: 34000, port_drayage_enabled: false },
        },
        outputs: {
          segments: [],
          kpis: { total_kwh: 222, wh_per_mi: 1713, regen_kwh: 5, total_time_s: 3600 },
          disclaimer: "test disclaimer",
          assumptions: [],
          charging_stops: [],
          feasibility: { verdict: "feasible", tier: "public_hd", stop_count: 0 },
        },
      },
      null,
      "2026-07-07T00:00:00Z",
    );

    assert.ok(html.includes("KPI Summary"));
    assert.ok(html.includes("Charging Plan"));
    assert.ok(html.includes("Physics Parameter Snapshot"));
    assert.ok(html.includes("Assumptions"));
    assert.ok(html.includes("FleetVolt Route"));
    assert.ok(html.includes("222.0 kWh"));
    assert.ok(html.includes("test disclaimer"));
  });

  it("includes map image when provided", () => {
    const html = renderExportHtml(
      {
        id: "test-2",
        status: "COMPLETE",
        inputs_hash: "abc",
        outputs: { kpis: {}, charging_stops: [], assumptions: [] },
      },
      "data:image/png;base64,abc",
      "2026-07-07T00:00:00Z",
    );
    assert.ok(html.includes("data:image/png;base64,abc"));
  });

  it("shows map unavailable when no image", () => {
    const html = renderExportHtml(
      { id: "t3", status: "COMPLETE", inputs_hash: "x", outputs: { kpis: {}, charging_stops: [], assumptions: [] } },
      null,
      "2026-07-07T00:00:00Z",
    );
    assert.ok(html.includes("Map unavailable"));
  });
});

describe("exportCsv", () => {
  it("produces valid CSV with segment headers", () => {
    const csv = exportCsv({
      segments: [{ dist_m: 16093, grade: 0, speed: 55, energy_kwh: 15, soc_pct: 90, charging_event: false }],
      kpis: { total_kwh: 222, wh_per_mi: 1713, regen_kwh: 5, total_time_s: 3600 },
      charging_stops: [],
      feasibility: { verdict: "feasible", tier: "public_hd", stop_count: 0 },
      assumptions: [],
    });
    assert.ok(csv.includes("dist_m,grade,speed,energy_kwh,soc_pct,charging_event,stop_sequence"));
    assert.ok(csv.includes("16093"));
    assert.ok(csv.includes("section: kpis"));
    assert.ok(csv.includes("section: charging_stops"));
    assert.ok(csv.includes("section: feasibility"));
    assert.ok(csv.includes("section: assumptions"));
  });

  it("escapes formula injection", () => {
    const csv = exportCsv({
      segments: [],
      kpis: {},
      charging_stops: [{ station_id: "=cmd", name: "test", lat: 0, lon: 0, power_kw: 350, arrival_soc_pct: 10, departure_soc_pct: 80, dwell_s: 600, energy_added_kwh: 50 }],
      assumptions: [],
    });
    assert.match(csv, /'=cmd/);
  });

  it("includes charging stop data", () => {
    const csv = exportCsv({
      segments: [],
      kpis: {},
      charging_stops: [{ station_id: "stop-1", name: "Charger A", lat: 34.0, lon: -117.5, power_kw: 350, arrival_soc_pct: 20, departure_soc_pct: 80, dwell_s: 1800, energy_added_kwh: 50 }],
      assumptions: [],
    });
    assert.ok(csv.includes("stop-1"));
    assert.ok(csv.includes("Charger A"));
  });

  it("includes assumptions", () => {
    const csv = exportCsv({
      segments: [],
      kpis: {},
      charging_stops: [],
      assumptions: [{ field: "cd_a", value: 0.65, source: "oem", oem_default: 0.7 }],
    });
    assert.ok(csv.includes("cd_a"));
    assert.ok(csv.includes("0.65"));
  });
});

describe("exportJson", () => {
  it("serializes to pretty JSON", () => {
    const obj = { a: 1, b: { c: 2 } };
    const json = exportJson(obj);
    assert.equal(JSON.parse(json).b.c, 2);
    assert.ok(json.includes("\n"));
  });
});

describe("simulationRowToExportRow", () => {
  it("adapts Convex row to export shape", () => {
    const row = simulationRowToExportRow({
      _id: "abc123",
      inputsHash: "hash123",
      status: "completed",
      physicsVersion: "v1",
      chargerVersion: "v2",
      inputs: { truck: { slug: "test" } },
      results: { kpis: { total_kwh: 100 } },
    });
    assert.equal(row.id, "abc123");
    assert.equal(row.inputs_hash, "hash123");
    assert.equal(row.status, "completed");
    assert.equal(row.physics_version, "v1");
    assert.equal(row.charger_version, "v2");
    assert.equal((row.outputs as { kpis: { total_kwh: number } }).kpis.total_kwh, 100);
  });
});
