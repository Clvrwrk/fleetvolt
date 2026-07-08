import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type FvVizPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  title?: string;
  meta?: string;
};

export function FvVizPanel({
  children,
  className,
  title,
  meta,
  ...props
}: FvVizPanelProps) {
  return (
    <div className={cn("fv-viz-panel", className)} {...props}>
      {(title || meta) && (
        <div className="mb-0.5 flex items-center justify-between">
          {title ? <span className="fv-panel-caption">{title}</span> : <span />}
          {meta ? <span className="fv-panel-meta">{meta}</span> : null}
        </div>
      )}
      {children}
    </div>
  );
}
