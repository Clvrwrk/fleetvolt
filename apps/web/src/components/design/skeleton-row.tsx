// ── Phase 16 / Wave 6 / Task 6.1: Skeleton Row ─────────────────────────────
//
// Animated placeholder table row (CSS pulse, no JS).
// Shape matches the final table row content.
//
// UX principle: Jakob's Law — skeleton screens match content shape
// Animation: CSS-only pulse ≤ 1.5s

import { cn } from "@/lib/utils";

type SkeletonRowProps = {
  className?: string;
  /** Number of columns (default 5) */
  columns?: number;
  "data-testid"?: string;
};

/**
 * SkeletonRow — animated placeholder matching a table row shape.
 * Renders N skeleton cells in a horizontal row.
 */
export function SkeletonRow({
  className,
  columns = 5,
  "data-testid": dataTestId,
}: SkeletonRowProps) {
  return (
    <tr data-testid={dataTestId} className={cn("border-t border-black/5", className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-2.5">
          <div
            className="fv-skeleton h-3 rounded"
            style={{ width: `${70 + ((i * 7) % 25)}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

/**
 * SkeletonTable — animated placeholder for a full table.
 * Renders a header row + N body rows.
 */
export function SkeletonTable({
  rows = 5,
  columns = 5,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="fv-table w-full">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <div className="fv-skeleton h-2.5 w-16 rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * SkeletonList — animated placeholder for a list of items.
 * Renders N rows with icon + title + subtitle skeleton shapes.
 */
export function SkeletonList({
  items = 4,
  className,
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-black/5 bg-[var(--fv-surface)] p-2.5"
        >
          <div className="flex items-center gap-2.5">
            <div className="fv-skeleton h-8 w-8 rounded-lg" />
            <div className="space-y-1.5">
              <div className="fv-skeleton h-3 w-28 rounded" />
              <div className="fv-skeleton h-2 w-20 rounded" />
            </div>
          </div>
          <div className="fv-skeleton h-3 w-12 rounded" />
        </div>
      ))}
    </div>
  );
}
