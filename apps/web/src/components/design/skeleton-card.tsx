// ── Phase 16 / Wave 6 / Task 6.1: Skeleton Card ─────────────────────────────
//
// Animated placeholder card (CSS pulse, no JS).
// Shape matches the final content — card with title bar + content lines.
// Uses SkeuomorphicCard shape with fv-skeleton-pulse animation.
//
// UX principle: Jakob's Law — users expect skeleton screens (LinkedIn, Stripe)
// UX checks: EMPTY-1 (prevents empty flash during load)
// Animation: CSS-only pulse ≤ 1.5s

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SkeletonCardProps = {
  className?: string;
  /** Number of content lines to show (default 3) */
  lines?: number;
  /** Show a title bar (default true) */
  showTitle?: boolean;
  "data-testid"?: string;
};

/**
 * SkeletonCard — animated placeholder matching SkeuomorphicCard shape.
 * Renders a title bar + N content lines with pulse animation.
 */
export function SkeletonCard({
  className,
  lines = 3,
  showTitle = true,
  "data-testid": dataTestId,
}: SkeletonCardProps) {
  return (
    <div
      data-testid={dataTestId}
      className={cn(
        "fv-card p-3.5",
        className,
      )}
    >
      {showTitle && (
        <div className="fv-skeleton h-3.5 w-24 rounded mb-3" />
      )}
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="fv-skeleton h-2.5 rounded"
            style={{ width: `${100 - i * 15}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * SkeletonKpiCell — animated placeholder matching KpiCell shape.
 * Renders a label bar + value bar.
 */
export function SkeletonKpiCell({ className }: { className?: string }) {
  return (
    <div className={cn("fv-kpi-cell", className)}>
      <div className="fv-skeleton h-2 w-16 rounded mb-2" />
      <div className="fv-skeleton h-5 w-12 rounded" />
    </div>
  );
}

/**
 * SkeletonKpiRow — row of N skeleton KPI cells.
 */
export function SkeletonKpiRow({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2.5 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonKpiCell key={i} />
      ))}
    </div>
  );
}

/**
 * SkeletonContent — generic skeleton wrapper for a loading page.
 * Renders a header + KPI row + content card.
 */
export function SkeletonContent({
  headerWidth = "w-48",
  kpiCount = 4,
  cardLines = 4,
  children,
}: {
  headerWidth?: string;
  kpiCount?: number;
  cardLines?: number;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b border-black/8 pb-4">
        <div className="flex items-baseline gap-3.5">
          <div className={cn("fv-skeleton h-6 rounded", headerWidth)} />
          <div className="fv-skeleton h-4 w-16 rounded" />
        </div>
        <div className="fv-skeleton h-4 w-20 rounded" />
      </div>

      {/* KPI row skeleton */}
      <SkeletonKpiRow count={kpiCount} />

      {/* Content card skeleton */}
      <SkeletonCard lines={cardLines} className="mt-5" />

      {/* Extra content */}
      {children}
    </div>
  );
}
