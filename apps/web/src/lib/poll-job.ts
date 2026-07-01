import { getSimulation } from "@/lib/api-client";
import type { components } from "@fleetvolt/shared-types";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];

export class SimulationFailedError extends Error {
  readonly stage: string;

  constructor(message: string, stage: string) {
    super(message);
    this.name = "SimulationFailedError";
    this.stage = stage;
  }
}

const POLL_INTERVAL_MS = 2000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function pollUntilComplete(
  jobId: string,
  signal?: AbortSignal,
  deps: { getSimulation?: typeof getSimulation } = {},
): Promise<SimulationJobPollResponse> {
  const getJob = deps.getSimulation ?? getSimulation;
  while (true) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const result = await getJob(jobId, signal);

    if (result.status === "COMPLETE") {
      return result;
    }

    if (result.status === "FAILED") {
      const err = result.error as
        | { message?: string; stage?: string }
        | null
        | undefined;
      throw new SimulationFailedError(
        err?.message ?? "Simulation failed",
        err?.stage ?? "unknown",
      );
    }

    await sleep(POLL_INTERVAL_MS, signal);
  }
}
