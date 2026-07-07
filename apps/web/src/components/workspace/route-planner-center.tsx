"use client";

import type { RefObject } from "react";
import { useEffect } from "react";
import type { FvMapHandle } from "@/lib/map-ref";
import type { components } from "@fleetvolt/shared-types";
import { SocProfileChart } from "@/components/charts/soc-profile-chart";
import { FvVizPanel } from "@/components/design/fv-viz-panel";
import { SummaryMetricsRow } from "@/components/kpi/summary-metrics-row";
import { RouteMapDynamic } from "@/components/map/route-map-dynamic";
import { MapTokenMissingBanner } from "@/components/map/map-token-missing-banner";
import { useScenarioStore } from "@/stores/scenario-store";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];

type RoutePlannerCenterProps = {
  pollResult: SimulationJobPollResponse | null;
  corridorName: string;
  mapRef: RefObject<FvMapHandle | null>;
};

export function RoutePlannerCenter({
  pollResult,
  corridorName,
  mapRef,
}: RoutePlannerCenterProps) {
  const registerMapSnapshotCapture = useScenarioStore(
    (s) => s.registerMapSnapshotCapture,
  );
  const routeGeometry = useScenarioStore((s) =>
    pollResult?.job_id
      ? s.routeCoordinatesByJobId[pollResult.job_id]
      : undefined,
  );
  const isRouteLoading = useScenarioStore((s) => s.isRouteLoading);
  const hasMapToken = Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY &&
      process.env.NEXT_PUBLIC_GOOGLE_MAP_ID,
  );
  const outputs = pollResult?.outputs;
  const weatherLabel =
    (pollResult?.inputs as { conditions?: { weather_preset?: string } })
      ?.conditions?.weather_preset ?? "—";

  useEffect(() => {
    if (!hasMapToken || !routeGeometry || pollResult?.status !== "COMPLETE") {
      registerMapSnapshotCapture(null);
      return;
    }

    registerMapSnapshotCapture(async () => {
      return (await mapRef.current?.captureSnapshot()) ?? null;
    });

    return () => registerMapSnapshotCapture(null);
  }, [
    hasMapToken,
    pollResult?.status,
    registerMapSnapshotCapture,
    routeGeometry,
  ]);

  if (!outputs || pollResult?.status !== "COMPLETE") {
    return (
      <section className="flex flex-col" data-testid="results-canvas">
        <FvVizPanel
          title={`ROUTE ELEVATION & CHARGE PLAN — ${corridorName}`}
          meta="Awaiting simulation"
        >
          <div
            className="flex min-h-[360px] flex-col items-center justify-center text-center"
            data-testid="results-primary-panel"
          >
            <p className="text-[15px] font-semibold text-[#1a1a1e]">
              Configure corridor and run physics simulation
            </p>
            <p className="mt-2 max-w-sm font-mono text-[10px] leading-relaxed text-[#9a9aa2]">
              Select truck, corridor preset, and weather — then ▶ Run Physics
              Simulation. Map, SoC profile, and charging plan render here.
            </p>
          </div>
        </FvVizPanel>
      </section>
    );
  }

  const segments = outputs.segments ?? [];
  const chargingStops = outputs.charging_stops ?? [];

  return (
    <section className="flex flex-col" data-testid="results-canvas">
      <FvVizPanel
        title={`ROUTE ELEVATION & CHARGE PLAN — ${corridorName.toUpperCase()}`}
        meta={String(weatherLabel)}
        data-testid="results-primary-panel"
      >
        <div className="min-h-[360px] transition-transform duration-300 hover:scale-[1.01]">
          <div data-testid="results-map-panel" className="min-h-[360px]">
            {!hasMapToken ? (
              <MapTokenMissingBanner />
            ) : isRouteLoading || !routeGeometry ? (
              <div
                className="min-h-[360px] animate-pulse rounded-[10px] bg-[#e0e0e6]"
                data-testid="route-map-loading"
              />
            ) : (
              <RouteMapDynamic
                segments={segments}
                chargingStops={chargingStops}
                routeCoords={routeGeometry.coordinates}
                routeDistanceM={routeGeometry.distance_m}
                mapRef={mapRef}
              />
            )}
          </div>
        </div>
      </FvVizPanel>

      <SummaryMetricsRow outputs={outputs} />

      <FvVizPanel
        className="mt-3"
        title="STATE OF CHARGE — % vs DISTANCE"
        data-testid="results-chart-panel"
      >
        <SocProfileChart
          segments={segments}
          chargingStops={chargingStops}
          routeCoords={routeGeometry?.coordinates}
        />
      </FvVizPanel>
    </section>
  );
}
