"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Zap, MapPin, TrendingUp, AlertCircle } from "lucide-react";

export default function CaasPage() {
  const hotspots = useQuery(api.hotspots.queries.listModeledHotspots, {});
  const geoRegions = useQuery(api.geo.queries.listGeoRegions, {});

  const counties = (geoRegions ?? []).filter((r: { level: string }) => r.level === "county");
  const corridorCounties = (counties as { fips: string; name: string; aggregateScore?: number; airDistrict?: string }[])
    .filter((c) => ["06037", "06065", "06071", "06001", "06013", "06041", "06067", "06081", "06085", "06095"].includes(c.fips));

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2 text-[var(--fv-text,#e0e0e8)]">Charging-as-a-Service</h1>
      <p className="text-[var(--fv-text-muted,#888)] mb-6">Charger deployment zones, gap analysis, and siting opportunities based on freight movement + dwell + parking data.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)]">
          <Zap size={20} className="text-[var(--fv-accent,#3b82f6)] mb-2" />
          <div className="text-2xl font-bold text-[var(--fv-text,#e0e0e8)]">{hotspots?.length ?? 0}</div>
          <div className="text-sm text-[var(--fv-text-muted,#888)]">Modeled dwell hotspots</div>
        </div>
        <div className="p-4 rounded-lg bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)]">
          <MapPin size={20} className="text-[var(--fv-accent,#3b82f6)] mb-2" />
          <div className="text-2xl font-bold text-[var(--fv-text,#e0e0e8)]">{corridorCounties.length}</div>
          <div className="text-sm text-[var(--fv-text-muted,#888)]">Corridor counties with scores</div>
        </div>
        <div className="p-4 rounded-lg bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)]">
          <TrendingUp size={20} className="text-[var(--fv-accent,#3b82f6)] mb-2" />
          <div className="text-2xl font-bold text-[var(--fv-text,#e0e0e8)]">{hotspots ? Math.max(...hotspots.map((h: { score: number }) => h.score)).toFixed(3) : "—"}</div>
          <div className="text-sm text-[var(--fv-text-muted,#888)]">Top hotspot score</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hotspots */}
        <div className="p-4 rounded-lg bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)]">
          <h2 className="font-semibold text-[var(--fv-text,#e0e0e8)] mb-3">Modeled Dwell Hotspots</h2>
          <div className="space-y-2">
            {(hotspots ?? []).slice(0, 5).map((h: { _id: string; title: string; score: number; location?: { lat: number; lng: number } }) => (
              <div key={h._id} className="flex items-center justify-between p-2 rounded bg-[var(--fv-bg,#0d0d1a)]">
                <div>
                  <div className="text-sm text-[var(--fv-text,#e0e0e8)]">{h.title}</div>
                  {h.location && <div className="text-xs text-[var(--fv-text-muted,#666)]">{h.location.lat.toFixed(3)}, {h.location.lng.toFixed(3)}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 rounded-full bg-[var(--fv-bg,#0d0d1a)] overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-yellow-500 to-red-500" style={{ width: `${h.score * 100}%` }} />
                  </div>
                  <span className="text-sm font-mono text-[var(--fv-text,#e0e0e8)]">{h.score.toFixed(3)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* County scores */}
        <div className="p-4 rounded-lg bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)]">
          <h2 className="font-semibold text-[var(--fv-text,#e0e0e8)] mb-3">County Aggregate Scores</h2>
          <div className="space-y-2">
            {corridorCounties.map((c) => (
              <div key={c.fips} className="flex items-center justify-between p-2 rounded bg-[var(--fv-bg,#0d0d1a)]">
                <div>
                  <div className="text-sm text-[var(--fv-text,#e0e0e8)]">{c.name}</div>
                  {c.airDistrict && <div className="text-xs text-[var(--fv-text-muted,#666)]">{c.airDistrict}</div>}
                </div>
                <span className="text-sm font-mono text-[var(--fv-text,#e0e0e8)]">{c.aggregateScore?.toFixed(3) ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Planner CTA */}
      <div className="mt-6 p-6 rounded-lg bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-accent,#3b82f6)]">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-[var(--fv-accent,#3b82f6)] mt-1" />
          <div>
            <h3 className="font-semibold text-[var(--fv-text,#e0e0e8)]">Analyze charger gaps with AI</h3>
            <p className="text-sm text-[var(--fv-text-muted,#888)] mt-1">Ask the AI Planner to show you heatmap visualizations of charger gaps along any route, with top carriers and siting recommendations.</p>
            <a href="/planner" className="inline-block mt-3 px-4 py-2 rounded-lg bg-[var(--fv-accent,#3b82f6)] text-white text-sm">Open AI Planner →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
