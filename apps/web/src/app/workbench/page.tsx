"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Map, Route, Sparkles, Truck, Zap } from "lucide-react";

import { PrimaryButton } from "@/components/design/primary-button";
import { SecondaryButton } from "@/components/design/secondary-button";
import { StatusBadge } from "@/components/design/status-badge";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";

type WorkbenchMode = "driver_day_plan" | "fleet_contract_plan" | "caas_gap_map";

type WorkbenchModeConfig = {
  mode: WorkbenchMode;
  eyebrow: string;
  title: string;
  roleLabel: string;
  description: string;
  launcherHref: string;
  primaryAction: string;
  accent: "ok" | "warn" | "neutral";
  inputs: string[];
  layers: string[];
  resultCards: string[];
};

const DEFAULT_MODE: WorkbenchMode = "caas_gap_map";

const MODE_CONFIG: Record<WorkbenchMode, WorkbenchModeConfig> = {
  driver_day_plan: {
    mode: "driver_day_plan",
    eyebrow: "DRIVER DAY PLAN",
    title: "Plan tomorrow from a full-map workbench",
    roleLabel: "Driver",
    description:
      "Build a route, set round trips and truck constraints, then turn charger and parking layers into a feasible day plan.",
    launcherHref: "/driver/day-plan",
    primaryAction: "Start Day Plan",
    accent: "ok",
    inputs: ["Origin", "Destination", "Round trips", "Truck profile", "Workday constraints"],
    layers: ["Route", "Class-8 chargers", "Parking", "POIs"],
    resultCards: ["Feasibility", "Charge stops", "Detour warnings"],
  },
  fleet_contract_plan: {
    mode: "fleet_contract_plan",
    eyebrow: "FLEET CONTRACT PLAN",
    title: "Scope contract routes on the map",
    roleLabel: "Fleet Manager",
    description:
      "Model a port-to-destination contract with schedule, dwell, container volume, yards, chargers, and operational assumptions visible together.",
    launcherHref: "/fleet/contract-plan",
    primaryAction: "Plan Contract",
    accent: "ok",
    inputs: ["Port / origin", "Destination", "Containers per day", "Gate hours", "Yard return"],
    layers: ["Route", "Chargers", "Fleet yards", "Highways", "POIs"],
    resultCards: ["Trucks required", "Drivers required", "Charging downtime"],
  },
  caas_gap_map: {
    mode: "caas_gap_map",
    eyebrow: "CAAS GAP MAP",
    title: "Find Class-8 charging gaps by corridor",
    roleLabel: "CaaS",
    description:
      "Start from an opportunity map, drill into freight regions, and identify true charger gaps, carriers, parking, and mobile deployment seams.",
    launcherHref: "/caas/gap-map",
    primaryAction: "Find Charger Gaps",
    accent: "warn",
    inputs: ["Region / origin", "Destination", "Gap radius", "Demand window"],
    layers: ["Geo regions", "Class-8 gaps", "Carriers", "Parking", "Freight flow", "CaaS zones"],
    resultCards: ["True gaps", "Target carriers", "Mobile position"],
  },
};

function parseWorkbenchMode(rawMode: string | null): WorkbenchMode {
  if (rawMode === "driver_day_plan" || rawMode === "fleet_contract_plan" || rawMode === "caas_gap_map") {
    return rawMode;
  }

  return DEFAULT_MODE;
}

export default function WorkbenchPage() {
  return (
    <Suspense fallback={<WorkbenchLoadingFallback />}>
      <WorkbenchPageContent />
    </Suspense>
  );
}

function WorkbenchPageContent() {
  const searchParams = useSearchParams();
  const mode = parseWorkbenchMode(searchParams.get("mode"));
  const config = useMemo(() => MODE_CONFIG[mode], [mode]);

  return <MapWorkbenchShell config={config} />;
}

function WorkbenchLoadingFallback() {
  return (
    <div className="h-[calc(100dvh-3.5rem)] min-h-0 bg-[var(--fv-paper)] p-4">
      <div className="h-full rounded-3xl border border-black/10 bg-white/60" />
    </div>
  );
}

function MapWorkbenchShell({ config }: { config: WorkbenchModeConfig }) {
  return (
    <div
      data-testid="map-workbench-shell"
      className="h-[calc(100dvh-3.5rem)] min-h-0 overflow-hidden bg-[var(--fv-paper)] text-[var(--fv-graphite)]"
    >
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)_340px] lg:grid-rows-1">
        <aside
          data-testid="workbench-left-panel"
          className="z-10 border-b border-black/10 bg-[var(--fv-paper)] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.08)] lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r"
        >
          <div className="flex items-center justify-between gap-3">
            <TechnicalLabel>{config.eyebrow}</TechnicalLabel>
            <StatusBadge variant={config.accent}>{config.roleLabel}</StatusBadge>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--fv-graphite)]">
            {config.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--fv-text-muted)]">{config.description}</p>

          <div className="mt-5 rounded-2xl border border-black/10 bg-white/60 p-3">
            <TechnicalLabel className="mb-3 block">PLANNING INPUTS</TechnicalLabel>
            <div className="space-y-2">
              {config.inputs.map((input) => (
                <div
                  key={input}
                  className="flex items-center justify-between rounded-xl border border-dashed border-black/10 bg-[var(--fv-surface)] px-3 py-2 text-sm"
                >
                  <span>{input}</span>
                  <span className="font-mono text-[10px] uppercase text-[var(--fv-steel)]">Ready</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-black/10 bg-white/60 p-3">
            <TechnicalLabel className="mb-3 block">DEFAULT LAYERS</TechnicalLabel>
            <div className="flex flex-wrap gap-2">
              {config.layers.map((layer) => (
                <span
                  key={layer}
                  className="rounded-full border border-black/10 bg-[var(--fv-surface)] px-3 py-1 text-xs font-semibold text-[var(--fv-graphite)]"
                >
                  {layer}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <PrimaryButton block className="flex items-center justify-center gap-2">
              <Sparkles size={16} />
              Draft Plan
            </PrimaryButton>
            <Link href={config.launcherHref} className="no-underline">
              <SecondaryButton className="flex w-full items-center justify-center gap-2">
                Role launcher
                <ArrowRight size={14} />
              </SecondaryButton>
            </Link>
          </div>
        </aside>

        <main
          data-testid="fleetvolt-map-canvas-slot"
          className="relative min-h-0 overflow-hidden bg-[#dfe7e9]"
        >
          <div className="absolute inset-0 opacity-80 [background-image:linear-gradient(rgba(42,42,46,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(42,42,46,0.08)_1px,transparent_1px)] [background-size:36px_36px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(74,144,226,0.22),transparent_34%),radial-gradient(circle_at_62%_58%,rgba(59,130,91,0.20),transparent_28%)]" />
          <div className="absolute left-6 top-6 rounded-2xl border border-black/10 bg-white/85 p-3 shadow-lg backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Map size={16} className="text-[var(--fv-accent)]" />
              Canonical /workbench
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase text-[var(--fv-steel)]">
              mode={config.mode}
            </div>
          </div>
          <div className="absolute left-[18%] top-[30%] h-3 w-3 rounded-full bg-[var(--fv-accent)] shadow-[0_0_0_8px_rgba(74,144,226,0.16)]" />
          <div className="absolute right-[22%] top-[54%] h-3 w-3 rounded-full bg-[var(--fv-signal-green)] shadow-[0_0_0_8px_rgba(47,107,74,0.14)]" />
          <div className="absolute left-[19%] top-[32%] h-[3px] w-[58%] origin-left rotate-[14deg] rounded-full bg-[linear-gradient(90deg,var(--fv-accent),var(--fv-signal-green))] shadow-lg" />
          <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-black/10 bg-white/80 p-3 text-xs text-[var(--fv-text-muted)] shadow-lg backdrop-blur lg:left-auto lg:w-[360px]">
            Google vector map, route geometry, autocomplete, and live layers attach here in follow-up workbench tasks. This route skeleton keeps the map as the primary viewport surface.
          </div>
        </main>

        <aside
          data-testid="workbench-right-panel"
          className="hidden min-h-0 overflow-y-auto border-l border-black/10 bg-[var(--fv-paper)] p-4 lg:block"
        >
          <TechnicalLabel>RESULT CARDS</TechnicalLabel>
          <div className="mt-3 space-y-3">
            {config.resultCards.map((card, index) => (
              <div key={card} className="rounded-2xl border border-black/10 bg-white/65 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--fv-graphite)]">{card}</span>
                  {index === 0 ? <Route size={15} className="text-[var(--fv-accent)]" /> : <Truck size={15} className="text-[var(--fv-steel)]" />}
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--fv-text-muted)]">
                  Awaiting route inputs. Results will be grounded in route provider, Convex data, and FleetVolt assumptions.
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-amber-300/50 bg-amber-50/80 p-3 text-xs leading-5 text-amber-900">
            Google route geometry is not truck-restriction-certified; truck-aware routing remains a provider seam.
          </div>
        </aside>

        <div
          data-testid="mobile-workbench-sheet"
          className={cn(
            "fixed inset-x-3 bottom-16 z-20 rounded-2xl border border-black/10 bg-white/90 p-3 shadow-2xl backdrop-blur lg:hidden",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <TechnicalLabel>{config.eyebrow}</TechnicalLabel>
              <div className="mt-1 text-sm font-semibold text-[var(--fv-graphite)]">{config.primaryAction}</div>
            </div>
            <Zap size={18} className="text-[var(--fv-accent)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
