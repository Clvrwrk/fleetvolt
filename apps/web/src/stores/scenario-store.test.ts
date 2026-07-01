import assert from "node:assert/strict";
import { describe, it, mock, afterEach } from "node:test";
import { useScenarioStore } from "./scenario-store.js";

describe("useScenarioStore submitScenario", () => {
  afterEach(() => {
    mock.restoreAll();
    useScenarioStore.setState({
      formInputs: useScenarioStore.getState().formInputs,
      activeJobId: null,
      pollResult: null,
      pollStatus: null,
      isPolling: false,
      isCacheHit: false,
      error: null,
      abortController: null,
    });
  });

  it("sets pollResult with inputs_hash on cache hit", async () => {
    mock.method(globalThis, "fetch", async () =>
      Response.json({
        job_id: "cached-id",
        status: "COMPLETE",
        outputs: {
          segments: [
            { segment_index: 0, soc_pct: 50, dist_m: 100, energy_kwh: 10 },
          ],
          kpis: { total_kwh: 120, wh_per_mi: 2100, total_time_s: 7200 },
          disclaimer: "Planning only",
        },
        inputs_hash: "deadbeef12345678",
        physics_version: "1.0.0",
        charger_version: "1.0.0",
        inputs: { route: { corridor_key: "polb_cajon_pass" } },
      }),
    );

    await useScenarioStore.getState().submitScenario();

    const state = useScenarioStore.getState();
    assert.equal(state.isCacheHit, true);
    assert.equal(state.pollResult?.inputs_hash, "deadbeef12345678");
    assert.equal(state.pollStatus, "COMPLETE");
  });
});
