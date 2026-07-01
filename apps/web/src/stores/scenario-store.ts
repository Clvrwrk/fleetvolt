import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { postSimulation } from "@/lib/api-client";
import { pollUntilComplete, SimulationFailedError } from "@/lib/poll-job";
import { deriveKpiSummary, type KpiSummary } from "@/lib/kpi";
import {
  fetchRouteGeometry,
  resolveCorridorEndpoints,
  type RouteCoordinates,
} from "@/lib/route-geometry";
import {
  DEFAULT_SCENARIO_FORM,
  type ScenarioFormValues,
  toSimulateRequest,
} from "@/lib/scenario-schema";
import { findSegmentIndexByDistanceM } from "@/lib/segment-lookup";
import type { components } from "@fleetvolt/shared-types";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];
type SimulateRequest = components["schemas"]["SimulateRequest"];
type SimulateResponse = components["schemas"]["SimulateResponse"];
type CorridorCatalogEntry = components["schemas"]["CorridorCatalogEntry"];

export type ComparisonLabel = "A" | "B" | "C";

export type ComparisonScenario = {
  label: ComparisonLabel;
  job_id: string;
  inputs_hash: string;
  inputs: SimulateRequest | null;
  outputs: SimulateResponse;
  kpiSummary: KpiSummary;
};

export type SensitivityDeltaKpis = {
  totalKwhDelta: number;
  totalTimeDelta: number;
  whPerMiDelta: number;
  stopCountDelta: number;
};

type RouteGeometryCache = {
  coordinates: RouteCoordinates;
  distance_m: number;
};

type PinResult = "pinned" | "updated" | "full" | "no-result";

type ScenarioStore = {
  formInputs: ScenarioFormValues;
  corridors: CorridorCatalogEntry[];
  activeJobId: string | null;
  pollResult: SimulationJobPollResponse | null;
  pollStatus: SimulationJobPollResponse["status"] | null;
  isPolling: boolean;
  isRouteLoading: boolean;
  isCacheHit: boolean;
  error: { message: string; stage?: string } | null;
  routeCoordinatesByJobId: Record<string, RouteGeometryCache>;
  abortController: AbortController | null;
  activeDistanceM: number | null;
  comparisonScenarios: ComparisonScenario[];
  addToComparison: boolean;
  isSensitivityUpdating: boolean;
  sensitivityPollSequence: number;
  sensitivityDeltaKpis: SensitivityDeltaKpis | null;
  setFormInputs: (inputs: Partial<ScenarioFormValues>) => void;
  setActiveDistanceM: (distanceM: number | null) => void;
  getActiveSegmentIndex: () => number;
  setCorridors: (corridors: CorridorCatalogEntry[]) => void;
  setAddToComparison: (value: boolean) => void;
  pinCurrentResult: () => PinResult;
  removeScenario: (label: ComparisonLabel) => void;
  clearComparison: () => void;
  submitScenario: () => Promise<void>;
  submitSensitivityRun: (body: SimulateRequest) => Promise<void>;
  resetError: () => void;
};

const COMPARISON_LABELS: ComparisonLabel[] = ["A", "B", "C"];

function nextAvailableLabel(
  scenarios: ComparisonScenario[],
): ComparisonLabel | null {
  const used = new Set(scenarios.map((s) => s.label));
  return COMPARISON_LABELS.find((label) => !used.has(label)) ?? null;
}

function buildComparisonScenario(
  pollResult: SimulationJobPollResponse,
  label: ComparisonLabel,
): ComparisonScenario | null {
  if (!pollResult.outputs || !pollResult.inputs_hash) {
    return null;
  }

  return {
    label,
    job_id: pollResult.job_id,
    inputs_hash: pollResult.inputs_hash,
    inputs: (pollResult.inputs as SimulateRequest | null) ?? null,
    outputs: pollResult.outputs,
    kpiSummary: deriveKpiSummary(pollResult.outputs),
  };
}

function corridorKeyFromPollResult(
  pollResult: SimulationJobPollResponse,
  fallbackCorridorKey: string,
): string {
  const inputs = pollResult.inputs as
    | { route?: { corridor_key?: string | null } }
    | null
    | undefined;
  return inputs?.route?.corridor_key ?? fallbackCorridorKey;
}

async function cacheRouteGeometryForJob(
  jobId: string,
  corridorKey: string,
  corridors: CorridorCatalogEntry[],
  set: (fn: (state: ScenarioStore) => void) => void,
  get: () => ScenarioStore,
): Promise<void> {
  if (get().routeCoordinatesByJobId[jobId]) {
    return;
  }

  const endpoints = resolveCorridorEndpoints(corridorKey, corridors);
  if (!endpoints) {
    return;
  }

  set((state) => {
    state.isRouteLoading = true;
  });

  try {
    const route = await fetchRouteGeometry(
      endpoints.originLat,
      endpoints.originLon,
      endpoints.destLat,
      endpoints.destLon,
    );

    if (route.coordinates.length < 2) {
      return;
    }

    set((state) => {
      state.routeCoordinatesByJobId[jobId] = {
        coordinates: route.coordinates,
        distance_m: route.distance_m,
      };
    });
  } catch {
    // Map panel falls back to geometry-unavailable state; KPIs still render.
  } finally {
    set((state) => {
      state.isRouteLoading = false;
    });
  }
}

function computeSensitivityDelta(
  baseline: KpiSummary,
  current: KpiSummary,
): SensitivityDeltaKpis {
  return {
    totalKwhDelta: current.totalKwh - baseline.totalKwh,
    totalTimeDelta: current.totalTimeS - baseline.totalTimeS,
    whPerMiDelta: current.whPerMi - baseline.whPerMi,
    stopCountDelta: current.stopCount - baseline.stopCount,
  };
}

async function executeSimulation(
  body: SimulateRequest,
  set: (fn: (state: ScenarioStore) => void) => void,
  get: () => ScenarioStore,
  options: {
    sensitivity?: boolean;
    pollSequence?: number;
  } = {},
): Promise<SimulationJobPollResponse | null> {
  const { corridors, formInputs, abortController: previous } = get();
  previous?.abort();

  const controller = new AbortController();
  const pollSequence = options.pollSequence;

  set((state) => {
    if (options.sensitivity) {
      state.isSensitivityUpdating = true;
    } else {
      state.isPolling = true;
      state.isRouteLoading = false;
      state.pollResult = null;
      state.pollStatus = null;
      state.activeJobId = null;
      state.activeDistanceM = null;
      state.isCacheHit = false;
    }
    state.error = null;
    state.abortController = controller;
  });

  try {
    const submit = await postSimulation(body);

    if (submit.status === "COMPLETE" && submit.outputs) {
      const pollResult: SimulationJobPollResponse = {
        job_id: submit.job_id,
        status: "COMPLETE",
        outputs: submit.outputs,
        inputs_hash: submit.inputs_hash ?? null,
        physics_version: submit.physics_version ?? null,
        charger_version: submit.charger_version ?? null,
        inputs: submit.inputs ?? null,
      };

      if (
        options.sensitivity &&
        pollSequence != null &&
        pollSequence !== get().sensitivityPollSequence
      ) {
        set((state) => {
          state.isSensitivityUpdating = false;
        });
        return null;
      }

      set((state) => {
        if (options.sensitivity) {
          state.isSensitivityUpdating = false;
        } else {
          state.isPolling = false;
          state.isCacheHit = true;
        }
        state.activeJobId = submit.job_id;
        state.pollResult = pollResult;
        state.pollStatus = "COMPLETE";
      });

      await cacheRouteGeometryForJob(
        submit.job_id,
        corridorKeyFromPollResult(pollResult, formInputs.corridor_key),
        corridors,
        set,
        get,
      );
      return pollResult;
    }

    set((state) => {
      if (!options.sensitivity) {
        state.activeJobId = submit.job_id;
        state.pollStatus = submit.status;
      }
    });

    const result = await pollUntilComplete(submit.job_id, controller.signal);

    if (
      options.sensitivity &&
      pollSequence != null &&
      pollSequence !== get().sensitivityPollSequence
    ) {
      set((state) => {
        state.isSensitivityUpdating = false;
      });
      return null;
    }

    set((state) => {
      if (options.sensitivity) {
        state.isSensitivityUpdating = false;
      } else {
        state.isPolling = false;
      }
      state.pollResult = result;
      state.pollStatus = result.status;
      state.activeJobId = result.job_id;
    });

    if (result.status === "COMPLETE" && result.outputs) {
      await cacheRouteGeometryForJob(
        result.job_id,
        corridorKeyFromPollResult(result, formInputs.corridor_key),
        corridors,
        set,
        get,
      );
    }

    return result;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return null;
    }

    if (
      options.sensitivity &&
      pollSequence != null &&
      pollSequence !== get().sensitivityPollSequence
    ) {
      set((state) => {
        state.isSensitivityUpdating = false;
      });
      return null;
    }

    const message =
      err instanceof SimulationFailedError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    const stage =
      err instanceof SimulationFailedError ? err.stage : undefined;

    set((state) => {
      if (options.sensitivity) {
        state.isSensitivityUpdating = false;
      } else {
        state.isPolling = false;
        state.isRouteLoading = false;
        state.pollStatus = "FAILED";
      }
      state.error = { message, stage };
    });
    return null;
  }
}

export const useScenarioStore = create<ScenarioStore>()(
  immer((set, get) => ({
    formInputs: DEFAULT_SCENARIO_FORM,
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
    activeDistanceM: null,
    comparisonScenarios: [],
    addToComparison: false,
    isSensitivityUpdating: false,
    sensitivityPollSequence: 0,
    sensitivityDeltaKpis: null,

    setFormInputs: (inputs) =>
      set((state) => {
        Object.assign(state.formInputs, inputs);
      }),

    setCorridors: (corridors) =>
      set((state) => {
        state.corridors = corridors;
      }),

    setAddToComparison: (value) =>
      set((state) => {
        state.addToComparison = value;
      }),

    resetError: () =>
      set((state) => {
        state.error = null;
      }),

    setActiveDistanceM: (distanceM) =>
      set((state) => {
        state.activeDistanceM = distanceM;
      }),

    getActiveSegmentIndex: () => {
      const { activeDistanceM, pollResult } = get();
      const segments = pollResult?.outputs?.segments ?? [];
      if (activeDistanceM == null || segments.length === 0) {
        return -1;
      }
      return findSegmentIndexByDistanceM(segments, activeDistanceM);
    },

    pinCurrentResult: () => {
      const { pollResult, comparisonScenarios } = get();
      if (!pollResult || pollResult.status !== "COMPLETE" || !pollResult.outputs) {
        return "no-result";
      }

      const hash = pollResult.inputs_hash;
      if (!hash) {
        return "no-result";
      }

      const existing = comparisonScenarios.find((s) => s.inputs_hash === hash);
      if (existing) {
        const updated = buildComparisonScenario(pollResult, existing.label);
        if (!updated) {
          return "no-result";
        }
        set((state) => {
          const idx = state.comparisonScenarios.findIndex(
            (s) => s.inputs_hash === hash,
          );
          if (idx >= 0) {
            state.comparisonScenarios[idx] = updated;
          }
        });
        return "updated";
      }

      if (comparisonScenarios.length >= 3) {
        return "full";
      }

      const label = nextAvailableLabel(comparisonScenarios);
      if (!label) {
        return "full";
      }

      const snapshot = buildComparisonScenario(pollResult, label);
      if (!snapshot) {
        return "no-result";
      }

      set((state) => {
        state.comparisonScenarios.push(snapshot);
      });
      return "pinned";
    },

    removeScenario: (label) =>
      set((state) => {
        state.comparisonScenarios = state.comparisonScenarios.filter(
          (s) => s.label !== label,
        );
      }),

    clearComparison: () =>
      set((state) => {
        state.comparisonScenarios = [];
        state.sensitivityDeltaKpis = null;
      }),

    submitScenario: async () => {
      const { formInputs } = get();
      await executeSimulation(toSimulateRequest(formInputs), set, get);
    },

    submitSensitivityRun: async (body) => {
      const pollSequence = get().sensitivityPollSequence + 1;
      set((state) => {
        state.sensitivityPollSequence = pollSequence;
        state.sensitivityDeltaKpis = null;
      });

      const result = await executeSimulation(body, set, get, {
        sensitivity: true,
        pollSequence,
      });

      if (!result?.outputs || result.status !== "COMPLETE") {
        return;
      }

      const baselineScenario =
        get().comparisonScenarios.find((s) => s.label === "A") ??
        get().comparisonScenarios[0];

      if (baselineScenario) {
        const currentKpi = deriveKpiSummary(result.outputs);
        set((state) => {
          state.sensitivityDeltaKpis = computeSensitivityDelta(
            baselineScenario.kpiSummary,
            currentKpi,
          );
        });
      }

      if (get().comparisonScenarios.length < 3) {
        get().pinCurrentResult();
      }
    },
  })),
);
