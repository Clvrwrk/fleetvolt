import { cn } from "@/lib/utils";

type DimensionOrientation = "horizontal" | "vertical";

type DimensionCalloutProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** JetBrains Mono technical label (e.g. "78px", "3.8% Grade", "FAF5 · 2022"). */
  label: string;
  orientation?: DimensionOrientation;
  /** Tick length in SVG units. */
  tickSize?: number;
  className?: string;
  "data-testid"?: string;
};

/**
 * DimensionCallout — base engineering-style measurement primitive (Design MD §3.4,
 * 07-UI-SPEC — P7 ships the BASE only; full popup use lands in P9).
 *
 * A dimension line + two end ticks + a centered JetBrains Mono <text> label.
 * Renders inline SVG geometry (0.5px --color-line strokes) intended to be dropped
 * inside a parent <svg>. Used for provenance readouts in Phase 7.
 */
export function DimensionCallout({
  x1,
  y1,
  x2,
  y2,
  label,
  orientation = "horizontal",
  tickSize = 4,
  className,
  "data-testid": dataTestId = "dimension-callout",
}: DimensionCalloutProps) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // End ticks are perpendicular to the dimension line.
  const tick = (cx: number, cy: number) =>
    orientation === "horizontal"
      ? { x1: cx, y1: cy - tickSize, x2: cx, y2: cy + tickSize }
      : { x1: cx - tickSize, y1: cy, x2: cx + tickSize, y2: cy };

  const t1 = tick(x1, y1);
  const t2 = tick(x2, y2);

  const labelOffset = orientation === "horizontal" ? -6 : 0;

  return (
    <g
      data-testid={dataTestId}
      className={cn("cad-dimension", className)}
      stroke="var(--color-line)"
      strokeWidth={0.5}
      vectorEffect="non-scaling-stroke"
    >
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <line x1={t1.x1} y1={t1.y1} x2={t1.x2} y2={t1.y2} />
      <line x1={t2.x1} y1={t2.y1} x2={t2.x2} y2={t2.y2} />
      <text
        x={midX}
        y={midY + labelOffset}
        textAnchor="middle"
        stroke="none"
        fill="var(--color-text-secondary)"
        className="font-[family-name:var(--font-jetbrains-mono)]"
        fontSize={10}
        fontWeight={400}
      >
        {label}
      </text>
    </g>
  );
}
