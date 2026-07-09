"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Filter, Loader2, MapPinned, Route, SlidersHorizontal, Zap } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";
import type { WorkbenchMode, WorkbenchResultCard } from "./types";
import type { WorkbenchMapAsset } from "./layers/asset-marker-layer";
import { AiCommandBar } from "./ai-command-bar";
import { ContractConstraints, getFleetContractDefaults } from "./inputs/contract-constraints";
import { RouteBuilder } from "./inputs/route-builder";
import { DriverProfileSelect } from "./inputs/driver-profile-select";
import { DRIVER_TRUCK_PROFILES, TruckProfileSelect } from "./inputs/truck-profile-select";
import { WorkdayConstraints, getDriverConstraintDefaults } from "./inputs/workday-constraints";
import { CORE_CORRIDORS } from "@/lib/workbench/core-routes";
import {
  filtersForMode,
  layersForMode,
  type LayerFilterId,
} from "./role-layers";

type WorkbenchLeftPanelProps = {
  mode?: WorkbenchMode;
  className?: string;
  /** When embedded in the stacked tool rail accordion, hide duplicate chrome. */
  chrome?: "standalone" | "embedded";
};

const quickRoutes = CORE_CORRIDORS.map((corridor) => ({
  id: corridor.id,
  label: corridor.label,
  meta: corridor.meta,
  origin: corridor.origin,
  destination: corridor.destination,
}));

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

const caasDrilldownLabels = ["US", "State", "County", "Air district", "ZIP", "City", "Address"];

export function WorkbenchLeftPanel({
  mode: modeProp,
  className,
  chrome = "standalone",
}: WorkbenchLeftPanelProps) {
  const searchParams = useSearchParams();
  const mode = resolvePanelMode(modeProp, searchParams.get("mode"));
  const [runError, setRunError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeFilters, setActiveFilters] = useState<LayerFilterId[]>([]);
  const storeMode = useMapWorkbenchStore((state) => state.mode);
  const draft = useMapWorkbenchStore((state) => state.draft);
  const activeLayers = useMapWorkbenchStore((state) => state.activeLayers);
  const applyDraftPatch = useMapWorkbenchStore((state) => state.applyDraftPatch);
  const toggleLayer = useMapWorkbenchStore((state) => state.toggleLayer);
  const layerToggles = layersForMode(mode);
  const layerFilters = filtersForMode(mode);

  function toggleFilter(filterId: LayerFilterId) {
    setActiveFilters((prev) => {
      const next = prev.includes(filterId)
        ? prev.filter((id) => id !== filterId)
        : [...prev, filterId];
      applyDraftPatch({
        metadata: {
          ...(useMapWorkbenchStore.getState().draft.metadata ?? {}),
          layerFilters: next,
        },
      });
      return next;
    });
  }
  const runDriverDayPlan = useAction(api["workbench/actions"].driverDayPlan);
  const runFleetContractPlan = useAction(api["workbench/actions"].fleetContractPlan);
  const saveWorkbenchRun = useMutation(api["workbench/runs"].saveRun);
  const caasOpportunity = useQuery(
    api["workbench/queries"].caasOpportunityMap,
    mode === "caas_gap_map" ? { limit: 12 } : "skip",
  );
  const caasPhase = useMapWorkbenchStore((state) => state.caasPhase);
  const setCaasPhase = useMapWorkbenchStore((state) => state.setCaasPhase);
  const freightViaFilter = useMapWorkbenchStore(
    (state) => state.freightViaFilter,
  );
  const setFreightViaFilter = useMapWorkbenchStore(
    (state) => state.setFreightViaFilter,
  );
  const fetchRouteGeometry = useAction(api["workbench/actions"].routeGeometry);

  const truckSlug =
    typeof draft.metadata?.truckSlug === "string"
      ? draft.metadata.truckSlug
      : DRIVER_TRUCK_PROFILES[0].slug;
  const driverProfile =
    typeof draft.metadata?.driverProfile === "string"
      ? draft.metadata.driverProfile
      : "regional_drayage";

  const canRunCaasGaps = Boolean(
    mode === "caas_gap_map" &&
      draft.origin &&
      draft.destination &&
      truckSlug &&
      driverProfile,
  );

  const caasRouteOpportunity = useQuery(
    api["workbench/queries"].analyzeCaasRouteOpportunity,
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

  useEffect(() => {
    if (storeMode !== mode) {
      useMapWorkbenchStore.getState().reset(mode);
    }
  }, [mode, storeMode]);

  useEffect(() => {
    if (mode !== "caas_gap_map") return;

    if (caasPhase === "route_analysis" && caasRouteOpportunity) {
      useMapWorkbenchStore.setState({
        resultCards: caasRouteOpportunity.cards as unknown as WorkbenchResultCard[],
        providerWarnings: [
          "True vs detour-solvable gap classification uses Class 8 radius plus nearest-charger distance; detour route time remains unavailable unless provider data is connected.",
        ],
      });
      return;
    }

    if (caasPhase === "freight_overview" && caasOpportunity) {
      useMapWorkbenchStore.setState({
        resultCards: caasOpportunity.cards as WorkbenchResultCard[],
        providerWarnings: [
          "West-coast freight overview uses road-traced corridors + CalTrans truck AADT samples. Build a route with truck, A→B, and driver profile to run Class-8 gap analysis.",
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
  ]);

  async function runCaasGapAnalysis() {
    setRunError(null);
    if (!draft.origin || !draft.destination) {
      setRunError("Set point A and point B before finding charger gaps.");
      return;
    }
    if (!truckSlug || !driverProfile) {
      setRunError("Select a truck and driver profile before finding charger gaps.");
      return;
    }

    setIsRunning(true);
    try {
      setCaasPhase("route_analysis");
      // Immediate preview; then snap to roads like driver/fleet.
      useMapWorkbenchStore.setState({
        routeGeometry: {
          provider: "google",
          coordinates: [
            {
              latitude: draft.origin.latitude,
              longitude: draft.origin.longitude,
            },
            {
              latitude: draft.destination.latitude,
              longitude: draft.destination.longitude,
            },
          ],
          warnings: ["Snapping corridor to roads…"],
        },
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
      useMapWorkbenchStore.setState({
        routeGeometry: geometry,
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

  function applyQuickRoute(route: (typeof quickRoutes)[number]) {
    applyDraftPatch({ origin: route.origin, destination: route.destination });
    setCaasPhase("route_analysis");
    // Immediate straight-line preview; WorkbenchBootstrap upgrades to Google roads.
    useMapWorkbenchStore.setState({
      routeGeometry: {
        provider: "google",
        coordinates: [
          { latitude: route.origin.latitude, longitude: route.origin.longitude },
          {
            latitude: route.destination.latitude,
            longitude: route.destination.longitude,
          },
        ],
        warnings: ["Snapping corridor to roads…"],
      },
      focusBounds: {
        north:
          Math.max(route.origin.latitude, route.destination.latitude) + 0.35,
        south:
          Math.min(route.origin.latitude, route.destination.latitude) - 0.35,
        east:
          Math.max(route.origin.longitude, route.destination.longitude) + 0.45,
        west:
          Math.min(route.origin.longitude, route.destination.longitude) - 0.45,
      },
    });
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
  const caasDrilldown = caasOpportunity?.drilldown ?? caasDrilldownLabels.map((label, index) => ({
    label,
    enabled: index <= 2,
    reason: index <= 2 ? "geoRegions level available when data loads." : "Awaiting future geoRegion rows for this level.",
  }));

  return (
    <aside
      id="workbench-left-panel"
      data-testid="workbench-left-panel"
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

        {mode === "caas_gap_map" ? (
          <>
            <section className="space-y-2" aria-labelledby="caas-truck-heading">
              <div id="caas-truck-heading">
                <TechnicalLabel>Truck profile</TechnicalLabel>
              </div>
              <TruckProfileSelect />
            </section>
            <section className="space-y-2" aria-labelledby="caas-driver-heading">
              <div id="caas-driver-heading">
                <TechnicalLabel>Driver profile</TechnicalLabel>
              </div>
              <DriverProfileSelect />
            </section>
            <section
              className="space-y-3 rounded-2xl border border-black/10 bg-white/70 p-3"
              aria-labelledby="caas-phase-heading"
            >
              <div className="flex items-center gap-2" id="caas-phase-heading">
                <MapPinned size={16} className="text-[var(--fv-accent)]" />
                <TechnicalLabel>Map phase</TechnicalLabel>
              </div>
              <p className="text-xs leading-5 text-[var(--fv-steel)]">
                {caasPhase === "freight_overview"
                  ? "Road-traced freight corridors colored by CalTrans 5-axle truck AADT (green / yellow / red). Click a port tag for TEU + nearby generators. Compare POLB→Vegas via I-15 vs I-40."
                  : "Route analysis map — same road-snapped canvas as Driver / Fleet. Gap cards run on your A→B corridor."}
              </p>
              {caasPhase === "freight_overview" ? (
                <div className="space-y-2 rounded-xl border border-black/8 bg-[var(--fv-canvas)] p-3">
                  <TechnicalLabel>Corridor compare</TechnicalLabel>
                  <p className="text-[11px] text-[var(--fv-text-muted)]">
                    POLB / POLA → Las Vegas dual paths
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ["all", "Both"],
                        ["I-15", "I-15"],
                        ["I-40", "I-40"],
                      ] as const
                    ).map(([value, label]) => {
                      const active = freightViaFilter === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          data-testid={`freight-via-${value}`}
                          onClick={() => setFreightViaFilter(value)}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider",
                            active
                              ? "border-[var(--fv-graphite)] bg-[var(--fv-graphite)] text-white"
                              : "border-black/10 bg-white text-[var(--fv-steel)]",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] leading-4 text-[var(--fv-steel)]">
                    Google geometry is not truck-restriction-certified. AADT is
                    sampled from CalTrans postmiles along the path (CA coverage).
                  </p>
                </div>
              ) : null}
              {caasPhase === "route_analysis" ? (
                <button
                  type="button"
                  onClick={() => setCaasPhase("freight_overview")}
                  className="text-[11px] font-mono uppercase tracking-wider text-[var(--fv-blueprint-blue)] hover:underline"
                >
                  ← Back to freight overview
                </button>
              ) : null}
              <div className="space-y-1.5">
                {caasDrilldown.map((step) => (
                  <div
                    key={step.label}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3 py-2 text-xs",
                      step.enabled
                        ? "border-[var(--fv-accent)]/30 bg-[var(--fv-accent)]/10 text-[var(--fv-graphite)]"
                        : "border-black/10 bg-slate-50 text-[var(--fv-steel)] opacity-70",
                    )}
                    title={step.reason}
                  >
                    <span className="font-bold">{step.label}</span>
                    <span className="font-mono uppercase tracking-[0.12em]">
                      {step.enabled ? "available" : "deferred"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        <section className="space-y-2" aria-labelledby="quick-routes-heading">
          <TechnicalLabel>Quick corridors</TechnicalLabel>
          <div className="space-y-2" id="quick-routes-heading">
            {quickRoutes.map((route) => (
              <button
                key={route.id}
                type="button"
                onClick={() => applyQuickRoute(route)}
                className="min-h-11 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--fv-accent)] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
              >
                <span className="block text-sm font-semibold text-[var(--fv-graphite)]">{route.label}</span>
                <span className="block text-xs text-[var(--fv-steel)]">{route.meta}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2" aria-labelledby="layers-heading">
          <div className="flex items-center gap-2" id="layers-heading">
            <SlidersHorizontal size={16} className="text-[var(--fv-accent)]" />
            <TechnicalLabel>
              {mode === "caas_gap_map"
                ? "Full map suite"
                : mode === "fleet_contract_plan"
                  ? "Fleet layers"
                  : "Driver layers"}
            </TechnicalLabel>
          </div>
          <p className="text-[10px] leading-4 text-[var(--fv-steel)]">
            {mode === "driver_day_plan"
              ? "Charge · park · amenities on your A→B route. No carrier or census noise."
              : mode === "fleet_contract_plan"
                ? "Yards, highways, and chargers for contract corridor sizing."
                : "Every dataset — gaps, carriers, freight flow, census, CaaS zones."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {layerToggles.map((layer) => {
              const isActive = activeLayers.includes(layer.id);
              return (
                <button
                  key={layer.id}
                  type="button"
                  data-testid={`workbench-layer-toggle-${layer.id}`}
                  title={layer.hint}
                  onClick={() => toggleLayer(layer.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 text-left text-xs font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]",
                    isActive
                      ? "border-[var(--fv-accent)] bg-[var(--fv-accent)] text-white"
                      : "border-black/10 bg-white text-[var(--fv-graphite)] hover:border-[var(--fv-accent)]",
                  )}
                >
                  <span className="block">{layer.label}</span>
                  <span
                    className={cn(
                      "mt-0.5 block text-[10px] font-medium leading-3",
                      isActive ? "text-white/80" : "text-[var(--fv-steel)]",
                    )}
                  >
                    {layer.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {layerFilters.length > 0 ? (
          <section className="space-y-2" aria-labelledby="filters-heading">
            <div className="flex items-center gap-2" id="filters-heading">
              <Filter size={16} className="text-[var(--fv-accent)]" />
              <TechnicalLabel>Dataset filters</TechnicalLabel>
            </div>
            <p className="text-[10px] leading-4 text-[var(--fv-steel)]">
              {mode === "caas_gap_map"
                ? "e.g. cold-storage / reefer freight leaving a port — higher aux load."
                : "Narrow chargers and sites to what this role needs."}
            </p>
            <div className="flex flex-col gap-2">
              {layerFilters.map((filter) => {
                const isActive = activeFilters.includes(filter.id);
                return (
                  <button
                    key={filter.id}
                    type="button"
                    data-testid={`workbench-filter-${filter.id}`}
                    onClick={() => toggleFilter(filter.id)}
                    aria-pressed={isActive}
                    className={cn(
                      "min-h-11 rounded-xl border px-3 py-2 text-left text-xs font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]",
                      isActive
                        ? "border-[var(--fv-blueprint-blue)] bg-[var(--fv-blueprint-blue)]/10 text-[var(--fv-graphite)]"
                        : "border-black/10 bg-white text-[var(--fv-graphite)] hover:border-[var(--fv-accent)]",
                    )}
                  >
                    <span className="block">{filter.label}</span>
                    <span className="mt-0.5 block text-[10px] font-medium leading-3 text-[var(--fv-steel)]">
                      {filter.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
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
          {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
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
                    : "Select driver profile"
            : isRunning
              ? mode === "fleet_contract_plan"
                ? "Running contract plan"
                : "Running day plan"
              : mode === "fleet_contract_plan"
                ? "Calculate contract plan"
                : "Calculate day plan"}
        </button>
        {mode === "caas_gap_map" && !canRunCaasGaps ? (
          <p className="mt-2 text-center text-[10px] leading-4 text-[var(--fv-steel)]">
            Gap analysis unlocks after truck, point A, point B, and driver profile are set.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
