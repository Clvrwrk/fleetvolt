import { cn } from "@/lib/utils";

export function FleetVoltLoader({
  label = "Loading",
  compact = false,
  className,
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const size = compact ? 24 : 54;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-3 text-[var(--fv-steel)]",
        className,
      )}
      role="status"
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="32" cy="32" r="27" fill="none" stroke="#c7cdd2" strokeWidth="2" />
        <circle
          className="fv-loading-ring"
          cx="32"
          cy="32"
          r="27"
          fill="none"
          stroke="#4c8fb8"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="34 136"
        />
        <path
          className="fv-loading-bolt"
          d="M36 8 18 35h12l-3 21 20-31H34z"
          fill="#4c8fb8"
        />
      </svg>
      {!compact ? (
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]">
          {label}
        </span>
      ) : null}
    </span>
  );
}

