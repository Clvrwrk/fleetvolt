"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useScenarioStore,
  type ComparisonLabel,
  type ComparisonScenario,
} from "@/stores/scenario-store";

const LABELS: ComparisonLabel[] = ["A", "B", "C"];

type ConfirmState =
  | { type: "remove"; label: ComparisonLabel }
  | { type: "clear" }
  | null;

function ConfirmDialog({
  state,
  onConfirm,
  onCancel,
}: {
  state: ConfirmState;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!state) {
    return null;
  }

  const isRemove = state.type === "remove";
  const title = isRemove
    ? `Remove scenario ${state.label}?`
    : "Clear all comparisons?";
  const description = isRemove
    ? "This removes the pinned run from comparison. It does not delete cached simulation data."
    : "Removes all pinned scenarios from the tray.";
  const confirmLabel = isRemove ? "Remove" : "Clear all";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--fv-stroke)] bg-background p-6 shadow-lg">
        <h3 id="confirm-dialog-title" className="text-lg font-medium">
          {title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScenarioChip({
  label,
  scenario,
  onRemove,
}: {
  label: ComparisonLabel;
  scenario: ComparisonScenario | undefined;
  onRemove: (label: ComparisonLabel) => void;
}) {
  if (!scenario) {
    return (
      <div
        className="flex min-h-10 flex-1 items-center justify-center rounded-md border border-dashed border-[var(--fv-stroke)] bg-[var(--fv-surface-muted)] px-3 py-2 text-xs text-muted-foreground"
        data-testid={`comparison-slot-${label}`}
      >
        Pin a run
      </div>
    );
  }

  const hashPrefix = scenario.inputs_hash.slice(0, 8);

  return (
    <div
      className="relative flex min-h-10 flex-1 flex-col justify-center rounded-md border border-[var(--fv-stroke)] bg-background px-3 py-2"
      data-testid={`comparison-chip-${label}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium">Scenario {label}</p>
          <p className="truncate text-xs text-muted-foreground">
            {scenario.kpiSummary.totalKwhFormatted} · {hashPrefix}…
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-[var(--fv-surface-muted)] hover:text-foreground"
          aria-label={`Remove scenario ${label}`}
          onClick={() => onRemove(label)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function formatDelta(value: number, unit: string): string {
  const sign = value > 0 ? "+" : "";
  if (unit === "kWh") {
    return `${sign}${value.toFixed(1)} kWh`;
  }
  if (unit === "Wh/mi") {
    return `${sign}${Math.round(value)} Wh/mi`;
  }
  if (unit === "stops") {
    return `${sign}${value}`;
  }
  const hours = Math.floor(Math.abs(value) / 3600);
  const minutes = Math.floor((Math.abs(value) % 3600) / 60);
  const formatted = `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return value >= 0 ? `+${formatted}` : `−${formatted}`;
}

export function ComparisonTray() {
  const comparisonScenarios = useScenarioStore((s) => s.comparisonScenarios);
  const sensitivityDeltaKpis = useScenarioStore((s) => s.sensitivityDeltaKpis);
  const removeScenario = useScenarioStore((s) => s.removeScenario);
  const clearComparison = useScenarioStore((s) => s.clearComparison);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const scenarioByLabel = Object.fromEntries(
    comparisonScenarios.map((s) => [s.label, s]),
  ) as Partial<Record<ComparisonLabel, ComparisonScenario>>;

  const handleRemoveRequest = (label: ComparisonLabel) => {
    setConfirmState({ type: "remove", label });
  };

  const handleConfirm = () => {
    if (!confirmState) {
      return;
    }
    if (confirmState.type === "remove") {
      removeScenario(confirmState.label);
    } else {
      clearComparison();
    }
    setConfirmState(null);
  };

  return (
    <div className="space-y-3" data-testid="comparison-tray">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Compare
        </h3>
        <Badge variant="outline" data-testid="comparison-count">
          {comparisonScenarios.length}/3
        </Badge>
      </div>

      <div className="flex gap-2">
        {LABELS.map((label) => (
          <ScenarioChip
            key={label}
            label={label}
            scenario={scenarioByLabel[label]}
            onRemove={handleRemoveRequest}
          />
        ))}
      </div>

      {sensitivityDeltaKpis ? (
        <div
          className="rounded-md border border-[var(--fv-stroke)] bg-[var(--fv-surface-muted)] px-3 py-2 text-xs"
          data-testid="sensitivity-delta-summary"
        >
          <p className="font-medium text-foreground">Sensitivity vs baseline A</p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            <li>Energy: {formatDelta(sensitivityDeltaKpis.totalKwhDelta, "kWh")}</li>
            <li>Trip time: {formatDelta(sensitivityDeltaKpis.totalTimeDelta, "time")}</li>
            <li>Intensity: {formatDelta(sensitivityDeltaKpis.whPerMiDelta, "Wh/mi")}</li>
            <li>Stops: {formatDelta(sensitivityDeltaKpis.stopCountDelta, "stops")}</li>
          </ul>
        </div>
      ) : null}

      {comparisonScenarios.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setConfirmState({ type: "clear" })}
        >
          Clear all
        </Button>
      ) : null}

      <ConfirmDialog
        state={confirmState}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
