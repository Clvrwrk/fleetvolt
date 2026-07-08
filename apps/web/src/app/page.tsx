import { HomeScreen } from "@/components/home/home-screen";
import { fetchCorridorPresets } from "@/lib/server-catalog";

async function fetchChargerCount(): Promise<number> {
  // Fastify API decommissioned (Phase 14). Charger count comes from Convex
  // client-side. This server-side fetch is a no-op without API_URL.
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return 0;
  try {
    const response = await fetch(`${apiUrl}/v1/meta/stack`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return 0;
    }
    const data = (await response.json()) as {
      table_counts?: Record<string, number>;
    };
    return data.table_counts?.chargers ?? 0;
  } catch {
    return 0;
  }
}

export default async function HomePage() {
  const [corridors, chargerCount] = await Promise.all([
    fetchCorridorPresets(),
    fetchChargerCount(),
  ]);

  return <HomeScreen corridors={corridors} chargerCount={chargerCount} />;
}
