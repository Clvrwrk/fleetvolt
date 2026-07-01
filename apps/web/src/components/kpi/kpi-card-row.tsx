"use client";

import type { ReactNode } from "react";
import type { components } from "@fleetvolt/shared-types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deriveKpiSummary,
  feasibilityBadgeClasses,
  feasibilityBadgeVariant,
  formatFeasibilityTierLabel,
} from "@/lib/kpi";

type SimulateResponse = components["schemas"]["SimulateResponse"];

type KpiCardRowProps = {
  outputs: SimulateResponse;
};

type KpiCardProps = {
  label: string;
  value: ReactNode;
  testId?: string;
};

function KpiCard({ label, value, testId }: KpiCardProps) {
  return (
    <Card className="min-w-[140px] shrink-0" data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-lg font-medium text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

export function KpiCardRow({ outputs }: KpiCardRowProps) {
  const kpi = deriveKpiSummary(outputs);
  const verdictVariant = feasibilityBadgeVariant(kpi.feasibilityVerdict);
  const verdictLabel = kpi.feasibilityVerdict
    ? kpi.feasibilityVerdict.replace(/_/g, " ")
    : "Unknown";

  return (
    <div
      className="fv-panel overflow-x-auto p-4"
      data-testid="kpi-card-row"
    >
      <div className="flex min-w-max gap-4 xl:flex-wrap">
        <KpiCard
          label="Total energy"
          value={kpi.totalKwhFormatted}
          testId="kpi-total-energy"
        />
        <KpiCard
          label="Efficiency"
          value={kpi.whPerMiFormatted}
          testId="kpi-efficiency"
        />
        <KpiCard
          label="Trip time"
          value={kpi.tripTimeFormatted}
          testId="kpi-trip-time"
        />
        <KpiCard
          label="Charging stops"
          value={kpi.stopCount}
          testId="kpi-stop-count"
        />
        <KpiCard
          label="Total dwell"
          value={kpi.totalDwellFormatted}
          testId="kpi-total-dwell"
        />
        <KpiCard
          label="Final SoC"
          value={kpi.finalSocFormatted}
          testId="kpi-final-soc"
        />
        <Card className="min-w-[180px] shrink-0" data-testid="kpi-feasibility">
          <CardHeader className="pb-2">
            <CardTitle>Feasibility</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {verdictVariant ? (
              <Badge
                className={feasibilityBadgeClasses(verdictVariant)}
                data-testid="kpi-feasibility-badge"
              >
                {verdictLabel}
              </Badge>
            ) : (
              <span className="text-lg font-medium">—</span>
            )}
            {kpi.feasibilityTier ? (
              <Badge variant="outline" data-testid="kpi-feasibility-tier">
                {formatFeasibilityTierLabel(kpi.feasibilityTier)}
              </Badge>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
