"use client";

import { useMemo, useState } from "react";
import type { components } from "@fleetvolt/shared-types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];
type ConditionsSpec = components["schemas"]["ConditionsSpec"];

type AssumptionsPanelProps = {
  pollResult: SimulationJobPollResponse;
};

// Hosted doc link pattern — simulator assumptions live in repo docs.
const MODEL_ASSUMPTIONS_URL =
  "https://github.com/cleverwork/fleetvolt-route/blob/main/services/simulator/docs/model_assumptions.md";

function readConditions(
  inputs: SimulationJobPollResponse["inputs"],
): Partial<ConditionsSpec> {
  if (!inputs || typeof inputs !== "object") {
    return {};
  }

  const conditions = (inputs as { conditions?: Partial<ConditionsSpec> })
    .conditions;
  return conditions ?? {};
}

const PLANNING_DISCLAIMER =
  "Planning tool only — Physics-based estimate. Not for real-time dispatch, HOS compliance, or weight-limit decisions. Real-world performance varies with driver behavior, traffic, and vehicle condition.";

export function AssumptionsPanel({ pollResult }: AssumptionsPanelProps) {
  const [rawJsonOpen, setRawJsonOpen] = useState(false);
  const outputs = pollResult.outputs;
  const conditions = useMemo(
    () => readConditions(pollResult.inputs),
    [pollResult.inputs],
  );

  return (
    <Collapsible defaultOpen={false} data-testid="assumptions-panel">
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-[var(--fv-stroke)] bg-[var(--fv-surface)] px-4 py-3 text-left text-sm font-medium hover:bg-[var(--fv-surface-muted)]">
        <span>Assumptions &amp; limitations</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4 rounded-lg border border-[var(--fv-stroke)] bg-[var(--fv-surface)] p-4">
        <div
          className="rounded-md border border-[var(--fv-stroke)] bg-[#FEF3C7] px-4 py-3 text-sm text-[#92400E]"
          data-testid="assumptions-disclaimer"
        >
          <strong>Planning tool only</strong> — Physics-based estimate. Not for
          real-time dispatch, HOS compliance, or weight-limit decisions.
          Real-world performance varies with driver behavior, traffic, and vehicle
          condition.
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {pollResult.physics_version ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Physics version
              </dt>
              <dd className="mono mt-1">{pollResult.physics_version}</dd>
            </div>
          ) : null}
          {pollResult.charger_version ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Charger version
              </dt>
              <dd className="mono mt-1">{pollResult.charger_version}</dd>
            </div>
          ) : null}
          {pollResult.inputs_hash ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Inputs hash
              </dt>
              <dd className="mono mt-1 break-all">{pollResult.inputs_hash}</dd>
            </div>
          ) : null}
          {conditions.weather_preset ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Weather preset
              </dt>
              <dd className="mt-1 capitalize">{conditions.weather_preset}</dd>
            </div>
          ) : null}
          {conditions.payload_lbs != null ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Payload
              </dt>
              <dd className="mt-1">
                {conditions.payload_lbs.toLocaleString()} lbs
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Port drayage
            </dt>
            <dd className="mt-1">
              {conditions.port_drayage_enabled ? "Enabled" : "Disabled"}
            </dd>
          </div>
        </dl>

        {outputs?.disclaimer ? (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Model disclaimer
            </h3>
            <p className="mt-2 text-sm">{outputs.disclaimer}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{PLANNING_DISCLAIMER}</p>
        )}

        {outputs?.assumptions && outputs.assumptions.length > 0 ? (
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Parameter assumptions
            </h3>
            <ul className="space-y-2 text-sm">
              {outputs.assumptions.map((entry) => (
                <li
                  key={`${entry.field}-${entry.source}`}
                  className="flex flex-wrap gap-x-2 gap-y-1 border-b border-[var(--fv-stroke)] pb-2 last:border-0"
                >
                  <span className="font-medium">{entry.field}</span>
                  <span>{entry.value}</span>
                  <span className="text-muted-foreground">({entry.source})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-sm">
          <a
            href={MODEL_ASSUMPTIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--fv-accent)] underline-offset-2 hover:underline"
          >
            View full model assumptions documentation
          </a>
        </p>

        <Collapsible open={rawJsonOpen} onOpenChange={setRawJsonOpen}>
          <CollapsibleTrigger className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline">
            View raw JSON
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <pre className="max-h-96 overflow-auto rounded-md bg-[var(--fv-surface-muted)] p-4 text-xs">
              {JSON.stringify(pollResult, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </CollapsibleContent>
    </Collapsible>
  );
}
