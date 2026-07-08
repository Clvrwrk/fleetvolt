import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SecondaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

/**
 * SecondaryButton — pill button (Brand Guide §06 "Secondary button / pill").
 * #FBFBFD→#E9E9EF, 1px border, 9999px radius, Inter 600 Graphite text,
 * embossed text-shadow. Hover: translateY(-1px).
 */
export function SecondaryButton({
  children,
  className,
  ...props
}: SecondaryButtonProps) {
  return (
    <button className={cn("fv-btn-secondary", className)} {...props}>
      {children}
    </button>
  );
}
