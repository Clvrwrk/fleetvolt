import { cn } from "@/lib/utils";

type MetadataPosition = "top-left" | "bottom-right";

type MetadataBlockProps = {
  /** Which absolute corner of the framed container to anchor to. */
  position: MetadataPosition;
  /** Line 1 — the category (e.g. "SURFACE", "DATASET"). */
  category: string;
  /** Line 2 — the specific value (e.g. "FREIGHT PULSE — WEST COAST"). */
  value: string;
  className?: string;
  "data-testid"?: string;
};

/**
 * MetadataBlock — absolutely-positioned two-line JetBrains Mono technical labels
 * (Design MD §3.7, 07-UI-SPEC § Copywriting). Embossed via .cad-emboss-text and
 * the --color-embossed token. Consumes --font-jetbrains-mono (SHELL-03).
 *
 * Copy wired by PulseSurface:
 *   top-left     → SURFACE / FREIGHT PULSE — WEST COAST
 *   bottom-right → DATASET / {active source} · {year}
 */
export function MetadataBlock({
  position,
  category,
  value,
  className,
  "data-testid": dataTestId = "metadata-block",
}: MetadataBlockProps) {
  const anchor =
    position === "top-left"
      ? "left-8 top-8 items-start text-left"
      : "bottom-8 right-8 items-end text-right";

  return (
    <div
      data-testid={dataTestId}
      data-position={position}
      className={cn(
        "pointer-events-none absolute z-[6] flex flex-col gap-0.5 font-[family-name:var(--font-jetbrains-mono)]",
        anchor,
        className,
      )}
    >
      <span className="cad-emboss-text text-[12px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-primary)]">
        {category}
      </span>
      <span className="cad-emboss-text text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
        {value}
      </span>
    </div>
  );
}
