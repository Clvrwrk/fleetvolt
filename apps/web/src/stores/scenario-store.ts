import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { postSimulation } from "@/lib/api-client";
import { pollUntilComplete, SimulationFailedError } from "@/lib/poll-job";
import {
  DEFAULT_SCENARIO_FORM,
  type ScenarioFormValues,
  toSimulateRequest,
} from "@/lib/scenario-schema";
import type { components } from "@fleetvolt/shared-types";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];

type RouteCoordinates = [number, number][];

type ScenarioStore = {
  formInputs: ScenarioFormValues;
  activeJobId: string | null;
  pollResult: SimulationJobPollResponse | null;
  pollStatus: SimulationJobPollResponse["status"] | null;
  isPolling: boolean;
  isCacheHit: boolean;
  error: { message: string; stage?: string } | null;
  routeCoordinates: Record<string, RouteCoordinates>;
  abortController: AbortController | null;
  setFormInputs: (inputs: Partial<ScenarioFormValues>) => void;
  submitScenario: () => Promise<void>;
  resetError: () => void;
};

export const useScenarioStore = create<ScenarioStore>()(
  immer((set, get) => ({
    formInputs: DEFAULT_SCENARIO_FORM,
    activeJobId: null,
    pollResult: null,
    pollStatus: null,
    isPolling: false,
    isCacheHit: false,
    error: null,
    routeCoordinates: {},
    abortController: null,

    setFormInputs: (inputs) =>
      set((state) => {
        Object.assign(state.formInputs, inputs);
      }),

    resetError: () =>
      set((state) => {
        state.error = null;
      }),

    submitScenario: async () => {
      const { formInputs, abortController: previous } = get();
      previous?.abort();

      const controller = new AbortController();
      const body = toSimulateRequest(formInputs);

      set((state) => {
        state.isPolling = true;
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
          state.error = { message, stage };
          state.pollStatus = "FAILED";
        });
      }
    },
  })),
);
