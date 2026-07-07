import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type TechnicalFrameVariant = "default" | "compact";

type TechnicalFrameProps = {
  children: ReactNode;
  variant?: TechnicalFrameVariant;
  className?: string;
  /**
   * Reserve bottom-inset layout space for Google's mandated attribution/logo
   * (Pitfall #10) so the required map credit doesn't collide with the CAD frame.
   * The map (Wave 2) mounts into this frame; the reserved strip keeps the credit legible.
   */
  reserveAttribution?: boolean;
  style?: CSSProperties;
  "data-testid"?: string;
};

/**
 * TechnicalFrame — the signature FramedMainContainer (Design MD §3.2, 07-UI-SPEC).
 *
 * rounded-3xl (24px = --radius-card), white surface, the exact 6-layer skeuomorphic
 * shadow stack (Design MD §2.5) via .cad-shadow-stack + .cad-inner-emboss, a gradient
 * physical-edge border via ::before (.cad-gradient-border), four inset L-corner
 * brackets, and p-8 internal padding. Reserves layout space for Google attribution.
 */
export function TechnicalFrame({
  children,
  variant = "default",
  className,
  reserveAttribution = true,
  style,
  "data-testid": dataTestId = "technical-frame",
}: TechnicalFrameProps) {
  return (
    <div
      data-testid={dataTestId}
      data-variant={variant}
      style={style}
      className={cn(
        "cad-shadow-stack cad-inner-emboss cad-gradient-border relative overflow-hidden bg-[var(--color-surface)]",
        "rounded-[var(--radius-card)]",
        variant === "compact" ? "p-6" : "p-8",
        className,
      )}
    >
      {/* Four inset L-shaped corner brackets (0.5px cool-gray technical strokes) */}
      <span
        aria-hidden
        data-testid="frame-bracket-tl"
        className="pointer-events-none absolute left-5 top-5 z-[2] h-4 w-4 border-l border-t"
        style={{ borderColor: "rgba(0,0,0,0.25)" }}
      />
      <span
        aria-hidden
        data-testid="frame-bracket-tr"
        className="pointer-events-none absolute right-5 top-5 z-[2] h-4 w-4 border-r border-t"
        style={{ borderColor: "rgba(0,0,0,0.25)" }}
      />
      <span
        aria-hidden
        data-testid="frame-bracket-bl"
        className="pointer-events-none absolute bottom-5 left-5 z-[2] h-4 w-4 border-b border-l"
        style={{ borderColor: "rgba(0,0,0,0.25)" }}
      />
      <span
        aria-hidden
        data-testid="frame-bracket-br"
        className="pointer-events-none absolute bottom-5 right-5 z-[2] h-4 w-4 border-b border-r"
        style={{ borderColor: "rgba(0,0,0,0.25)" }}
      />

      <div className="relative z-[5] h-full">{children}</div>

      {/* Reserve space for the mandated Google attribution/logo (Pitfall #10). */}
      {reserveAttribution ? (
        <div
          aria-hidden
          data-testid="attribution-reserve"
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-[3] h-6"
        />
      ) : null}
    </div>
  );
}
