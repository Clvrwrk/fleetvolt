"use client";

import { useEffect, useRef, useState } from "react";
import type { FvMapHandle } from "@/lib/map-ref";
import type { components } from "@fleetvolt/shared-types";
import { RoutePlannerFrame } from "@/components/design/route-planner-frame";
import { ScreenHeader } from "@/components/design/screen-header";
import { ScenarioForm } from "@/components/scenario/scenario-form";
import { SensitivitySliders } from "@/components/scenario/sensitivity-sliders";
import { JobStatusBar } from "@/components/scenario/job-status-bar";
import { RoutePlannerCenter } from "@/components/workspace/route-planner-center";
import { RoutePlannerRightRail } from "@/components/workspace/route-planner-right-rail";
import { WorkspaceActionBar } from "@/components/workspace/workspace-action-bar";
import { useScenarioStore } from "@/stores/scenario-store";

type TruckConfigSummary = components["schemas"]["TruckConfigSummary"];
type CorridorCatalogEntry = components["schemas"]["CorridorCatalogEntry"];

type WorkspaceLayoutProps = {
  trucks: TruckConfigSummary[];
  corridors: CorridorCatalogEntry[];
  initialCorridorKey?: string;
};

function statusFromStore(
  isPolling: boolean,
  pollStatus: string | null,
  error: { message: string } | null,
): { text: string; color: string } {
  if (error) {
    return { text: "Simulation failed", color: "#c0392b" };
  }
  if (isPolling) {
    return { text: "Running physics…", color: "#b8874c" };
  }
  if (pollStatus === "COMPLETE") {
    return { text: "Simulation current", color: "#3f9b6b" };
  }
  return { text: "Awaiting run", color: "#b8874c" };
}

export function WorkspaceLayout({
  trucks,
  corridors,
  initialCorridorKey,
}: WorkspaceLayoutProps) {
  const pollResult = useScenarioStore((s) => s.pollResult);
  const isPolling = useScenarioStore((s) => s.isPolling);
  const pollStatus = useScenarioStore((s) => s.pollStatus);
  const error = useScenarioStore((s) => s.error);
  const setCorridors = useScenarioStore((s) => s.setCorridors);
  const setFormInputs = useScenarioStore((s) => s.setFormInputs);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const whatIfRef = useRef<HTMLDivElement>(null);
  const compareRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<FvMapHandle | null>(null);

  useEffect(() => {
    setCorridors(corridors);
  }, [corridors, setCorridors]);

  useEffect(() => {
    if (!initialCorridorKey) {
      return;
    }
    const valid = corridors.some((c) => c.corridor_key === initialCorridorKey);
    if (valid) {
      setFormInputs({ corridor_key: initialCorridorKey });
    }
  }, [corridors, initialCorridorKey, setFormInputs]);

  const status = statusFromStore(isPolling, pollStatus, error);
  const corridorKey =
    (pollResult?.inputs as { route?: { corridor_key?: string } } | undefined)
      ?.route?.corridor_key ?? pollResult?.outputs?.corridor_key;
  const corridorName =
    corridors.find((c) => c.corridor_key === corridorKey)?.name ??
    corridorKey ??
    "Configure corridor";

  const handleWhatIf = () => {
    setShowWhatIf(true);
    requestAnimationFrame(() => {
      whatIfRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const handleCompare = () => {
    setShowCompare(true);
    requestAnimationFrame(() => {
      compareRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  return (
    <RoutePlannerFrame>
      <ScreenHeader
        title="Route Planner"
        subtitle="PHYSICS CORRIDOR SIMULATION"
        backHref="/"
        status={status}
      />

      <div className="mt-5 grid grid-cols-[262px_minmax(0,1fr)_300px] gap-5">
        <aside className="flex flex-col gap-3">
          <div className="fv-section-label">CORRIDOR DEFINITION</div>
          <ScenarioForm trucks={trucks} corridors={corridors} />
          <JobStatusBar />
          {showWhatIf || pollResult?.status === "COMPLETE" ? (
            <div ref={whatIfRef} className="space-y-2">
              <div className="fv-section-label">WHAT-IF ADJUSTMENTS</div>
              <SensitivitySliders />
            </div>
          ) : null}
        </aside>

        <RoutePlannerCenter
          pollResult={pollResult}
          corridorName={String(corridorName)}
          mapRef={mapRef}
        />

        <RoutePlannerRightRail
          pollResult={pollResult}
          showCompare={showCompare}
          compareRef={compareRef}
          mapRef={mapRef}
        />
      </div>

      <WorkspaceActionBar onWhatIf={handleWhatIf} onCompare={handleCompare} />
    </RoutePlannerFrame>
  );
}
