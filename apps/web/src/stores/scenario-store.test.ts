import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { __setSimulationClientForTests } from "@/lib/api-client";
import { useScenarioStore } from "./scenario-store.js";

describe("useScenarioStore submitScenario", () => {
  afterEach(() => {
    __setSimulationClientForTests(null);
    useScenarioStore.setState({
      formInputs: useScenarioStore.getState().formInputs,
      corridors: [],
      activeJobId: null,
      pollResult: null,
      pollStatus: null,
      isPolling: false,
      isRouteLoading: false,
      isCacheHit: false,
      error: null,
      routeCoordinatesByJobId: {},
      abortController: null,
    });
  });

  it("sets pollResult with inputs_hash on cache hit", async () => {
    __setSimulationClientForTests({
      action: async () => ({
        segments: [
          { segment_index: 0, soc_pct: 50, dist_m: 100, energy_kwh: 10 },
        ],
        kpis: { total_kwh: 120, wh_per_mi: 2100, total_time_s: 7200 },
        disclaimer: "Planning only",
        inputs_hash: "deadbeef12345678",
      }),
    } as never);

    await useScenarioStore.getState().submitScenario();

    const state = useScenarioStore.getState();
    assert.equal(state.isCacheHit, true);
    assert.equal(state.pollResult?.inputs_hash, "deadbeef12345678");
    assert.equal(state.pollStatus, "COMPLETE");
  });
});
