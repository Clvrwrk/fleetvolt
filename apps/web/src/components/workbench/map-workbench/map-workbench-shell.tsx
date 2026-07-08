"use client";

import { AiCommandBar } from "./ai-command-bar";
import { FleetVoltMapCanvas } from "./fleetvolt-map-canvas";
import { MobileWorkbenchSheet } from "./mobile-workbench-sheet";
import { WorkbenchLeftPanel } from "./workbench-left-panel";
import { WorkbenchRightPanel } from "./workbench-right-panel";
import type { WorkbenchMode } from "./types";

type MapWorkbenchShellProps = {
  mode?: WorkbenchMode;
};

const modeLabel: Record<WorkbenchMode, string> = {
  driver_day_plan: "Driver day plan",
  fleet_contract_plan: "Fleet contract plan",
  caas_gap_map: "CaaS gap map",
};

export function MapWorkbenchShell({ mode = "driver_day_plan" }: MapWorkbenchShellProps) {
  return (
    <section
      data-testid="map-workbench-shell"
      data-workbench-mode={mode}
      className="relative h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden bg-[#dfe5df] md:grid md:grid-cols-[20rem_minmax(0,1fr)_22rem]"
    >
      <WorkbenchLeftPanel mode={mode} className="hidden md:flex" />

      <main
        className="relative min-h-0 overflow-hidden"
        aria-label={`${modeLabel[mode]} map workbench`}
      >
        <div
          data-testid="fleetvolt-map-canvas-slot"
          className="absolute inset-0 overflow-hidden"
        >
          <FleetVoltMapCanvas mode={mode} className="h-full w-full" />
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-[calc(14rem+0.75rem)] z-20 md:inset-x-5 md:bottom-5">
          <div className="pointer-events-auto mx-auto max-w-3xl">
            <AiCommandBar mode={mode} />
          </div>
        </div>
      </main>

      <WorkbenchRightPanel className="hidden md:flex" />
      <MobileWorkbenchSheet />
    </section>
  );
}
