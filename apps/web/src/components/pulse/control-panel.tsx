"use client";

// ControlPanel — the /pulse control chrome hosting the port selector (SHELL-06).
//
// - A radix <Select> skinned under the CAD library (technical-pill styling) that
//   lists the six ports by name + code, plus a "Focus Port" primary CTA
//   (07-UI-SPEC § Copywriting).
// - Selecting a port (or clicking Focus Port) lifts the choice to the parent
//   (which reframes the map — Pitfall #6: no remount) and persists selectedPort
//   to Convex userFilters under the anonymous filterKey (getAnonFilterKey, D-07).
// - Reserves labeled, disabled slots for the P10 time filter and P9 overlay
//   toggles / matching-mode — rendered later; P7 ships only the port selector.
import { useMemo } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

export type PortOption = { code: string; name: string };

type ControlPanelProps = {
  ports: PortOption[];
  selectedPortCode: string | null;
  /** Commit a selection: reframes the map + persists to userFilters (parent). */
  onFocusPort: (code: string) => void;
};

export function ControlPanel({
  ports,
  selectedPortCode,
  onFocusPort,
}: ControlPanelProps) {
  const sorted = useMemo(
    () => [...ports].sort((a, b) => a.code.localeCompare(b.code)),
    [ports],
  );

  return (
    <div className="flex flex-col gap-4" data-testid="control-panel-body">
      <div className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-primary)]">
        Corridor Controls
      </div>

      {/* Port selector (SHELL-06). */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="port-select"
          className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]"
        >
          Port
        </label>
        <Select.Root
          value={selectedPortCode ?? undefined}
          onValueChange={onFocusPort}
        >
          <Select.Trigger
            id="port-select"
            data-testid="port-select-trigger"
            aria-label="Select a port to focus"
            className="flex items-center justify-between gap-2 rounded-md border bg-[var(--color-surface)] px-3 py-2 font-[family-name:var(--font-jetbrains-mono)] text-[12px] text-[var(--color-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            style={{ borderColor: "var(--color-line)" }}
          >
            <Select.Value placeholder="Select a port…" />
            <Select.Icon>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              position="popper"
              sideOffset={4}
              className="z-50 overflow-hidden rounded-md border bg-[var(--color-surface)] shadow-md"
              style={{ borderColor: "var(--color-line)" }}
            >
              <Select.Viewport className="p-1">
                {sorted.map((port) => (
                  <Select.Item
                    key={port.code}
                    value={port.code}
                    data-testid="port-select-item"
                    className="flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[12px] text-[var(--color-text-primary)] outline-none data-[highlighted]:bg-[var(--color-bg)] data-[state=checked]:text-[var(--color-accent)]"
                  >
                    <Select.ItemText>
                      {port.name}{" "}
                      <span className="text-[var(--color-text-secondary)]">
                        · {port.code}
                      </span>
                    </Select.ItemText>
                    <Select.ItemIndicator>
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      {/* Primary CTA — re-commits the current selection (re-frames the map). */}
      <button
        type="button"
        data-testid="focus-port-cta"
        disabled={!selectedPortCode}
        onClick={() => selectedPortCode && onFocusPort(selectedPortCode)}
        className="rounded-md border px-3 py-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)] transition-colors hover:bg-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ borderColor: "var(--color-accent)" }}
      >
        Focus Port
      </button>

      {/* Reserved future-control slots (P10 time filter, P9 overlays) — not P7. */}
      <div
        data-testid="control-slot-time"
        aria-hidden
        className="border-t pt-3 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)] opacity-50"
        style={{ borderColor: "var(--color-line-subtle)" }}
      >
        Time filter — coming in a later phase
      </div>
      <div
        data-testid="control-slot-overlays"
        aria-hidden
        className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)] opacity-50"
      >
        Overlays &amp; matching mode — coming in a later phase
      </div>
    </div>
  );
}
