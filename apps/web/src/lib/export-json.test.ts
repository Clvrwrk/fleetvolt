import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { components } from "@fleetvolt/shared-types";
import { buildJsonExport } from "./export-json.js";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];

const FIXTURE_POLL: SimulationJobPollResponse = {
  job_id: "11111111-1111-4111-8111-111111111111",
  status: "COMPLETE",
  inputs_hash: "abc123def4567890",
  physics_version: "phys-v1.0.0",
  charger_version: "chrg-v1.0.0",
  inputs: { route: { corridor_key: "polb_cajon_pass" } },
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
  },
};

describe("buildJsonExport", () => {
  it("test_json_roundtrip", () => {
    const json = buildJsonExport(FIXTURE_POLL);
    const parsed = JSON.parse(json) as SimulationJobPollResponse;

    assert.equal(parsed.job_id, FIXTURE_POLL.job_id);
    assert.equal(parsed.status, "COMPLETE");
    assert.equal(parsed.inputs_hash, FIXTURE_POLL.inputs_hash);
    assert.ok(parsed.outputs);
    assert.ok(parsed.inputs);
    assert.equal(parsed.outputs?.segments.length, 1);
  });
});
