import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { components } from "@fleetvolt/shared-types";
import { buildCsvExport } from "./export-csv.js";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];

const FIXTURE_POLL: SimulationJobPollResponse = {
  job_id: "11111111-1111-4111-8111-111111111111",
  status: "COMPLETE",
  inputs_hash: "abc123def4567890",
  physics_version: "phys-v1.0.0",
  charger_version: "chrg-v1.0.0",
  inputs: {
    route: { corridor_key: "polb_cajon_pass" },
    truck: { slug: "ecascadia_438" },
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
    charging_stops: [
      {
        station_id: "stop-1",
        name: "=HYPERLINK malicious",
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
  },
};

describe("buildCsvExport", () => {
  it("test_csv_header_includes_hash", () => {
    const csv = buildCsvExport(FIXTURE_POLL);
    const lines = csv.split("\n");

    assert.match(lines[0]!, /inputs_hash.*abc123def4567890/);
    assert.match(lines[1]!, /physics_version.*phys-v1\.0\.0/);
    assert.match(lines[2]!, /charger_version.*chrg-v1\.0\.0/);
  });

  it("test_csv_formula_escape", () => {
    const csv = buildCsvExport(FIXTURE_POLL);
    assert.match(csv, /'=HYPERLINK malicious/);
  });

  it("includes segment columns dist_m soc_pct energy_kwh", () => {
    const csv = buildCsvExport(FIXTURE_POLL);
    assert.match(csv, /dist_m,soc_pct,energy_kwh/);
    assert.match(csv, /1000,95,1\.2/);
  });

  it("includes charging_stops section", () => {
    const csv = buildCsvExport(FIXTURE_POLL);
    assert.match(csv, /section: charging_stops/);
    assert.match(csv, /stop-1/);
  });
});
