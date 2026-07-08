import type { components } from "@fleetvolt/shared-types";
import { api } from "../../convex/_generated/api";
import type { ConvexReactClient } from "convex/react";

type SimulationJobSubmitResponse =
  components["schemas"]["SimulationJobSubmitResponse"];
type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];
type SimulateRequest = components["schemas"]["SimulateRequest"];
type CorridorsResponse = components["schemas"]["CorridorsResponse"];
type TruckConfigSummary = components["schemas"]["TruckConfigSummary"];

const base = "/api/v1";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Lazily get the ConvexReactClient from ConvexClientProvider.
 * Deferred import avoids side-effects (client construction) at module load
 * time, which breaks Node test environments where NEXT_PUBLIC_CONVEX_URL is
 * unset.
 */
let _convexClient: ConvexReactClient | null = null;
async function getConvexClient(): Promise<ConvexReactClient> {
  if (!_convexClient) {
    const mod = await import("@/app/ConvexClientProvider");
    _convexClient = mod.convex;
  }
  return _convexClient;
}

/**
 * Submit a simulation via the Convex simulate action (Phase 13).
 *
 * The Convex action runs physics synchronously and returns the full
 * SimulateResponse. If a cached completed run exists (by inputsHash),
 * it returns cached results. This replaces the old Celery/Redis pipeline
 * (POST /v1/simulations → poll GET /v1/simulations/:id).
 *
 * The returned object is shaped as a SimulationJobSubmitResponse with
 * status "COMPLETE" and the full outputs — no polling needed.
 */
export async function postSimulation(
  body: SimulateRequest,
): Promise<SimulationJobSubmitResponse> {
  const client = await getConvexClient();
  const result = await client.action(api.physics.simulate.simulate, {
    request: body,
  });

  // The Convex action returns a SimulateResponse (segments, kpis, etc.).
  // Map it to the SimulationJobSubmitResponse shape the store expects.
  const inputsHash =
    (result as Record<string, unknown>)?.inputs_hash as string | undefined ??
    "convex-sim";

  return {
    job_id: `convex-${inputsHash.slice(0, 12)}`,
    status: "COMPLETE",
    outputs: result as SimulationJobPollResponse["outputs"],
    inputs_hash: inputsHash,
    inputs: body,
  } as SimulationJobSubmitResponse;
}

/**
 * @deprecated Since Phase 13 — simulations run as a Convex action.
 * postSimulation now returns synchronously with COMPLETE status; no
 * polling is needed. This function is kept for backwards compatibility
 * with poll-job.ts but should not be called in the normal flow.
 */
export async function getSimulation(
  _jobId: string,
  _signal?: AbortSignal,
): Promise<SimulationJobPollResponse> {
  throw new Error(
    "getSimulation is deprecated — the Convex simulate action returns results synchronously. No polling needed.",
  );
}

export async function getRoute(
  corridorKey: string,
  signal?: AbortSignal,
): Promise<{ coordinates?: [number, number][] }> {
  const params = new URLSearchParams({ corridor_key: corridorKey });
  const res = await fetch(`${base}/routing/route?${params}`, { signal });
  return parseJson(res);
}

export async function getTrucks(): Promise<TruckConfigSummary[]> {
  const res = await fetch(`${base}/trucks`);
  return parseJson(res);
}

export async function getCorridors(): Promise<CorridorsResponse> {
  const res = await fetch(`${base}/corridors`);
  return parseJson(res);
}

/**
 * @deprecated Since Phase 13-05 — PDF export moves to client-side generation
 * via the Convex export path. This Fastify proxy is kept temporarily for
 * backwards compatibility until 13-05 ships.
 */
export async function postPdfExport(
  body: { job_id: string; map_snapshot_base64?: string | null },
): Promise<Blob> {
  const res = await fetch(`${base}/exports/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }

  return res.blob();
}
