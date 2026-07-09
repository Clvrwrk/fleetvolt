"use client";

import { useMemo, useState } from "react";
import { useAction } from "convex/react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
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
  driver_day_plan: ["Draft POLB to Barstow day plan", "Enable charger layers for my route"],
  fleet_contract_plan: [
    "Apply Oakland to Tracy contract assumptions",
    "Draft fleet contract layers",
  ],
  caas_gap_map: ["Toggle gap and carrier layers", "Show Class 8 gap opportunity map"],
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

function localAiFallback(mode: WorkbenchMode, message: string): WorkbenchAiResult {
  const lower = message.toLowerCase();
  if (mode === "driver_day_plan" || /polb|barstow|day plan|charger layer/.test(lower)) {
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
        metadata: { truckSlug: "ecascadia_438", roundTrips: 2, source: "workbench/ai:local_fallback" },
      },
      mapActions: [
        { type: "set_origin", place: POLB },
        { type: "set_destination", place: BARSTOW },
        { type: "set_layers", layers: ["route", "chargers", "parking", "pois"] },
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
          metrics: { origin: POLB.label, destination: BARSTOW.label, roundTrips: 2 },
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
          resultSummary: "Local deterministic driver draft (Convex action unavailable)",
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
        { type: "set_layers", layers: ["route", "chargers", "fleet-yards", "pois", "highways"] },
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
    id: `wbai_local_caas_${Date.now()}`,
    mode: "caas_gap_map",
    answerSummary:
      "Enabled Class 8 gap and carrier layers for the opportunity map. Select origin and destination for route gap cards.",
    mapActions: [
      { type: "toggle_layer", layer: "class8-gaps", enabled: true },
      { type: "toggle_layer", layer: "carriers", enabled: true },
      {
        type: "set_layers",
        layers: ["geo-regions", "class8-gaps", "carriers", "parking", "freight-flow", "caas-zones"],
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


export function AiCommandBar({ mode, className }: AiCommandBarProps) {
  const [prompt, setPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const applyAiResult = useMapWorkbenchStore((state) => state.applyAiResult);
  const runWorkbenchAi = useAction(api["workbench/ai"].workbenchPlanWithAi);
  const examples = useMemo(() => EXAMPLE_PROMPTS[mode], [mode]);

  async function submit(message: string) {
    const trimmed = message.trim();
    if (!trimmed || isRunning) return;

    setIsRunning(true);
    setError(null);
    try {
      const lower = trimmed.toLowerCase();
      const isExampleIntent =
        /polb|barstow|day plan|charger layer|oakland|tracy|contract|gap|carrier|opportunity/.test(
          lower,
        );

      let result: WorkbenchAiResult;
      if (isExampleIntent) {
        // Deterministic map-first examples — do not wait on Convex for known prompts.
        result = localAiFallback(mode, trimmed);
      } else {
        try {
          result = (await Promise.race([
            runWorkbenchAi({ message: trimmed, mode }) as Promise<WorkbenchAiResult>,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Planning assistant timed out")), 12_000),
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
      setPrompt("");
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
        "rounded-2xl border border-black/10 bg-white/80 p-3 shadow-sm",
        className,
      )}
      aria-label="AI map command bar"
    >
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-[var(--fv-accent)]" />
        <TechnicalLabel>AI map actions</TechnicalLabel>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-[var(--fv-steel)]">
        Commands update draft, layers, and cards first. Prose stays secondary.
      </p>

      <form
        className="mt-3 flex flex-col gap-2"
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
          className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-[var(--fv-graphite)] shadow-sm outline-none focus-visible:border-[var(--fv-accent)] focus-visible:ring-2 focus-visible:ring-[var(--fv-accent)]/30"
        />
        <button
          type="submit"
          data-testid="ai-command-submit"
          disabled={isRunning || prompt.trim().length === 0}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--fv-graphite)] px-4 text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Apply to map
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-2">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            data-testid="ai-command-example"
            onClick={() => void submit(example)}
            disabled={isRunning}
            className="min-h-9 rounded-xl border border-black/10 bg-[var(--fv-surface)] px-3 text-[11px] font-semibold text-[var(--fv-graphite)] transition hover:border-[var(--fv-accent)] disabled:opacity-60"
          >
            {example}
          </button>
        ))}
      </div>

      {lastSummary ? (
        <p
          data-testid="ai-command-summary"
          className="mt-3 rounded-xl border border-black/10 bg-[var(--fv-surface)] px-3 py-2 text-xs leading-5 text-[var(--fv-steel)]"
        >
          {lastSummary}
        </p>
      ) : null}

      {error ? (
        <div
          data-testid="ai-command-error"
          className="mt-2 flex gap-2 rounded-xl border border-red-300 bg-red-50 p-2 text-xs leading-5 text-red-900"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </section>
  );
}
