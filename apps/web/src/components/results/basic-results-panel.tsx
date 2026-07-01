"use client";

import type { components } from "@fleetvolt/shared-types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { deriveKpiSummary } from "@/lib/kpi";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];

type BasicResultsPanelProps = {
  pollResult: SimulationJobPollResponse;
};

export function BasicResultsPanel({ pollResult }: BasicResultsPanelProps) {
  const outputs = pollResult.outputs;
  if (!outputs) {
    return null;
  }

  const kpi = deriveKpiSummary(outputs);
  const verdictLabel = kpi.feasibilityVerdict
    ? kpi.feasibilityVerdict.replace(/_/g, " ")
    : "unknown";

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
