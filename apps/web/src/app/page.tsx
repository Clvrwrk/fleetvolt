import type { components } from "@fleetvolt/shared-types";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";

type TruckConfigSummary = components["schemas"]["TruckConfigSummary"];
type CorridorsResponse = components["schemas"]["CorridorsResponse"];

async function fetchTrucks(): Promise<TruckConfigSummary[]> {
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${apiUrl}/v1/trucks`, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as TruckConfigSummary[];
  } catch {
    return [];
  }
}

async function fetchCorridors(): Promise<
  CorridorsResponse["presets"]
> {
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${apiUrl}/v1/corridors`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as CorridorsResponse;
    return data.presets ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [trucks, corridors] = await Promise.all([
    fetchTrucks(),
    fetchCorridors(),
  ]);

  return <WorkspaceLayout trucks={trucks} corridors={corridors} />;
}
