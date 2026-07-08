import type { ReactNode, CSSProperties } from "react";
import { cn } from "@/lib/utils";

type FramedPanelProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Show corner brackets (default true) */
  brackets?: boolean;
  /** Max width class for the frame container */
  maxWidthClass?: string;
  /** Inner padding (default 28px per brand guide) */
  padding?: "default" | "compact";
  "data-testid"?: string;
};

/**
 * FramedPanel — the main Paper frame with corner brackets, check pattern,
 * and multi-layer elevation shadow (Brand Guide §05 "The Framed Instrument").
 *
 * Uses .fv-frame utility class from globals.css.
 */
export function FramedPanel({
  children,
  className,
  style,
  brackets = true,
  maxWidthClass = "max-w-[1240px]",
  padding = "default",
  "data-testid": dataTestId,
}: FramedPanelProps) {
  return (
    <div className={cn("fv-page-backdrop min-h-screen px-10 py-14", className)}>
      <div
        data-testid={dataTestId}
        style={style}
        className={cn(
          "fv-frame relative mx-auto w-full",
          maxWidthClass,
          padding === "compact" ? "p-5" : "p-7",
        )}
      >
        {brackets && (
          <>
            <span className="fv-corner-bracket tl" aria-hidden />
            <span className="fv-corner-bracket tr" aria-hidden />
            <span className="fv-corner-bracket bl" aria-hidden />
            <span className="fv-corner-bracket br" aria-hidden />
          </>
        )}
        <div className="relative z-[5]">{children}</div>
      </div>
    </div>
  );
}
