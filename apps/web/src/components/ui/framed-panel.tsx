import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type FramedPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Show L-shaped corner brackets per Design/technical-brand-geometry-1.html */
  brackets?: boolean;
};

export function FramedPanel({
  children,
  className,
  brackets = true,
  ...props
}: FramedPanelProps) {
  return (
    <div className={cn("fv-panel", className)} {...props}>
      {brackets ? (
        <>
          <span className="corner-bracket corner-tl" aria-hidden="true" />
          <span className="corner-bracket corner-tr" aria-hidden="true" />
          <span className="corner-bracket corner-bl" aria-hidden="true" />
          <span className="corner-bracket corner-br" aria-hidden="true" />
        </>
      ) : null}
      {children}
    </div>
  );
}
