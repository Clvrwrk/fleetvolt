"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAction } from "convex/react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { FleetVoltLoader } from "@/components/design/fleetvolt-loader";
import { api } from "../../../../convex/_generated/api";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";
import type { WorkbenchAiResult, WorkbenchMode } from "./types";

type AiCommandBarProps = {
  mode: WorkbenchMode;
  className?: string;
};

const EXAMPLE_PROMPTS: Record<WorkbenchMode, string[]> = {
  driver_day_plan: [
    "Draft POLB to Barstow day plan",
    "Enable charger layers for my route",
  ],
  fleet_contract_plan: [
    "Apply Oakland to Tracy contract assumptions",
    "Draft fleet contract layers",
  ],
  caas_gap_map: [
    "Show freight volume out of west coast ports",
    "Energy Forward 60-truck Long Beach to Shafter charging needs",
    "Long Beach to Tijuana interim capacity US and Mexico",
    "Highlight Class 8 charger gaps near POLB",
  ],
};

function humanizeClientError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/workbench\/ai:[a-zA-Z0-9_]+/g, "the planning assistant")
    .replace(/convex\/[a-zA-Z0-9_./:-]+/g, "the planning service")
    .slice(0, 220);
}

const POLB = {
  id: "polb",
  label: "Port of Long Beach",
  latitude: 33.7542,
  longitude: -118.2165,
  kind: "port" as const,
  source: "fleetvolt" as const,
};
const BARSTOW = {
  label: "Barstow",
  latitude: 34.8958,
  longitude: -117.0173,
  kind: "manual" as const,
  source: "manual" as const,
};
const OTAY = {
  id: "otay-mesa",
  label: "Otay Mesa / Tijuana border",
  latitude: 32.555,
  longitude: -116.938,
  kind: "manual" as const,
  source: "manual" as const,
};
const SHAFTER = {
  id: "shafter",
  label: "Shafter, CA",
  latitude: 35.5005,
  longitude: -119.2718,
  kind: "manual" as const,
  source: "manual" as const,
};
const OAKLAND = {
  label: "Port of Oakland",
  latitude: 37.7955,
  longitude: -122.2793,
  kind: "port" as const,
  source: "fleetvolt" as const,
};
const TRACY = {
  label: "Tracy",
  latitude: 37.7397,
  longitude: -121.4252,
  kind: "manual" as const,
  source: "manual" as const,
};

export function localAiFallback(
  mode: WorkbenchMode,
  message: string,
): WorkbenchAiResult {
  const lower = message.toLowerCase();

  // CaaS route / gap intents must stay in caas_gap_map — do not fall through to driver.
  if (mode === "caas_gap_map") {
    const wantsWestCoastFreight =
      /freight\s*(?:volume|flow)|west\s*coast\s*ports?|port\s*freight/.test(
        lower,
      );

    if (wantsWestCoastFreight) {
      const answerSummary =
        "Showing road-traced freight volume from west coast ports. Unrelated asset markers are hidden so corridor volume is readable.";
      return {
        id: `wbai_local_caas_freight_${Date.now()}`,
        mode: "caas_gap_map",
        answerSummary,
        mapActions: [
          {
            type: "set_layers",
            layers: ["ports", "freight-flow", "geo-regions", "highways"],
          },
          {
            type: "focus_bounds",
            bounds: { north: 49.2, south: 31.2, east: -112, west: -126.5 },
          },
        ],
        cards: [
          {
            id: "ai-caas-west-coast-freight",
            title: "West coast freight volume active",
            summary: answerSummary,
            mode: "caas_gap_map",
            severity: "success",
            layerId: "freight-flow",
          },
        ],
        queriesRun: [],
        fallback: true,
        model: "workbench-local-fallback",
      };
    }

    // Explicit supported pairs + Energy Forward ZE (skill-backed).
    const mentionsPolb = /\bpolb\b|long beach|port of long beach/.test(lower);
    const mentionsOtay = /\botay\b|tijuana/.test(lower);
    const mentionsBarstow = /\bbarstow\b/.test(lower);
    const mentionsShafter = /\bshafter\b/.test(lower);
    const energyForward =
      /energy\s*forward|60[- ]?truck|zero[- ]emission|ze\s+corridor/.test(
        lower,
      );
    const supportedPair =
      (mentionsPolb && mentionsOtay) ||
      (mentionsPolb && mentionsBarstow) ||
      (mentionsPolb && mentionsShafter) ||
      (energyForward && (mentionsOtay || mentionsShafter || mentionsPolb));
    const wantsRoute =
      supportedPair &&
      /route|gap|corridor|day.?plan|charg|capacity|\bto\b|→|->|fleet/.test(
        lower,
      ) &&
      !/freight volume|west coast ports|census|seattle/.test(lower);
    if (wantsRoute) {
      const destination = mentionsOtay
        ? OTAY
        : mentionsShafter || (energyForward && !mentionsBarstow)
          ? SHAFTER
          : BARSTOW;
      const zeMeta =
        destination === SHAFTER || destination === OTAY
          ? {
              zeCorridorId:
                destination === SHAFTER ? "lb-shafter" : "lb-tijuana",
              fleetSizeTrucks: 60,
              borderSides: destination === OTAY ? "US, Mexico" : "US",
              routingProvider: "preview",
            }
          : { routingProvider: "preview" };
      const skillSummary =
        destination === SHAFTER
          ? "Energy Forward ZE: Long Beach → Shafter. Model interim depot + en-route charging for a 60-truck Class 8 fleet (US only). PTV truck routing on Calculate."
          : destination === OTAY
            ? "Energy Forward ZE: Long Beach → Otay/Tijuana. Separate US-side and Mexico-side interim capacity; border dwell SoC reserve. PTV truck routing on Calculate."
            : `Drafted ${POLB.label} → ${destination.label} for Class 8 gap analysis. PTV truck routing on Calculate.`;
      return {
        id: `wbai_local_caas_route_${Date.now()}`,
        mode: "caas_gap_map",
        answerSummary: skillSummary,
        draftPatch: {
          origin: POLB,
          destination,
          vehicleClass: "Class 8 corridor",
          notes: `AI draft (route-planning skill): ${POLB.label} → ${destination.label}`,
          metadata: {
            truckSlug: "ecascadia_438",
            driverProfile: "regional_drayage",
            source: "workbench/ai:local_fallback",
            ...zeMeta,
          },
        },
        mapActions: [
          { type: "set_origin", place: POLB },
          { type: "set_destination", place: destination },
          {
            type: "set_layers",
            layers: [
              "route",
              "chargers",
              "parking",
              "class8-gaps",
              "carriers",
              "highways",
            ],
          },
          {
            type: "focus_bounds",
            bounds: {
              north: Math.max(POLB.latitude, destination.latitude) + 0.35,
              south: Math.min(POLB.latitude, destination.latitude) - 0.35,
              east: Math.max(POLB.longitude, destination.longitude) + 0.45,
              west: Math.min(POLB.longitude, destination.longitude) - 0.45,
            },
          },
        ],
        // Preview only — Calculate / bootstrap replaces this with PTV geometry.
        routeGeometry: {
          provider: "mock",
          coordinates: [
            { latitude: POLB.latitude, longitude: POLB.longitude },
            {
              latitude: (POLB.latitude + destination.latitude) / 2,
              longitude: (POLB.longitude + destination.longitude) / 2,
            },
            {
              latitude: destination.latitude,
              longitude: destination.longitude,
            },
          ],
          warnings: [
            "Preview endpoints — Calculate snaps Class-8 geometry via PTV.",
          ],
        },
        cards: [
          {
            id: "ai-caas-route-draft",
            title:
              destination === SHAFTER || destination === OTAY
                ? "ZE corridor drafted"
                : "Corridor drafted",
            summary: skillSummary,
            mode: "caas_gap_map",
            severity: "success",
            layerId: "route",
            metrics: {
              origin: POLB.label,
              destination: destination.label,
              routing: "preview",
              ...(typeof zeMeta.fleetSizeTrucks === "number"
                ? { fleetSizeTrucks: zeMeta.fleetSizeTrucks }
                : {}),
            },
          },
        ],
        queriesRun: [],
        fallback: true,
        model: "workbench-local-fallback",
        providerWarnings: [
          "Preview geometry is not provider-backed. Calculate uses the PTV Class-8 truck profile.",
        ],
      };
    }

    return {
      id: `wbai_local_caas_${Date.now()}`,
      mode: "caas_gap_map",
      answerSummary:
        "Enabled Class 8 gap and carrier layers. For Energy Forward ZE, ask about Long Beach→Shafter or Long Beach→Tijuana (60-truck interim capacity).",
      mapActions: [
        { type: "toggle_layer", layer: "class8-gaps", enabled: true },
        { type: "toggle_layer", layer: "carriers", enabled: true },
        {
          type: "set_layers",
          layers: [
            "ports",
            "freight-flow",
            "geo-regions",
            "class8-gaps",
            "carriers",
            "parking",
          ],
        },
      ],
      cards: [
        {
          id: "ai-caas-layers",
          title: "Gap and carrier layers active",
          summary:
            "Class 8 gaps and carriers are toggled on. Detour time stays labeled unavailable unless provider detour data exists.",
          mode: "caas_gap_map",
          severity: "success",
          layerId: "class8-gaps",
        },
      ],
      queriesRun: [],
      fallback: true,
      model: "workbench-local-fallback",
    };
  }

  if (mode === "driver_day_plan") {
    return {
      id: `wbai_local_driver_${Date.now()}`,
      mode: "driver_day_plan",
      answerSummary:
        "Drafted a POLB → Barstow day-plan route and enabled charger/parking layers. Prose is secondary — use the cards and map actions.",
      draftPatch: {
        origin: POLB,
        destination: BARSTOW,
        vehicleClass: "Class 8 drayage",
        notes: "AI draft: POLB → Barstow day plan",
        metadata: {
          truckSlug: "ecascadia_438",
          roundTrips: 2,
          source: "workbench/ai:local_fallback",
        },
      },
      mapActions: [
        { type: "set_origin", place: POLB },
        { type: "set_destination", place: BARSTOW },
        {
          type: "set_layers",
          layers: ["route", "chargers", "parking", "pois"],
        },
        {
          type: "focus_bounds",
          bounds: { north: 35.0, south: 33.6, east: -116.8, west: -118.4 },
        },
      ],
      cards: [
        {
          id: "ai-driver-route-draft",
          title: "Day-plan route drafted",
          summary:
            "Origin and destination set to POLB → Barstow. Run Calculate day plan for physics-backed feasibility and charge stops.",
          mode: "driver_day_plan",
          severity: "success",
          layerId: "route",
          metrics: {
            origin: POLB.label,
            destination: BARSTOW.label,
            roundTrips: 2,
          },
        },
        {
          id: "ai-driver-charger-layer",
          title: "Charger layer ready",
          summary:
            "Class-8 charger and parking layers are active. Site access details stay labeled unavailable unless sourced.",
          mode: "driver_day_plan",
          severity: "info",
          layerId: "chargers",
        },
      ],
      queriesRun: [
        {
          name: "workbench/ai:local_fallback",
          args: { message, mode },
          resultSummary:
            "Local deterministic driver draft (Convex action unavailable)",
        },
      ],
      fallback: true,
      model: "workbench-local-fallback",
      providerWarnings: [
        "Google route geometry is advisory until Class-8 truck routing validation is connected.",
      ],
    };
  }
  if (mode === "fleet_contract_plan" || /oakland|tracy|contract/.test(lower)) {
    return {
      id: `wbai_local_fleet_${Date.now()}`,
      mode: "fleet_contract_plan",
      answerSummary:
        "Applied Oakland → Tracy contract assumptions and enabled fleet planning layers. Run Calculate for trucks/drivers.",
      draftPatch: {
        origin: OAKLAND,
        destination: TRACY,
        vehicleClass: "Class 8 fleet",
        notes: "AI draft: Oakland → Tracy contract assumptions",
        metadata: {
          truckSlug: "ecascadia_438",
          containersPerDay: 12,
          gateStartHour: 6,
          gateEndHour: 17,
          shiftHours: 10,
          source: "workbench/ai:local_fallback",
        },
      },
      mapActions: [
        { type: "set_origin", place: OAKLAND },
        { type: "set_destination", place: TRACY },
        {
          type: "set_layers",
          layers: ["route", "chargers", "fleet-yards", "pois", "highways"],
        },
      ],
      cards: [
        {
          id: "ai-fleet-assumptions",
          title: "Contract assumptions applied",
          summary:
            "Port/origin, inland destination, and schedule assumptions are drafted. Run Calculate contract plan for trucks/drivers and charge events.",
          mode: "fleet_contract_plan",
          severity: "success",
          layerId: "route",
          metrics: { containersPerDay: 12, gateHours: "6–17" },
        },
      ],
      queriesRun: [],
      fallback: true,
      model: "workbench-local-fallback",
    };
  }
  return {
    id: `wbai_local_${mode}_${Date.now()}`,
    mode,
    answerSummary:
      "No local draft matched — try an example prompt or Calculate.",
    mapActions: [],
    cards: [],
    queriesRun: [],
    fallback: true,
    model: "workbench-local-fallback",
  };
}

export function AiCommandBar({ mode, className }: AiCommandBarProps) {
  const searchParams = useSearchParams();
  const requestedPreset = searchParams.get("aiPreset");
  const autoAppliedPreset = useRef<string | null>(null);
  const [prompt, setPrompt] = useState(() => EXAMPLE_PROMPTS[mode][0] ?? "");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const applyAiResult = useMapWorkbenchStore((state) => state.applyAiResult);
  const runWorkbenchAi = useAction(api.workbench.ai.workbenchPlanWithAi);
  const examples = useMemo(() => EXAMPLE_PROMPTS[mode], [mode]);

  useEffect(() => {
    if (
      mode !== "caas_gap_map" ||
      requestedPreset !== "west-coast-freight" ||
      autoAppliedPreset.current === requestedPreset
    ) {
      return;
    }

    autoAppliedPreset.current = requestedPreset;
    const message = EXAMPLE_PROMPTS.caas_gap_map[0]!;
    const result = localAiFallback(mode, message);
    setPrompt(message);
    applyAiResult(result);
    setLastSummary(result.answerSummary);
  }, [applyAiResult, mode, requestedPreset]);

  async function submit(message: string) {
    const trimmed = message.trim();
    if (!trimmed || isRunning) return;

    setPrompt(trimmed);
    setIsRunning(true);
    setError(null);
    try {
      const lower = trimmed.toLowerCase();
      const isExampleIntent =
        examples.some((example) => example.trim() === trimmed) ||
        /polb|barstow|shafter|tijuana|energy forward|60[- ]?truck|day plan|charger layer|oakland|tracy|contract|gap|carrier|opportunity|freight volume|freight flow|west coast ports|port freight/.test(
          lower,
        );

      let result: WorkbenchAiResult;
      if (isExampleIntent) {
        // Deterministic map-first examples — do not wait on Convex for known prompts.
        result = localAiFallback(mode, trimmed);
      } else {
        try {
          result = (await Promise.race([
            runWorkbenchAi({
              message: trimmed,
              mode,
            }) as Promise<WorkbenchAiResult>,
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("Planning assistant timed out")),
                12_000,
              ),
            ),
          ])) as WorkbenchAiResult;
        } catch {
          result = localAiFallback(mode, trimmed);
        }
      }

      applyAiResult(result);
      setLastSummary(result.answerSummary);
      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(humanizeClientError(err));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section
      data-testid="ai-command-bar"
      className={cn(
        "px-3 py-6",
        className,
      )}
      aria-label="AI map command bar"
    >
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <Sparkles size={18} className="text-[var(--fv-accent)]" />
          <TechnicalLabel>Ask FleetVolt</TechnicalLabel>
        </div>
        <p className="mt-2 text-base leading-6 text-[var(--fv-steel)]">
          Describe the freight question you want mapped.
        </p>
      </div>

      <form
        className="relative mx-auto mt-5 max-w-4xl"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(prompt);
        }}
      >
        <label className="sr-only" htmlFor="workbench-ai-command">
          AI planning command
        </label>
        <input
          id="workbench-ai-command"
          data-testid="ai-command-input"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={examples[0]}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          className="h-16 w-full rounded-full border border-black/15 bg-white py-3 pl-7 pr-20 text-base text-[var(--fv-graphite)] shadow-[0_10px_30px_rgba(20,35,48,0.14)] outline-none transition hover:shadow-[0_12px_34px_rgba(20,35,48,0.18)] focus-visible:border-[var(--fv-accent)] focus-visible:ring-2 focus-visible:ring-[var(--fv-accent)]/30"
        />
        <button
          type="submit"
          data-testid="ai-command-submit"
          disabled={isRunning || prompt.trim().length === 0}
          className="absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--fv-blueprint-blue)] text-white shadow-md transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Apply to map"
          title="Apply to map"
        >
          {isRunning ? (
            <FleetVoltLoader compact label="Applying map command" />
          ) : (
            <Sparkles size={16} />
          )}
          <span className="sr-only">Apply to map</span>
        </button>
      </form>

      {lastSummary ? (
        <div
          data-testid="ai-command-summary"
          aria-live="polite"
          className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-950"
        >
          <span className="font-bold">Applied to map.</span> {lastSummary}
        </div>
      ) : null}

      {error ? (
        <div
          data-testid="ai-command-error"
          role="alert"
          className="mt-2 flex gap-2 rounded-xl border border-red-300 bg-red-50 p-2 text-xs leading-5 text-red-900"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

    </section>
  );
}
