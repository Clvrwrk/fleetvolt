"use client";

import { useEffect, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import { FleetVoltMapCanvas } from "./fleetvolt-map-canvas";
import { WorkbenchLeftPanel } from "./workbench-left-panel";
import { WorkbenchRightPanel } from "./workbench-right-panel";
import { WorkbenchRailNav } from "./workbench-rail-nav";
import { WorkbenchBootstrap } from "./workbench-bootstrap";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";
import type { WorkbenchMode } from "./types";

type MapWorkbenchShellProps = {
  mode?: WorkbenchMode;
};

const modeLabel: Record<WorkbenchMode, string> = {
  driver_day_plan: "Driver day plan",
  fleet_contract_plan: "Fleet contract plan",
  caas_gap_map: "CaaS gap map",
};

/** Desktop tools column — matches prior panel legibility (~320px). */
const RAIL_WIDTH_CLASS = "w-80";

export function MapWorkbenchShell({ mode = "driver_day_plan" }: MapWorkbenchShellProps) {
  useLayoutEffect(() => {
    const store = useMapWorkbenchStore.getState();
    if (store.mode !== mode) store.reset(mode);
  }, [mode]);

  useEffect(() => {
    useMapWorkbenchStore.getState().hydrateLayerProfile(mode);
  }, [mode]);

  return (
    <section
      data-testid="map-workbench-shell"
      data-workbench-mode={mode}
      className="relative flex h-[calc(100dvh-3.5rem)] w-full min-h-0 min-w-0 overflow-clip bg-[#dfe5df]"
    >
      <WorkbenchBootstrap mode={mode} />

      {/* Stacked left rail: role nav ABOVE → accordion tools BELOW (TOOL-RAIL.md) */}
      <aside
        data-testid="workbench-tool-rail"
        className={cn(
          "relative z-20 flex h-full min-h-0 shrink-0 flex-col border-r border-white/10 bg-[var(--fv-graphite)]",
          RAIL_WIDTH_CLASS,
        )}
        aria-label="Workbench tools"
      >
        <WorkbenchRailNav
          modePanel={
            <WorkbenchLeftPanel
              mode={mode}
              className="h-full min-h-0 border-0 bg-transparent shadow-none"
              chrome="embedded"
            />
          }
          opportunityPanel={
            <WorkbenchRightPanel
              className="h-full min-h-0 border-0 bg-transparent shadow-none"
              chrome="embedded"
            />
          }
        />
      </aside>

      {/* Map owns remaining viewport — must stay full-bleed (global main max-width does not apply). */}
      <main
        id="main-content"
        tabIndex={-1}
        className="relative min-h-0 min-w-0 flex-1 overflow-hidden !max-w-none !m-0 !p-0"
        aria-label={`${modeLabel[mode]} map workbench`}
      >
        <div
          data-testid="fleetvolt-map-canvas-slot"
          className="absolute inset-0 overflow-hidden"
        >
          <FleetVoltMapCanvas mode={mode} className="h-full w-full" />
        </div>
      </main>
    </section>
  );
}
