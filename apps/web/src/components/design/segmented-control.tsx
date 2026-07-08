"use client";

import { cn } from "@/lib/utils";

type SegmentOption = {
  value: string;
  label: string;
};

type SegmentedControlProps = {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "data-testid"?: string;
};

/**
 * SegmentedControl — track + thumb segmented control (Brand Guide §06).
 * Track #E4E4EA with inset shadow; thumb #FBFBFD→#E4E4EA.
 * Mono 9.5px 600 labels. Selected = lifted thumb (never blue).
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  "data-testid": dataTestId,
}: SegmentedControlProps) {
  return (
    <div className={cn("fv-segmented", className)} data-testid={dataTestId}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          data-active={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
