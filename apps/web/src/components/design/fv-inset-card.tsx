import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type FvInsetCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function FvInsetCard({ children, className, ...props }: FvInsetCardProps) {
  return (
    <div className={cn("fv-inset-card", className)} {...props}>
      {children}
    </div>
  );
}
