"use client";

import { Maximize2 } from "lucide-react";
import { MobileWorkbenchSheet } from "./mobile-workbench-sheet";
import { WorkbenchLeftPanel } from "./workbench-left-panel";
import { WorkbenchRightPanel } from "./workbench-right-panel";

type MapWorkbenchShellProps = {
  mode?: "driver_day_plan" | "fleet_contract_plan" | "caas_gap_map";
};

const modeLabel: Record<NonNullable<MapWorkbenchShellProps["mode"]>, string> = {
  driver_day_plan: "Driver day plan",
  fleet_contract_plan: "Fleet contract plan",
  caas_gap_map: "CaaS gap map",
};

export function MapWorkbenchShell({ mode = "caas_gap_map" }: MapWorkbenchShellProps) {
  return (
    <section
      data-testid="map-workbench-shell"
      className="relative h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden bg-[#dfe5df] md:grid md:grid-cols-[20rem_minmax(0,1fr)_22rem]"
    >
      <WorkbenchLeftPanel className="hidden md:flex" />

      <main className="relative min-h-0 overflow-hidden" aria-label={`${modeLabel[mode]} map workbench`}>
        <div
          data-testid="fleetvolt-map-canvas-slot"
          className="absolute inset-0 overflow-hidden bg-[linear-gradient(90deg,rgba(22,26,32,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(22,26,32,0.08)_1px,transparent_1px),radial-gradient(circle_at_30%_25%,rgba(39,111,191,0.24),transparent_34%),radial-gradient(circle_at_70%_60%,rgba(48,135,93,0.2),transparent_30%),#dfe5df] bg-[size:48px_48px,48px_48px,auto,auto,auto]"
          role="img"
          aria-label="FleetVolt interactive map canvas slot"
        >
          <div className="absolute left-3 top-3 rounded-2xl border border-black/10 bg-white/90 px-3 py-2 shadow-lg backdrop-blur md:left-5 md:top-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fv-steel)]">
              {modeLabel[mode]}
            </div>
            <div className="mt-1 text-sm font-semibold text-[var(--fv-graphite)]">
              Map canvas slot
            </div>
          </div>

          <div className="absolute inset-x-6 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--fv-accent)]/70 shadow-[0_0_0_6px_rgba(39,111,191,0.12)] md:inset-x-20" />
          <div className="absolute left-[18%] top-[48%] size-4 rounded-full border-2 border-white bg-[var(--fv-accent)] shadow-lg" />
          <div className="absolute right-[22%] top-[48%] size-4 rounded-full border-2 border-white bg-[var(--fv-signal-green)] shadow-lg" />

          <div className="absolute bottom-[calc(14rem+1rem)] right-3 hidden rounded-2xl border border-black/10 bg-white/90 p-2 shadow-lg backdrop-blur sm:block md:bottom-5 md:right-5">
            <button className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[var(--fv-graphite)] transition hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]" aria-label="Expand map">
              <Maximize2 size={18} />
            </button>
          </div>
        </div>
      </main>

      <WorkbenchRightPanel className="hidden md:flex" />
      <MobileWorkbenchSheet />
    </section>
  );
}
