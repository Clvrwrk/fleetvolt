"use client";

import { cn } from "@/lib/utils";
import {
  formatFeasibilityTierLabel,
  type KpiSummary,
} from "@/lib/kpi";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useScenarioStore,
  type ComparisonLabel,
  type ComparisonScenario,
} from "@/stores/scenario-store";

const LABELS: ComparisonLabel[] = ["A", "B", "C"];

type MetricRow = {
  key: string;
  label: string;
  type: "numeric-lower-better" | "numeric-neutral" | "text";
  getValue: (kpi: KpiSummary, scenario: ComparisonScenario) => string;
  getNumeric?: (kpi: KpiSummary) => number;
};

const METRIC_ROWS: MetricRow[] = [
  {
    key: "totalKwh",
    label: "Total energy",
    type: "numeric-lower-better",
    getValue: (kpi) => kpi.totalKwhFormatted,
    getNumeric: (kpi) => kpi.totalKwh,
  },
  {
    key: "whPerMi",
    label: "Energy intensity",
    type: "numeric-lower-better",
    getValue: (kpi) => kpi.whPerMiFormatted,
    getNumeric: (kpi) => kpi.whPerMi,
  },
  {
    key: "tripTime",
    label: "Trip time",
    type: "numeric-lower-better",
    getValue: (kpi) => kpi.tripTimeFormatted,
    getNumeric: (kpi) => kpi.totalTimeS,
  },
  {
    key: "dwellTime",
    label: "Charging dwell",
    type: "numeric-lower-better",
    getValue: (kpi) => kpi.totalDwellFormatted,
    getNumeric: (kpi) => kpi.totalDwellS,
  },
  {
    key: "finalSoc",
    label: "Final SoC",
    type: "numeric-neutral",
    getValue: (kpi) => kpi.finalSocFormatted,
    getNumeric: (kpi) => kpi.finalSocPct,
  },
  {
    key: "stopCount",
    label: "Charging stops",
    type: "numeric-lower-better",
    getValue: (kpi) => String(kpi.stopCount),
    getNumeric: (kpi) => kpi.stopCount,
  },
  {
    key: "feasibility",
    label: "Feasibility verdict",
    type: "text",
    getValue: (kpi, scenario) => {
      const verdict = kpi.feasibilityVerdict ?? "unknown";
      const tier = kpi.feasibilityTier
        ? formatFeasibilityTierLabel(kpi.feasibilityTier)
        : null;
      return tier ? `${verdict} (${tier})` : verdict;
    },
  },
];

function scenarioByLabel(
  scenarios: ComparisonScenario[],
): Partial<Record<ComparisonLabel, ComparisonScenario>> {
  return Object.fromEntries(scenarios.map((s) => [s.label, s]));
}

function formatNumericDelta(delta: number, row: MetricRow): string {
  if (row.key === "totalKwh") {
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toFixed(1)} kWh`;
  }
  if (row.key === "whPerMi") {
    const sign = delta > 0 ? "+" : "";
    return `${sign}${Math.round(delta)} Wh/mi`;
  }
  if (row.key === "stopCount") {
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta}`;
  }
  if (row.key === "tripTime" || row.key === "dwellTime") {
    const sign = delta > 0 ? "+" : "−";
    const abs = Math.abs(delta);
    const hours = Math.floor(abs / 3600);
    const minutes = Math.floor((abs % 3600) / 60);
    return `${sign}${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}`;
}

function deltaCellClass(delta: number, lowerIsBetter: boolean): string {
  if (delta === 0) {
    return "";
  }
  const improved = lowerIsBetter ? delta < 0 : false;
  if (improved) {
    return "bg-[#DCFCE7] text-[#166534]";
  }
  if (delta !== 0 && lowerIsBetter) {
    return "bg-[#FEE2E2] text-[#991B1B]";
  }
  return "";
}

function renderDeltaCell(
  row: MetricRow,
  baseline: ComparisonScenario | undefined,
  compare: ComparisonScenario | undefined,
): { content: string; className: string } {
  if (row.type === "text" || !row.getNumeric || !baseline || !compare) {
    if (row.type === "text" && baseline && compare) {
      const baseText = row.getValue(baseline.kpiSummary, baseline);
      const compareText = row.getValue(compare.kpiSummary, compare);
      return {
        content: compareText === baseText ? "—" : compareText,
        className: "",
      };
    }
    return { content: "—", className: "" };
  }

  const delta =
    row.getNumeric(compare.kpiSummary) - row.getNumeric(baseline.kpiSummary);
  return {
    content: formatNumericDelta(delta, row),
    className: deltaCellClass(delta, row.type === "numeric-lower-better"),
  };
}

export function ComparisonDiffTable() {
  const comparisonScenarios = useScenarioStore((s) => s.comparisonScenarios);
  const byLabel = scenarioByLabel(comparisonScenarios);
  const scenarioA = byLabel.A;
  const count = comparisonScenarios.length;

  if (count === 0) {
    return (
      <div
        className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--fv-stroke)] p-8 text-center"
        data-testid="comparison-empty-state"
      >
        <p className="text-sm text-muted-foreground">
          Run scenarios and pin up to 3 for side-by-side comparison.
        </p>
        <p className="mt-2 max-w-md text-xs text-muted-foreground">
          Pin up to 3 simulation runs to compare KPIs and charging plans side
          by side.
        </p>
      </div>
    );
  }

  if (count === 1) {
    return (
      <div
        className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-[var(--fv-stroke)] p-8 text-center"
        data-testid="comparison-single-state"
      >
        <p className="text-sm font-medium">Scenario {scenarioA?.label} pinned</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Pin at least one more scenario to see KPI deltas (B−A, C−A).
        </p>
      </div>
    );
  }

  return (
    <Table data-testid="comparison-diff-table">
      <TableHeader>
        <TableRow>
          <TableHead>Metric</TableHead>
          {LABELS.map((label) => (
            <TableHead key={label}>Scenario {label}</TableHead>
          ))}
          <TableHead>Δ (B−A)</TableHead>
          <TableHead>Δ (C−A)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {METRIC_ROWS.map((row) => {
          const deltaB = renderDeltaCell(row, scenarioA, byLabel.B);
          const deltaC = renderDeltaCell(row, scenarioA, byLabel.C);

          return (
            <TableRow key={row.key}>
              <TableCell className="font-medium">{row.label}</TableCell>
              {LABELS.map((label) => {
                const scenario = byLabel[label];
                return (
                  <TableCell key={label}>
                    {scenario
                      ? row.getValue(scenario.kpiSummary, scenario)
                      : "—"}
                  </TableCell>
                );
              })}
              <TableCell className={cn(deltaB.className)}>
                {deltaB.content}
              </TableCell>
              <TableCell className={cn(deltaC.className)}>
                {deltaC.content}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
