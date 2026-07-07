"use client";

import type { RefObject } from "react";
import { useState } from "react";
import type { FvMapHandle } from "@/lib/map-ref";
import type { components } from "@fleetvolt/shared-types";
import { ComparisonDiffTable } from "@/components/comparison/comparison-diff-table";
import { ComparisonTray } from "@/components/comparison/comparison-tray";
import { FvInsetCard } from "@/components/design/fv-inset-card";
import { AssumptionsPanel } from "@/components/results/assumptions-panel";
import { ChargingPlanCompact } from "@/components/tables/charging-plan-compact";
import { deriveKpiSummary } from "@/lib/kpi";
import { formatFeasibilityTierLabel } from "@/lib/kpi";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];
type ChargingStop = components["schemas"]["ChargingStopResult"];

type RoutePlannerRightRailProps = {
  pollResult: SimulationJobPollResponse | null;
  showCompare: boolean;
  compareRef: React.RefObject<HTMLDivElement | null>;
  mapRef: RefObject<FvMapHandle | null>;
};

function stopKey(stop: ChargingStop, index: number): string {
  return stop.station_id || `stop-${index}`;
}

export function RoutePlannerRightRail({
  pollResult,
  showCompare,
  compareRef,
  mapRef,
}: RoutePlannerRightRailProps) {
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const outputs = pollResult?.outputs;
  const chargingStops = outputs?.charging_stops ?? [];

  const handleStopSelect = (stop: ChargingStop) => {
    const index = chargingStops.indexOf(stop);
    setSelectedStopId(stopKey(stop, index >= 0 ? index : 0));
  };

  const kpi = outputs ? deriveKpiSummary(outputs) : null;
  const verdictLabel = kpi?.feasibilityVerdict
    ? kpi.feasibilityVerdict.replace(/_/g, " ")
    : "—";

  return (
    <aside className="flex flex-col gap-3">
      <div className="fv-section-label">CHARGING PLAN</div>
      <FvInsetCard>
        {outputs ? (
          <ChargingPlanCompact
            chargingStops={chargingStops}
            selectedStopId={selectedStopId}
            onStopSelect={handleStopSelect}
            mapRef={mapRef}
          />
        ) : (
          <p className="py-4 text-center font-mono text-[10px] text-[#9a9aa2]">
            Run simulation to view charging plan.
          </p>
        )}
      </FvInsetCard>

      <div className="fv-section-label mt-1">FEASIBILITY</div>
      {kpi ? (
        <>
          <div className="fv-feasibility-card">
            <div className="fv-feasibility-card-label">VERDICT</div>
            <div className="fv-feasibility-card-value capitalize" data-testid="kpi-feasibility-badge">
              {verdictLabel}
            </div>
            {kpi.feasibilityTier ? (
              <div className="mt-1 font-mono text-[9px] text-[#3f9b6b]">
                {formatFeasibilityTierLabel(kpi.feasibilityTier)}
              </div>
            ) : null}
          </div>
          <div className="fv-feasibility-card">
            <div className="fv-feasibility-card-label">FINAL SOC</div>
            <div className="fv-feasibility-card-value" data-testid="kpi-final-soc">
              {kpi.finalSocFormatted}
            </div>
          </div>
          <div className="fv-feasibility-card">
            <div className="fv-feasibility-card-label">TRIP TIME</div>
            <div className="fv-feasibility-card-value" data-testid="kpi-trip-time">
              {kpi.tripTimeFormatted}
            </div>
          </div>
        </>
      ) : (
        <FvInsetCard>
          <p className="font-mono text-[10px] text-[#9a9aa2]">
            Feasibility metrics appear after simulation.
          </p>
        </FvInsetCard>
      )}

      <div ref={compareRef} className="space-y-2">
        <div className="fv-section-label">COMPARISON</div>
        <ComparisonTray />
        {(showCompare || pollResult) && (
          <FvInsetCard>
            <ComparisonDiffTable />
          </FvInsetCard>
        )}
      </div>

      {pollResult ? <AssumptionsPanel pollResult={pollResult} /> : null}
    </aside>
  );
}
