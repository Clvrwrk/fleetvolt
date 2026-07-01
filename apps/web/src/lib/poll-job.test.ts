import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pollUntilComplete } from "./poll-job.js";
import type { components } from "@fleetvolt/shared-types";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];

describe("pollUntilComplete", () => {
  it("resolves when mock fetch returns COMPLETE status", async () => {
    const complete = {
      job_id: "job-1",
      status: "COMPLETE",
      outputs: {
        segments: [],
        kpis: {
          total_kwh: 100,
          wh_per_mi: 2000,
          regen_kwh: 5,
          total_time_s: 3600,
        },
        disclaimer: "Planning tool only",
      },
      inputs_hash: "abc123def456",
    } satisfies SimulationJobPollResponse;

    const result = await pollUntilComplete("job-1", undefined, {
      getSimulation: async () => complete,
    });
    assert.equal(result.status, "COMPLETE");
    assert.equal(result.inputs_hash, "abc123def456");
  });
});
