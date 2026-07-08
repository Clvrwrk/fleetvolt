"use client";

// HotspotReportPanel — the drill-down panel for a selected hotspot.
//
// Calls the Phase-12 hotspotReport query (convex/report.ts) with {lat,lng,
// radiusM:5000, hotspotId} and renders all 6 data sections (carriers, parking,
// POIs, chargers, score, freight context) plus the What's Missing derived-gaps
// panel. This is the SAME payload that grounds the LLM sales brief (15-03) —
// single source of truth.
//
// The score section displays the "modeled" honesty label (never "observed") and
// the four proxy inputs by name. The What's Missing panel surfaces
// mobileEnergyOpportunity + zero-coverage flags + the deferredToPhase13 markers
// (detour cost + environmental benefit — never fabricated as numbers).
import { useQuery } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { CarriersSection } from "./report-sections/carriers-section";
import { ParkingSection } from "./report-sections/parking-section";
import { PoisSection } from "./report-sections/pois-section";
import { ChargersSection } from "./report-sections/chargers-section";
import { ScoreSection } from "./report-sections/score-section";
import { FreightContextSection } from "./report-sections/freight-context-section";
import { WhatsMissingPanel } from "./whats-missing-panel";

export interface HotspotReportPanelProps {
  lat: number;
  lng: number;
  hotspotId: Id<"hotspots">;
  title: string;
  onClose?: () => void;
}

export function HotspotReportPanel({
  lat,
  lng,
  hotspotId,
  title,
  onClose,
}: HotspotReportPanelProps) {
  const report = useQuery(api.report.hotspotReport, {
    lat,
    lng,
    radiusM: 5000,
    hotspotId: hotspotId,
  });

  return (
    <div
      data-testid="hotspot-report-panel"
      className="flex h-full flex-col overflow-hidden rounded-2xl border"
      style={{ borderColor: "var(--color-line)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: "var(--color-line)" }}
      >
        <div>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
            Hotspot Report
          </p>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {title} (modeled)
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-line-subtle)]"
            aria-label="Close report panel"
          >
            ✕
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {report === undefined && (
          <div
            data-testid="report-loading"
            className="space-y-2"
          >
            <div className="h-24 animate-pulse rounded-lg" style={{ backgroundColor: "var(--color-line-subtle)" }} />
            <div className="h-24 animate-pulse rounded-lg" style={{ backgroundColor: "var(--color-line-subtle)" }} />
            <div className="h-24 animate-pulse rounded-lg" style={{ backgroundColor: "var(--color-line-subtle)" }} />
          </div>
        )}

        {report === null && (
          <div
            data-testid="report-error"
            className="p-4 text-sm text-[var(--color-text-secondary)]"
          >
            Failed to load report data.
          </div>
        )}

        {report && (
          <>
            <ScoreSection score={report.score} />
            <CarriersSection carriers={report.carriers} />
            <ParkingSection parking={report.parking} />
            <ChargersSection chargers={report.chargers} />
            <PoisSection pois={report.pois} />
            <FreightContextSection freightContext={report.freightContext} />
            <WhatsMissingPanel whatsMissing={report.whatsMissing} />
          </>
        )}
      </div>
    </div>
  );
}
