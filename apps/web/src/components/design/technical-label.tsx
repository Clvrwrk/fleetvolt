import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type TechnicalLabelProps = {
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
};

/**
 * TechnicalLabel — JetBrains Mono 10px CAPS, +1.5px tracking, Steel color.
 * Brand Guide §04 "Section labels".
 */
export function TechnicalLabel({
  children,
  className,
  "data-testid": dataTestId,
}: TechnicalLabelProps) {
  return (
    <span className={cn("fv-mono-label", className)} data-testid={dataTestId}>
      {children}
    </span>
  );
}
