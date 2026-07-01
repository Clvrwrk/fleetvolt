"use client";

import type { components } from "@fleetvolt/shared-types";
import { SocProfileChart } from "@/components/charts/soc-profile-chart";
import { RouteMapDynamic } from "@/components/map/route-map-dynamic";
import { MapTokenMissingBanner } from "@/components/map/map-token-missing-banner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { deriveKpiSummary } from "@/lib/kpi";
import { useScenarioStore } from "@/stores/scenario-store";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];

type BasicResultsPanelProps = {
  pollResult: SimulationJobPollResponse;
};

export function BasicResultsPanel({ pollResult }: BasicResultsPanelProps) {
  const outputs = pollResult.outputs;
  const jobId = pollResult.job_id;
  const routeGeometry = useScenarioStore(
    (s) => (jobId ? s.routeCoordinatesByJobId[jobId] : undefined),
  );
  const isRouteLoading = useScenarioStore((s) => s.isRouteLoading);

  if (!outputs) {
    return null;
  }

  const kpi = deriveKpiSummary(outputs);
  const verdictLabel = kpi.feasibilityVerdict
    ? kpi.feasibilityVerdict.replace(/_/g, " ")
    : "unknown";
  const segments = outputs.segments ?? [];
  const chargingStops = outputs.charging_stops ?? [];
  const hasMapToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-4 text-lg font-medium">Simulation results</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-[var(--fv-surface)] p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total energy
            </dt>
            <dd className="mt-1 text-lg font-medium">{kpi.totalKwhFormatted}</dd>
          </div>
          <div className="rounded-lg bg-[var(--fv-surface)] p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Efficiency
            </dt>
            <dd className="mt-1 text-lg font-medium">{kpi.whPerMiFormatted}</dd>
          </div>
          <div className="rounded-lg bg-[var(--fv-surface)] p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Trip time
            </dt>
            <dd className="mt-1 text-lg font-medium">{kpi.tripTimeFormatted}</dd>
          </div>
          <div className="rounded-lg bg-[var(--fv-surface)] p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Feasibility
            </dt>
            <dd className="mt-1 text-lg font-medium capitalize">{verdictLabel}</dd>
          </div>
        </dl>
      </div>

      <div
        className="flex min-h-[360px] flex-col gap-4 lg:flex-row"
        data-testid="results-primary-panel"
      >
        <div className="min-h-[360px] flex-[3]" data-testid="results-map-panel">
          {!hasMapToken ? (
            <MapTokenMissingBanner />
          ) : isRouteLoading || !routeGeometry ? (
            <div
              className="min-h-[360px] animate-pulse rounded-lg bg-[var(--fv-surface)]"
              data-testid="route-map-loading"
            />
          ) : (
            <RouteMapDynamic
              segments={segments}
              chargingStops={chargingStops}
              routeCoords={routeGeometry.coordinates}
              routeDistanceM={routeGeometry.distance_m}
            />
          )}
        </div>

        <div className="min-h-[240px] flex-[2]" data-testid="results-chart-panel">
          <SocProfileChart
            segments={segments}
            chargingStops={chargingStops}
            routeCoords={routeGeometry?.coordinates}
          />
        </div>
      </div>

      {pollResult.inputs_hash && (
        <p className="mono text-xs text-muted-foreground">
          Audit hash: {pollResult.inputs_hash}
        </p>
      )}

      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger>Raw JSON response</CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <pre className="max-h-96 overflow-auto rounded-md bg-[var(--fv-surface)] p-4 text-xs">
            {JSON.stringify(pollResult, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
