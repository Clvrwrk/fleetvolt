"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Route, Zap } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { TechnicalLabel } from "@/components/design/technical-label";
import { FleetVoltLoader } from "@/components/design/fleetvolt-loader";
import { cn } from "@/lib/utils";
import {
  buildClass8GapCandidates,
  type CaasGapOpportunityEvidence,
} from "@/lib/maps/class8-gap-candidates";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";
import type { WorkbenchMode, WorkbenchResultCard } from "./types";
import type { WorkbenchMapAsset } from "./layers/asset-marker-layer";
import { AiCommandBar } from "./ai-command-bar";
import { ContractConstraints, getFleetContractDefaults } from "./inputs/contract-constraints";
import { RouteBuilder } from "./inputs/route-builder";
import { DRIVER_TRUCK_PROFILES, TruckProfileSelect } from "./inputs/truck-profile-select";
import { WorkdayConstraints, getDriverConstraintDefaults } from "./inputs/workday-constraints";

type WorkbenchLeftPanelProps = {
  mode?: WorkbenchMode;
  className?: string;
  testId?: string;
  panelId?: string;
  /** When embedded in the stacked tool rail accordion, hide duplicate chrome. */
  chrome?: "standalone" | "embedded";
};

function resolvePanelMode(mode: WorkbenchMode | undefined, rawMode: string | null): WorkbenchMode {
  if (mode) return mode;
  if (rawMode === "fleet_contract_plan" || rawMode === "caas_gap_map" || rawMode === "driver_day_plan") return rawMode;
  return "driver_day_plan";
}

function routePointsForCaaS(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
) {
  return [
    { lat: origin.latitude, lng: origin.longitude },
    {
      lat: (origin.latitude + destination.latitude) / 2,
      lng: (origin.longitude + destination.longitude) / 2,
    },
    { lat: destination.latitude, lng: destination.longitude },
  ];
}

export function WorkbenchLeftPanel({
  mode: modeProp,
  className,
  testId = "workbench-left-panel",
  panelId = "workbench-left-panel",
  chrome = "standalone",
}: WorkbenchLeftPanelProps) {
  const searchParams = useSearchParams();
  const mode = resolvePanelMode(modeProp, searchParams.get("mode"));
  const [runError, setRunError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const draft = useMapWorkbenchStore((state) => state.draft);

  const runDriverDayPlan = useAction(api.workbench.actions.driverDayPlan);
  const runFleetContractPlan = useAction(api.workbench.actions.fleetContractPlan);
  const saveWorkbenchRun = useMutation(api.workbench.runs.saveRun);
  const caasOpportunity = useQuery(
    api.workbench.queries.caasOpportunityMap,
    mode === "caas_gap_map" ? { limit: 12 } : "skip",
  );
  const caasPhase = useMapWorkbenchStore((state) => state.caasPhase);
  const setCaasPhase = useMapWorkbenchStore((state) => state.setCaasPhase);
  const fetchRouteGeometry = useAction(api.workbench.actions.routeGeometry);

  const truckSlug =
    typeof draft.metadata?.truckSlug === "string"
      ? draft.metadata.truckSlug
      : DRIVER_TRUCK_PROFILES[0].slug;
  const canRunCaasGaps = Boolean(
    mode === "caas_gap_map" &&
      draft.origin &&
      draft.destination &&
      truckSlug,
  );

  const caasRouteOpportunity = useQuery(
    api.workbench.queries.analyzeCaasRouteOpportunity,
    mode === "caas_gap_map" &&
      caasPhase === "route_analysis" &&
      draft.origin &&
      draft.destination
      ? {
          origin: { lat: draft.origin.latitude, lng: draft.origin.longitude },
          destination: {
            lat: draft.destination.latitude,
            lng: draft.destination.longitude,
          },
          corridorPoints: routePointsForCaaS(draft.origin, draft.destination),
        }
      : "skip",
  );
  const gapCandidateCenter =
    mode === "caas_gap_map" &&
    caasPhase === "route_analysis" &&
    draft.origin &&
    draft.destination
      ? {
          lat: (draft.origin.latitude + draft.destination.latitude) / 2,
          lng: (draft.origin.longitude + draft.destination.longitude) / 2,
        }
      : null;
  const routeParkingCandidates = useQuery(
    api.pois.queries.parkingInRadius,
    gapCandidateCenter
      ? { ...gapCandidateCenter, radiusM: 45_000, limit: 8 }
      : "skip",
  );
  const routePoiCandidates = useQuery(
    api.pois.queries.poisInRadius,
    gapCandidateCenter
      ? {
          ...gapCandidateCenter,
          radiusM: 45_000,
          types: ["truck_stop", "rest_area", "fuel", "food"],
          limit: 8,
        }
      : "skip",
  );

  useEffect(() => {
    if (mode !== "caas_gap_map") return;

    if (caasPhase === "route_analysis" && caasRouteOpportunity) {
      const opportunityEvidence = caasRouteOpportunity as CaasGapOpportunityEvidence;
      const gapCandidates = buildClass8GapCandidates(
        {
          ...opportunityEvidence,
          hotspot: {
            ...(opportunityEvidence.hotspot ?? {}),
            parking: routeParkingCandidates
              ? {
                  parking: routeParkingCandidates.parking,
                  totalSpots: routeParkingCandidates.totalSpotsWithinRadius,
                }
              : opportunityEvidence.hotspot?.parking,
            pois: routePoiCandidates
              ? { pois: routePoiCandidates.pois }
              : opportunityEvidence.hotspot?.pois,
          },
          route:
            draft.origin && draft.destination
              ? {
                  ...(opportunityEvidence.route ?? {}),
                  origin: {
                    lat: draft.origin.latitude,
                    lng: draft.origin.longitude,
                  },
                  destination: {
                    lat: draft.destination.latitude,
                    lng: draft.destination.longitude,
                  },
                  midpoint: opportunityEvidence.route?.midpoint ?? {
                    lat: (draft.origin.latitude + draft.destination.latitude) / 2,
                    lng: (draft.origin.longitude + draft.destination.longitude) / 2,
                  },
                }
              : opportunityEvidence.route,
        },
      );
      const currentState = useMapWorkbenchStore.getState();
      const currentAssets = currentState.mapAssets;
      useMapWorkbenchStore.setState({
        resultCards: caasRouteOpportunity.cards as unknown as WorkbenchResultCard[],
        mapAssets: [
          ...currentAssets.filter((asset) => asset.layerId !== "class8-gaps"),
          ...gapCandidates,
        ],
        activeLayers:
          gapCandidates.length > 0 && !currentState.activeLayers.includes("class8-gaps")
            ? [...currentState.activeLayers, "class8-gaps"]
            : currentState.activeLayers,
        providerWarnings: [
          gapCandidates.length > 0
            ? `${gapCandidates.length} modeled mobile-charge candidate(s) anchored to route-area dwell assets. Site access and utility capacity require validation.`
            : "No mobile-charge GAP candidate was generated because the current evidence shows corridor coverage without a modeled dwell/capacity opportunity.",
          "True vs detour-solvable classification uses Class 8 radius plus nearest-charger distance; detour route time remains unavailable unless provider data is connected.",
        ],
      });
      return;
    }

    if (caasPhase === "freight_overview" && caasOpportunity) {
      const currentAssets = useMapWorkbenchStore.getState().mapAssets;
      useMapWorkbenchStore.setState({
        resultCards: caasOpportunity.cards as WorkbenchResultCard[],
        mapAssets: currentAssets.filter((asset) => asset.layerId !== "class8-gaps"),
        providerWarnings: [
          "West-coast freight overview uses road-traced corridors + CalTrans truck AADT samples. Build a route with a truck and A→B endpoints to run Class-8 gap analysis; standard vehicle operations are assumed.",
        ],
      });
    }
  }, [
    caasOpportunity,
    caasPhase,
    caasRouteOpportunity,
    draft.destination,
    draft.origin,
    mode,
    routeParkingCandidates,
    routePoiCandidates,
  ]);

  async function runCaasGapAnalysis() {
    setRunError(null);
    if (!draft.origin || !draft.destination) {
      setRunError("Set point A and point B before finding charger gaps.");
      return;
    }
    if (!truckSlug) {
      setRunError("Select a truck before finding charger gaps.");
      return;
    }

    setIsRunning(true);
    try {
      setCaasPhase("route_analysis");
      // Keep the map honest while the provider builds road geometry.
      useMapWorkbenchStore.setState({
        routeGeometry: null,
        mapAssets: useMapWorkbenchStore
          .getState()
          .mapAssets.filter((asset) => asset.layerId !== "class8-gaps"),
        providerWarnings: ["Loading road geometry…"],
      });

      const geometry = await fetchRouteGeometry({
        origin: {
          latitude: draft.origin.latitude,
          longitude: draft.origin.longitude,
        },
        destination: {
          latitude: draft.destination.latitude,
          longitude: draft.destination.longitude,
        },
      });
      const focus = {
        north:
          Math.max(draft.origin.latitude, draft.destination.latitude) + 0.35,
        south:
          Math.min(draft.origin.latitude, draft.destination.latitude) - 0.35,
        east:
          Math.max(draft.origin.longitude, draft.destination.longitude) + 0.45,
        west:
          Math.min(draft.origin.longitude, draft.destination.longitude) - 0.45,
      };
      // Prefer road-snapped bounds when we have a polyline.
      const coords = geometry.coordinates ?? [];
      if (coords.length >= 2) {
        let north = coords[0]!.latitude;
        let south = coords[0]!.latitude;
        let east = coords[0]!.longitude;
        let west = coords[0]!.longitude;
        for (const c of coords) {
          north = Math.max(north, c.latitude);
          south = Math.min(south, c.latitude);
          east = Math.max(east, c.longitude);
          west = Math.min(west, c.longitude);
        }
        const latPad = Math.max(0.12, (north - south) * 0.22);
        const lngPad = Math.max(0.12, (east - west) * 0.22);
        focus.north = north + latPad;
        focus.south = south - latPad;
        focus.east = east + lngPad;
        focus.west = west - lngPad;
      }
      const usableGeometry = (geometry.coordinates?.length ?? 0) >= 8;
      useMapWorkbenchStore.setState({
        routeGeometry: usableGeometry ? geometry : null,
        providerWarnings: geometry.warnings ?? [],
        focusBounds: focus,
        caasPhase: "route_analysis",
      });
    } catch (error) {
      setRunError(
        error instanceof Error
          ? error.message
          : "Could not build route geometry for gap analysis.",
      );
    } finally {
      setIsRunning(false);
    }
  }

  async function calculateDriverPlan() {
    setRunError(null);
    if (!draft.origin || !draft.destination) {
      setRunError("Choose an origin and destination before running the driver day plan.");
      return;
    }

    const defaults = getDriverConstraintDefaults();
    const metadata = useMapWorkbenchStore.getState().draft.metadata ?? {};
    const truckSlug = typeof metadata.truckSlug === "string" ? metadata.truckSlug : DRIVER_TRUCK_PROFILES[0].slug;

    setIsRunning(true);
    try {
      // Clear stale POLB/sample pins while the new corridor calculates.
      useMapWorkbenchStore.setState({ mapAssets: [] });
      const result = await runDriverDayPlan({
        origin: draft.origin,
        destination: draft.destination,
        truckSlug,
        roundTrips: defaults.roundTrips,
        payloadLbs: defaults.payloadLbs,
        weatherPreset: defaults.weatherPreset as "ideal" | "hot" | "cold" | "headwind",
        workdayHours: defaults.workdayHours,
        breakMinutes: defaults.breakMinutes,
        includePortDrayage: draft.origin.kind === "port" || draft.destination.kind === "port",
      });
      useMapWorkbenchStore.setState({
        routeGeometry: result.routeGeometry,
        resultCards: result.resultCards as WorkbenchResultCard[],
        providerWarnings: result.providerWarnings ?? [],
        mapAssets: Array.isArray(result.mapPins)
          ? (result.mapPins as WorkbenchMapAsset[])
          : [],
      });
      try {
        await saveWorkbenchRun({
          mode: "driver_day_plan",
          origin: {
            label: draft.origin.label,
            latitude: draft.origin.latitude,
            longitude: draft.origin.longitude,
            kind: draft.origin.kind,
            source: draft.origin.source,
            id: draft.origin.id,
          },
          destination: {
            label: draft.destination.label,
            latitude: draft.destination.latitude,
            longitude: draft.destination.longitude,
            kind: draft.destination.kind,
            source: draft.destination.source,
            id: draft.destination.id,
          },
          routeGeometry: result.routeGeometry,
          resultCards: result.resultCards,
          providerWarnings: result.providerWarnings ?? [],
          metadata: {
            ...(useMapWorkbenchStore.getState().draft.metadata ?? {}),
            mapPins: result.mapPins ?? [],
          },
        });
      } catch (persistError) {
        // Persistence is best-effort — Calculate results already live in the store.
        console.warn("[workbench] saveRun skipped", persistError);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunError(message);
      useMapWorkbenchStore.setState({
        resultCards: [
          {
            id: "driver-run-error",
            title: "Driver plan unavailable",
            summary: message,
            mode: "driver_day_plan",
            severity: "critical",
          },
        ],
      });
    } finally {
      setIsRunning(false);
    }
  }

  async function calculateFleetContractPlan() {
    setRunError(null);
    if (!draft.origin || !draft.destination) {
      setRunError("Choose a port/origin and inland destination before running the fleet contract plan.");
      return;
    }

    const defaults = getFleetContractDefaults();
    const metadata = useMapWorkbenchStore.getState().draft.metadata ?? {};
    const truckSlug = typeof metadata.truckSlug === "string" ? metadata.truckSlug : DRIVER_TRUCK_PROFILES[0].slug;
    const weatherPreset = typeof metadata.weatherPreset === "string" ? metadata.weatherPreset : "ideal";
    const payloadLbs = typeof metadata.payloadLbs === "number" ? metadata.payloadLbs : 34_000;

    setIsRunning(true);
    try {
      const result = await runFleetContractPlan({
        origin: draft.origin,
        destination: draft.destination,
        truckSlug,
        payloadLbs,
        weatherPreset: weatherPreset as "ideal" | "hot" | "cold" | "headwind",
        serviceDate: defaults.serviceDate,
        scheduleWindow: defaults.scheduleWindow,
        containersPerDay: defaults.containersPerDay,
        gateStartHour: defaults.gateStartHour,
        gateEndHour: defaults.gateEndHour,
        portDwellMinutes: defaults.portDwellMinutes,
        destinationDwellMinutes: defaults.destinationDwellMinutes,
        shiftHours: defaults.shiftHours,
        yardReturn: defaults.yardReturn,
      });
      useMapWorkbenchStore.setState({
        routeGeometry: result.routeGeometry,
        resultCards: result.resultCards as WorkbenchResultCard[],
        providerWarnings: result.providerWarnings ?? [],
        mapAssets: Array.isArray(result.mapPins)
          ? (result.mapPins as WorkbenchMapAsset[])
          : [],
      });
      try {
        await saveWorkbenchRun({
          mode: "fleet_contract_plan",
          origin: {
            label: draft.origin.label,
            latitude: draft.origin.latitude,
            longitude: draft.origin.longitude,
            kind: draft.origin.kind,
            source: draft.origin.source,
            id: draft.origin.id,
          },
          destination: {
            label: draft.destination.label,
            latitude: draft.destination.latitude,
            longitude: draft.destination.longitude,
            kind: draft.destination.kind,
            source: draft.destination.source,
            id: draft.destination.id,
          },
          routeGeometry: result.routeGeometry,
          resultCards: result.resultCards,
          providerWarnings: result.providerWarnings ?? [],
          metadata: {
            ...(useMapWorkbenchStore.getState().draft.metadata ?? {}),
            mapPins: result.mapPins ?? [],
          },
        });
      } catch (persistError) {
        console.warn("[workbench] saveRun skipped", persistError);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunError(message);
      useMapWorkbenchStore.setState({
        resultCards: [
          {
            id: "fleet-run-error",
            title: "Fleet contract plan unavailable",
            summary: message,
            mode: "fleet_contract_plan",
            severity: "critical",
          },
        ],
      });
    } finally {
      setIsRunning(false);
    }
  }

  const calculatePlan =
    mode === "caas_gap_map"
      ? () => {
          void runCaasGapAnalysis();
        }
      : mode === "fleet_contract_plan"
        ? calculateFleetContractPlan
        : calculateDriverPlan;
  const canRunPlan =
    mode === "driver_day_plan" ||
    mode === "fleet_contract_plan" ||
    canRunCaasGaps;
  return (
    <aside
      id={panelId}
      data-testid={testId}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        chrome === "standalone" &&
          "border-r border-black/10 bg-[var(--fv-paper)]/95 shadow-[inset_-1px_0_0_rgba(255,255,255,0.55)]",
        className,
      )}
      aria-label="Workbench tools"
    >
      {chrome === "standalone" ? (
        <div className="border-b border-black/10 px-4 py-3">
          <TechnicalLabel>{mode === "driver_day_plan" ? "Driver mode" : mode === "fleet_contract_plan" ? "Fleet mode" : "CaaS mode"}</TechnicalLabel>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--fv-graphite)]">
            {mode === "driver_day_plan" ? "Day-plan inputs" : mode === "fleet_contract_plan" ? "Contract inputs" : "Gap / opportunity map"}
          </h2>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <AiCommandBar mode={mode} />

        {mode === "caas_gap_map" ? (
          <section className="space-y-2" aria-labelledby="caas-truck-heading">
            <div id="caas-truck-heading">
              <TechnicalLabel>Truck profile</TechnicalLabel>
            </div>
            <TruckProfileSelect />
          </section>
        ) : null}

        <section className="space-y-2" aria-labelledby="route-builder-heading">
          <div className="flex items-center gap-2" id="route-builder-heading">
            <Route size={16} className="text-[var(--fv-accent)]" />
            <TechnicalLabel>Route builder</TechnicalLabel>
          </div>
          <RouteBuilder />
        </section>

        {mode === "driver_day_plan" ? (
          <>
            <section className="space-y-2" aria-labelledby="driver-truck-heading">
              <div id="driver-truck-heading">
                <TechnicalLabel>Truck and payload</TechnicalLabel>
              </div>
              <TruckProfileSelect />
            </section>
            <section className="space-y-2" aria-labelledby="driver-constraints-heading">
              <div id="driver-constraints-heading">
                <TechnicalLabel>Workday constraints</TechnicalLabel>
              </div>
              <WorkdayConstraints />
            </section>
          </>
        ) : null}

        {mode === "fleet_contract_plan" ? (
          <>
            <section className="space-y-2" aria-labelledby="fleet-truck-heading">
              <div id="fleet-truck-heading">
                <TechnicalLabel>Contract truck profile</TechnicalLabel>
              </div>
              <TruckProfileSelect />
            </section>
            <section className="space-y-2" aria-labelledby="fleet-constraints-heading">
              <div id="fleet-constraints-heading">
                <TechnicalLabel>Schedule and contract constraints</TechnicalLabel>
              </div>
              <ContractConstraints />
            </section>
          </>
        ) : null}

        {runError ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs leading-5 text-red-900">
            <div className="flex gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{runError}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-black/10 p-4">
        <button
          type="button"
          onClick={calculatePlan}
          disabled={isRunning || !canRunPlan}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--fv-accent)] px-4 text-sm font-bold text-white shadow-sm transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRunning ? <FleetVoltLoader compact label="Calculating plan" /> : <Zap size={16} />}
          {mode === "caas_gap_map"
            ? isRunning
              ? "Building route…"
              : canRunCaasGaps
                ? caasPhase === "route_analysis"
                  ? "Refresh charger gaps"
                  : "Find Charger Gaps"
                : !draft.origin || !draft.destination
                  ? "Set point A + point B"
                  : !truckSlug
                    ? "Select truck profile"
                    : "Set point A + point B"
            : isRunning
              ? mode === "fleet_contract_plan"
                ? "Running contract plan"
                : "Running day plan"
              : mode === "fleet_contract_plan"
                ? "Calculate contract plan"
                : "Calculate day plan"}
        </button>
      </div>
    </aside>
  );
}
