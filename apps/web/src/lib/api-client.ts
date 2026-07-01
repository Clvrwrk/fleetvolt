import type { components } from "@fleetvolt/shared-types";

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

export async function postSimulation(
  body: SimulateRequest,
): Promise<SimulationJobSubmitResponse> {
  const res = await fetch(`${base}/simulations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function getSimulation(
  jobId: string,
  signal?: AbortSignal,
): Promise<SimulationJobPollResponse> {
  const res = await fetch(`${base}/simulations/${jobId}`, { signal });
  return parseJson(res);
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
