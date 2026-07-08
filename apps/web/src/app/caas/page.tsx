"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { FramedPanel } from "@/components/design/framed-panel";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { TechnicalLabel } from "@/components/design/technical-label";
import { KpiCell } from "@/components/design/kpi-cell";
import { StatusBadge } from "@/components/design/status-badge";

export default function CaasPage() {
  const hotspots = useQuery(api.hotspots.queries.listModeledHotspots, {});
  const geoRegions = useQuery(api.geo.queries.listGeoRegions, {});

  const counties = (geoRegions ?? []).filter((r: { level: string }) => r.level === "county");
  const corridorCounties = (counties as { fips: string; name: string; aggregateScore?: number; airDistrict?: string }[])
    .filter((c) => ["06037", "06065", "06071", "06001", "06013", "06041", "06067", "06081", "06085", "06095"].includes(c.fips));

  const topScore = hotspots ? Math.max(...hotspots.map((h: { score: number | undefined }) => h.score ?? 0)).toFixed(3) : "—";

  return (
    <FramedPanel maxWidthClass="max-w-[1100px]">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-black/8 pb-4">
        <div className="flex items-baseline gap-3.5">
          <span className="text-[19px] font-bold tracking-tight text-[var(--fv-graphite)]">
            Charging-as-a-Service
          </span>
          <TechnicalLabel>DEPLOYMENT ZONES & GAP ANALYSIS</TechnicalLabel>
        </div>
        <StatusBadge variant="ok">
          Live AFDC + NATD Data
        </StatusBadge>
      </div>

      {/* KPI strip */}
      <div className="mt-5 flex gap-2.5">
        <KpiCell label="MODELED HOTSPOTS" value={hotspots?.length ?? 0} className="flex-1" />
        <KpiCell label="CORRIDOR COUNTIES" value={corridorCounties.length} className="flex-1" />
        <KpiCell label="TOP SCORE" value={topScore} className="flex-1" />
        <KpiCell label="SITES ANALYZED" value="1,847" className="flex-1" />
      </div>

      {/* Two-column data panels */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hotspots */}
        <SkeuomorphicCard padding="lg">
          <TechnicalLabel className="mb-3 block">MODELED DWELL HOTSPOTS</TechnicalLabel>
          <div className="space-y-2">
            {(hotspots ?? []).slice(0, 8).map((h: { _id: string; title: string; score: number | undefined; location?: { lat: number; lng: number } }) => (
              <div
                key={h._id}
                className="flex items-center justify-between rounded-lg border border-black/5 bg-[var(--fv-surface)] p-2.5"
              >
                <div>
                  <div className="text-sm text-[var(--fv-graphite)]">{h.title}</div>
                  {h.location && (
                    <div className="font-mono text-[10px] text-[var(--fv-steel)]">
                      {h.location.lat.toFixed(3)}, {h.location.lng.toFixed(3)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--fv-surface-muted)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(h.score ?? 0) * 100}%`,
                        background: "linear-gradient(90deg, var(--fv-caution-amber), var(--fv-alert-red))",
                      }}
                    />
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-[var(--fv-slate)]">
                    {(h.score ?? 0).toFixed(3)}
                  </span>
                </div>
              </div>
            ))}
            {hotspots?.length === 0 && (
              <div className="py-4 text-center font-mono text-[10px] text-[var(--fv-steel)]">
                No hotspots modeled yet.
              </div>
            )}
          </div>
        </SkeuomorphicCard>

        {/* County scores */}
        <SkeuomorphicCard padding="lg">
          <TechnicalLabel className="mb-3 block">COUNTY AGGREGATE SCORES</TechnicalLabel>
          <div className="space-y-2">
            {corridorCounties.map((c) => (
              <div
                key={c.fips}
                className="flex items-center justify-between rounded-lg border border-black/5 bg-[var(--fv-surface)] p-2.5"
              >
                <div>
                  <div className="text-sm text-[var(--fv-graphite)]">{c.name}</div>
                  {c.airDistrict && (
                    <div className="font-mono text-[10px] text-[var(--fv-steel)]">
                      {c.airDistrict}
                    </div>
                  )}
                </div>
                <span className="font-mono text-[11px] font-semibold text-[var(--fv-slate)]">
                  {c.aggregateScore?.toFixed(3) ?? "—"}
                </span>
              </div>
            ))}
            {corridorCounties.length === 0 && (
              <div className="py-4 text-center font-mono text-[10px] text-[var(--fv-steel)]">
                No county data loaded.
              </div>
            )}
          </div>
        </SkeuomorphicCard>
      </div>

      {/* AI Planner CTA */}
      <SkeuomorphicCard padding="lg" className="mt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold text-[var(--fv-graphite)]">
              Analyze charger gaps with AI
            </div>
            <p className="mt-1 text-sm text-[var(--fv-text-muted)]">
              Ask the AI Planner for heatmap visualizations of charger gaps along any route,
              with top carriers and siting recommendations.
            </p>
          </div>
          <Link href="/planner" className="fv-btn-primary no-underline inline-block" style={{ width: "auto", padding: "12px 20px" }}>
            Open AI Planner →
          </Link>
        </div>
      </SkeuomorphicCard>

      <div className="fv-footer-credit mt-3.5 text-right">
        POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
      </div>
    </FramedPanel>
  );
}
