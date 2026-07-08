import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatusVariant = "ok" | "warn" | "alert" | "neutral";

type StatusBadgeProps = {
  children: ReactNode;
  variant?: StatusVariant;
  className?: string;
  "data-testid"?: string;
};

const dotClass: Record<StatusVariant, string> = {
  ok: "fv-status-badge-dot ok",
  warn: "fv-status-badge-dot warn",
  alert: "fv-status-badge-dot alert",
  neutral: "fv-status-badge-dot",
};

const dotColor: Record<StatusVariant, string> = {
  ok: "var(--fv-signal-green)",
  warn: "var(--fv-caution-amber)",
  alert: "var(--fv-alert-red)",
  neutral: "var(--fv-steel)",
};

/**
 * StatusBadge — dot + Mono text status pill (Brand Guide §06 "Status badge").
 * Dot 6px, glows 0 0 6px at 70% opacity.
 */
export function StatusBadge({
  children,
  variant = "neutral",
  className,
  "data-testid": dataTestId,
}: StatusBadgeProps) {
  return (
    <span className={cn("fv-status-badge", className)} data-testid={dataTestId}>
      <span
        className={dotClass[variant]}
        style={variant === "neutral" ? { background: dotColor[variant], color: dotColor[variant] } : undefined}
      />
      {children}
    </span>
  );
}
