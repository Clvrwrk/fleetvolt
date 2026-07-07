import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SkeuomorphicCardProps = {
  children: ReactNode;
  /** Internal padding: p-6 (default) or p-8. */
  padding?: "6" | "8";
  className?: string;
  style?: CSSProperties;
  "data-testid"?: string;
};

/**
 * SkeuomorphicCard — secondary CAD container (Design MD §3.5).
 *
 * Lighter gradient border (.cad-card-gradient-border) + inner emboss shadow,
 * rounded-2xl, generous p-6/p-8. Used for the control panel and drawer shells.
 */
export function SkeuomorphicCard({
  children,
  padding = "6",
  className,
  style,
  "data-testid": dataTestId,
}: SkeuomorphicCardProps) {
  return (
    <div
      data-testid={dataTestId}
      style={style}
      className={cn(
        "cad-card-gradient-border cad-inner-emboss relative overflow-hidden bg-[var(--color-surface)]",
        "rounded-2xl",
        padding === "8" ? "p-8" : "p-6",
        className,
      )}
    >
      <div className="relative z-[2]">{children}</div>
    </div>
  );
}
