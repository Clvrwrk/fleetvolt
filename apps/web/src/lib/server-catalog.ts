import type { components } from "@fleetvolt/shared-types";

type TruckConfigSummary = components["schemas"]["TruckConfigSummary"];
type CorridorsResponse = components["schemas"]["CorridorsResponse"];

/**
 * Server-side catalog fetchers.
 *
 * These previously called the Fastify API (localhost:4000) which is decommissioned
 * (Phase 14). The app now sources data from Convex (client-side via ConvexProvider).
 * These functions return empty arrays as fallbacks — the home and planner pages
 * handle empty corridor/truck lists gracefully. If API_URL is set (legacy/proxy),
 * they will attempt the fetch; otherwise they short-circuit to [].
 */
function apiUrl(): string | null {
  return process.env.API_URL ?? null;
}

export async function fetchTrucks(): Promise<TruckConfigSummary[]> {
  const base = apiUrl();
  if (!base) return [];
  try {
    const response = await fetch(`${base}/v1/trucks`, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as TruckConfigSummary[];
  } catch {
    return [];
  }
}

export async function fetchCorridorPresets(): Promise<
  CorridorsResponse["presets"]
> {
  const base = apiUrl();
  if (!base) return [];
  try {
    const response = await fetch(`${base}/v1/corridors`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as CorridorsResponse;
    return (data.presets ?? []).filter(
      (c) => c.type === "corridor" && c.corridor_key,
    );
  } catch {
    return [];
  }
}
