import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DimensionCalloutProps = {
  label: string;
  value?: string;
  unit?: string;
  /** Direction the leader line extends */
  align?: "left" | "right" | "center";
  className?: string;
  children?: ReactNode;
  "data-testid"?: string;
};

/**
 * DimensionCallout — 0.5px dashed leader + Mono label (Brand Guide §07).
 *
 * HTML/CSS version for use in page layouts (the SVG-only version lives in
 * dimension-callout.tsx). Renders a dashed top border + Mono caption.
 */
export function DimensionCallout({
  label,
  value,
  unit,
  align = "left",
  className,
  "data-testid": dataTestId,
}: DimensionCalloutProps) {
  const alignClass =
    align === "right"
      ? "text-right items-end"
      : align === "center"
        ? "text-center items-center"
        : "text-left items-start";

  return (
    <div
      className={cn("flex flex-col gap-0.5 pt-1.5", alignClass, className)}
      data-testid={dataTestId}
      style={{ borderTop: "0.5px dashed var(--fv-steel)" }}
    >
      <span className="fv-mono-label text-[9px]">{label}</span>
      {value ? (
        <span className="font-mono text-[11px] font-semibold text-[var(--fv-slate)]">
          {value}
          {unit ? <span className="ml-0.5 text-[var(--fv-steel)]">{unit}</span> : null}
        </span>
      ) : null}
    </div>
  );
}
