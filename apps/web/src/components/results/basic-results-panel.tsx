"use client";

import { useRef, useState } from "react";
import type { MapRef } from "react-map-gl/mapbox";
import type { components } from "@fleetvolt/shared-types";
import { KpiCardRow } from "@/components/kpi/kpi-card-row";
import { SocProfileChart } from "@/components/charts/soc-profile-chart";
import { RouteMapDynamic } from "@/components/map/route-map-dynamic";
import { MapTokenMissingBanner } from "@/components/map/map-token-missing-banner";
import { ChargingPlanTable } from "@/components/tables/charging-plan-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScenarioStore } from "@/stores/scenario-store";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];
type ChargingStop = components["schemas"]["ChargingStopResult"];

type BasicResultsPanelProps = {
  pollResult: SimulationJobPollResponse;
};

function stopKey(stop: ChargingStop, index: number): string {
  return stop.station_id || `stop-${index}`;
}

export function BasicResultsPanel({ pollResult }: BasicResultsPanelProps) {
  const outputs = pollResult.outputs;
  const jobId = pollResult.job_id;
  const mapRef = useRef<MapRef | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const routeGeometry = useScenarioStore(
    (s) => (jobId ? s.routeCoordinatesByJobId[jobId] : undefined),
  );
  const isRouteLoading = useScenarioStore((s) => s.isRouteLoading);

  if (!outputs) {
    return null;
  }

  const segments = outputs.segments ?? [];
  const chargingStops = outputs.charging_stops ?? [];
  const hasMapToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

  const handleStopSelect = (stop: ChargingStop) => {
    const index = chargingStops.indexOf(stop);
    setSelectedStopId(stopKey(stop, index >= 0 ? index : 0));
  };

  return (
    <div className="space-y-6">
      <KpiCardRow outputs={outputs} />

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
              mapRef={mapRef}
              selectedStopId={selectedStopId}
              onSelectStop={setSelectedStopId}
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

      <Tabs defaultValue="charging-plan" data-testid="results-tabs">
        <TabsList>
          <TabsTrigger value="charging-plan">Charging plan</TabsTrigger>
          <TabsTrigger value="comparison" disabled>
            Comparison
          </TabsTrigger>
        </TabsList>
        <TabsContent value="charging-plan">
          <ChargingPlanTable
            chargingStops={chargingStops}
            selectedStopId={selectedStopId}
            onStopSelect={handleStopSelect}
            mapRef={hasMapToken && routeGeometry ? mapRef : undefined}
          />
        </TabsContent>
      </Tabs>

    </div>
  );
}
