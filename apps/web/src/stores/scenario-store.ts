import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { postSimulation } from "@/lib/api-client";
import { pollUntilComplete, SimulationFailedError } from "@/lib/poll-job";
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
import type { components } from "@fleetvolt/shared-types";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];
type CorridorCatalogEntry = components["schemas"]["CorridorCatalogEntry"];

type RouteGeometryCache = {
  coordinates: RouteCoordinates;
  distance_m: number;
};

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
  setFormInputs: (inputs: Partial<ScenarioFormValues>) => void;
  setCorridors: (corridors: CorridorCatalogEntry[]) => void;
  submitScenario: () => Promise<void>;
  resetError: () => void;
};

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

    setFormInputs: (inputs) =>
      set((state) => {
        Object.assign(state.formInputs, inputs);
      }),

    setCorridors: (corridors) =>
      set((state) => {
        state.corridors = corridors;
      }),

    resetError: () =>
      set((state) => {
        state.error = null;
      }),

    submitScenario: async () => {
      const { formInputs, abortController: previous, corridors } = get();
      previous?.abort();

      const controller = new AbortController();
      const body = toSimulateRequest(formInputs);

      set((state) => {
        state.isPolling = true;
        state.isRouteLoading = false;
        state.error = null;
        state.isCacheHit = false;
        state.pollResult = null;
        state.pollStatus = null;
        state.activeJobId = null;
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
          set((state) => {
            state.isPolling = false;
            state.isCacheHit = true;
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
          return;
        }

        set((state) => {
          state.activeJobId = submit.job_id;
          state.pollStatus = submit.status;
        });

        const result = await pollUntilComplete(submit.job_id, controller.signal);

        set((state) => {
          state.isPolling = false;
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
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
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
          state.isPolling = false;
          state.isRouteLoading = false;
          state.error = { message, stage };
          state.pollStatus = "FAILED";
        });
      }
    },
  })),
);
