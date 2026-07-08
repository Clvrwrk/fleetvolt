import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** Render as a block (width 100%) or inline */
  block?: boolean;
};

/**
 * PrimaryButton — Graphite gradient button (Brand Guide §06 "Primary button").
 * #2A2A2E→#141416, 1px #000 border, 12px radius, Inter 600 Paper text,
 * inset top highlight 0.15. Hover: translateY(-2px).
 */
export function PrimaryButton({
  children,
  className,
  block = false,
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      className={cn("fv-btn-primary", block && "w-full", className)}
      {...props}
    >
      {children}
    </button>
  );
}
