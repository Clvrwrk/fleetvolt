import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type KpiCellProps = {
  label: string;
  value: ReactNode;
  unit?: string;
  className?: string;
  "data-testid"?: string;
};

/**
 * KpiCell — dimensioned KPI card (Brand Guide §06 "KPI cell").
 * 8.5px Mono label / 15-22px Mono value / 9px radius.
 */
export function KpiCell({
  label,
  value,
  unit,
  className,
  "data-testid": dataTestId,
}: KpiCellProps) {
  return (
    <div className={cn("fv-kpi-cell", className)} data-testid={dataTestId}>
      <div className="fv-kpi-cell-label">{label}</div>
      <div className="fv-kpi-cell-value">
        {value}
        {unit ? <span className="fv-kpi-cell-unit ml-1"> {unit}</span> : null}
      </div>
    </div>
  );
}
