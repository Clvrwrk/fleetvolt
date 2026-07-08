import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { fetchCorridorPresets, fetchTrucks } from "@/lib/server-catalog";

type PlannerPageProps = {
  searchParams: Promise<{ corridor?: string }>;
};

export default async function PlannerPage({ searchParams }: PlannerPageProps) {
  const { corridor } = await searchParams;
  const [trucks, corridors] = await Promise.all([
    fetchTrucks(),
    fetchCorridorPresets(),
  ]);

  return (
    <WorkspaceLayout
      trucks={trucks}
      corridors={corridors}
      initialCorridorKey={corridor}
    />
  );
}
