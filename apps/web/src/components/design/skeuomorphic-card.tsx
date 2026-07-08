import type { ReactNode, CSSProperties } from "react";
import { cn } from "@/lib/utils";

type SkeuomorphicCardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  padding?: "sm" | "md" | "lg";
  "data-testid"?: string;
};

/**
 * SkeuomorphicCard — secondary container card (Brand Guide §06).
 *
 * Light gradient surface #FBFBFD→#EDEDF2, 1px border, 12px radius,
 * inset top highlight + soft drop shadow.
 * Uses .fv-card utility class from globals.css.
 */
export function SkeuomorphicCard({
  children,
  className,
  style,
  padding = "md",
  "data-testid": dataTestId,
}: SkeuomorphicCardProps) {
  return (
    <div
      data-testid={dataTestId}
      style={style}
      className={cn(
        "fv-card",
        padding === "sm" ? "p-3" : padding === "lg" ? "p-6" : "p-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}
