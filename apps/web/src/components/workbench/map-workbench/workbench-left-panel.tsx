"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, Route, SlidersHorizontal, Zap } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";
import type { WorkbenchLayerId, WorkbenchMode, WorkbenchResultCard } from "./types";
import { ContractConstraints, getFleetContractDefaults } from "./inputs/contract-constraints";
import { RouteBuilder } from "./inputs/route-builder";
import { DRIVER_TRUCK_PROFILES, TruckProfileSelect } from "./inputs/truck-profile-select";
import { WorkdayConstraints, getDriverConstraintDefaults } from "./inputs/workday-constraints";

type WorkbenchLeftPanelProps = {
  mode?: WorkbenchMode;
  className?: string;
};

const quickRoutes = [
  {
    id: "polb-barstow",
    label: "POLB → Barstow",
    meta: "128 mi · I-710 / I-15",
    origin: { id: "polb", label: "Port of Long Beach", latitude: 33.7542, longitude: -118.2165, kind: "port" as const, source: "fleetvolt" as const },
    destination: { label: "Barstow", latitude: 34.8958, longitude: -117.0173, kind: "manual" as const, source: "manual" as const },
  },
  {
    id: "oakland-tracy",
    label: "Oakland → Tracy",
    meta: "63 mi · I-580",
    origin: { label: "Port of Oakland", latitude: 37.7955, longitude: -122.2793, kind: "port" as const, source: "fleetvolt" as const },
    destination: { label: "Tracy", latitude: 37.7397, longitude: -121.4252, kind: "manual" as const, source: "manual" as const },
  },
  {
    id: "fontana-la",
    label: "Fontana → LA Basin",
    meta: "54 mi · I-10",
    origin: { label: "Fontana", latitude: 34.0922, longitude: -117.435, kind: "manual" as const, source: "manual" as const },
    destination: { label: "Los Angeles Basin", latitude: 34.0522, longitude: -118.2437, kind: "manual" as const, source: "manual" as const },
  },
];

const layerToggles: Array<{ id: WorkbenchLayerId; label: string }> = [
  { id: "route", label: "Route" },
  { id: "chargers", label: "Chargers" },
  { id: "parking", label: "Parking" },
  { id: "pois", label: "POIs" },
  { id: "class8-gaps", label: "Class 8 gaps" },
  { id: "freight-flow", label: "Freight flow" },
];

function resolvePanelMode(mode: WorkbenchMode | undefined, rawMode: string | null): WorkbenchMode {
  if (mode) return mode;
  if (rawMode === "fleet_contract_plan" || rawMode === "caas_gap_map" || rawMode === "driver_day_plan") return rawMode;
  return "driver_day_plan";
}

export function WorkbenchLeftPanel({ mode: modeProp, className }: WorkbenchLeftPanelProps) {
  const searchParams = useSearchParams();
  const mode = resolvePanelMode(modeProp, searchParams.get("mode"));
  const [runError, setRunError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const storeMode = useMapWorkbenchStore((state) => state.mode);
  const draft = useMapWorkbenchStore((state) => state.draft);
  const activeLayers = useMapWorkbenchStore((state) => state.activeLayers);
  const applyDraftPatch = useMapWorkbenchStore((state) => state.applyDraftPatch);
  const toggleLayer = useMapWorkbenchStore((state) => state.toggleLayer);
  const runDriverDayPlan = useAction(api.workbench.actions.driverDayPlan);
  const runFleetContractPlan = useAction(api.workbench.actions.fleetContractPlan);

  useEffect(() => {
    if (storeMode !== mode) {
      useMapWorkbenchStore.getState().reset(mode);
    }
  }, [mode, storeMode]);

  function applyQuickRoute(route: (typeof quickRoutes)[number]) {
    applyDraftPatch({ origin: route.origin, destination: route.destination });
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
      });
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
      });
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

  const calculatePlan = mode === "fleet_contract_plan" ? calculateFleetContractPlan : calculateDriverPlan;
  const canRunPlan = mode === "driver_day_plan" || mode === "fleet_contract_plan";

  return (
    <aside
      data-testid="workbench-left-panel"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden border-r border-black/10 bg-[var(--fv-paper)]/95 shadow-[inset_-1px_0_0_rgba(255,255,255,0.55)]",
        className,
      )}
      aria-label="Workbench tools"
    >
      <div className="border-b border-black/10 px-4 py-3">
        <TechnicalLabel>{mode === "driver_day_plan" ? "Driver mode" : mode === "fleet_contract_plan" ? "Fleet mode" : "Workbench tools"}</TechnicalLabel>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--fv-graphite)]">
          {mode === "driver_day_plan" ? "Day-plan inputs" : mode === "fleet_contract_plan" ? "Contract inputs" : "Plan inputs"}
        </h2>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
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
            <TechnicalLabel>Layers</TechnicalLabel>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {layerToggles.map((layer) => {
              const isActive = activeLayers.includes(layer.id);
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => toggleLayer(layer.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 text-xs font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]",
                    isActive
                      ? "border-[var(--fv-accent)] bg-[var(--fv-accent)] text-white"
                      : "border-black/10 bg-white text-[var(--fv-graphite)] hover:border-[var(--fv-accent)]",
                  )}
                >
                  {layer.label}
                </button>
              );
            })}
          </div>
        </section>

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
          {isRunning
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
