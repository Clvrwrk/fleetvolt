import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type RoutePlannerFrameProps = {
  children: ReactNode;
  className?: string;
  maxWidthClass?: string;
};

/** Outer shell matching Design/Design files review/*.dc.html */
export function RoutePlannerFrame({
  children,
  className,
  maxWidthClass = "max-w-[1320px]",
}: RoutePlannerFrameProps) {
  return (
    <div className={cn("fv-page-backdrop min-h-screen px-10 py-14", className)}>
      <div
        className={cn(
          "fv-main-frame relative mx-auto w-full overflow-hidden p-7",
          maxWidthClass,
        )}
      >
        <div className="fv-frame-grid-overlay pointer-events-none absolute inset-0 z-0" aria-hidden />
        <span className="corner-bracket fv-frame-bracket corner-tl" aria-hidden />
        <span className="corner-bracket fv-frame-bracket corner-tr" aria-hidden />
        <span className="corner-bracket fv-frame-bracket corner-bl" aria-hidden />
        <span className="corner-bracket fv-frame-bracket corner-br" aria-hidden />
        <div className="relative z-[5]">{children}</div>
      </div>
    </div>
  );
}
