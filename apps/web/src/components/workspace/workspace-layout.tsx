"use client";

import { useEffect } from "react";
import type { components } from "@fleetvolt/shared-types";
import { ScenarioForm } from "@/components/scenario/scenario-form";
import { JobStatusBar } from "@/components/scenario/job-status-bar";
import { BasicResultsPanel } from "@/components/results/basic-results-panel";
import { useScenarioStore } from "@/stores/scenario-store";

type TruckConfigSummary = components["schemas"]["TruckConfigSummary"];
type CorridorCatalogEntry = components["schemas"]["CorridorCatalogEntry"];

type WorkspaceLayoutProps = {
  trucks: TruckConfigSummary[];
  corridors: CorridorCatalogEntry[];
};

export function WorkspaceLayout({ trucks, corridors }: WorkspaceLayoutProps) {
  const pollResult = useScenarioStore((s) => s.pollResult);
  const setCorridors = useScenarioStore((s) => s.setCorridors);

  useEffect(() => {
    setCorridors(corridors);
  }, [corridors, setCorridors]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--fv-bg)]">
      <header className="flex h-14 items-center border-b border-[var(--fv-stroke)] px-6">
        <h1 className="text-xl font-medium tracking-tight">FleetVolt Route</h1>
      </header>

      <div className="grid flex-1 grid-cols-[320px_1fr] gap-6 p-6">
        <aside className="fv-panel flex flex-col gap-4 p-6">
          <div>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Scenario
            </h2>
            <ScenarioForm trucks={trucks} corridors={corridors} />
          </div>
          <JobStatusBar />
        </aside>

        <section
          className="fv-panel min-w-0 p-6"
          data-testid="results-canvas"
          id="results-canvas"
        >
          {pollResult?.status === "COMPLETE" && pollResult.outputs ? (
            <BasicResultsPanel pollResult={pollResult} />
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <p className="text-lg font-medium">Configure and run a scenario</p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Select a truck and corridor preset, then run a physics-grounded
                simulation. Results including energy KPIs and audit hash will
                appear here.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
