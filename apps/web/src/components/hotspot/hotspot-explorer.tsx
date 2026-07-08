"use client";

// HotspotExplorer — the Technical Brand Geometry shell for /hotspot.
//
// Wraps TechnicalFrame + HotspotMap (parity with PulseSurface wrapping PulseMap).
// Feeds map data from two Convex queries:
//   - listModeledHotspots → individual hotspot pins at county zoom
//   - listGeoRegions → state/county aggregate pins at nation/state zoom
// Owns the selectedHotspot state (set when a pin is clicked) — flows to
// HotspotReportPanel (15-02) and BriefPanel (15-03) in later waves.
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useQuery } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { TechnicalFrame } from "@/components/design/technical-frame";
import { BlueprintGrid } from "@/components/design/blueprint-grid";
import { MetadataBlock } from "@/components/design/metadata-block";
import { HotspotMap } from "./hotspot-map";
import { HotspotReportPanel } from "./hotspot-report-panel";

export interface SelectedHotspot {
  lat: number;
  lng: number;
  hotspotId: Id<"hotspots">;
  title: string;
}

export function HotspotExplorer() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [selectedHotspot, setSelectedHotspot] =
    useState<SelectedHotspot | null>(null);

  const hotspots = useQuery(api.hotspots.queries.listModeledHotspots);
  const geoRegions = useQuery(api.geo.queries.listGeoRegions, {});

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const targets = root.querySelectorAll("[data-reveal]");
      if (targets.length === 0) return;
      gsap.from(targets, {
        opacity: 0,
        y: 16,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.1,
      });
    },
    { scope: rootRef },
  );

  return (
    <div
      ref={rootRef}
      data-testid="hotspot-explorer"
      className="relative min-h-screen w-full overflow-hidden px-10 py-14"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <BlueprintGrid />

      <div className="relative z-10 mx-auto flex w-full max-w-[1320px] flex-col gap-6">
        <TechnicalFrame data-reveal reserveAttribution className="min-h-[560px]">
          <MetadataBlock
            position="top-left"
            category="SURFACE"
            value="HOTSPOT EXPLORER — MODELED"
          />
          <MetadataBlock
            position="bottom-right"
            category="DATASET"
            value="NATD · Caltrans · FAF · POLB"
          />

          <div className="flex h-full flex-col gap-6 lg:flex-row">
            <div
              data-testid="hotspot-map-slot"
              className="relative flex min-h-[420px] flex-1 overflow-hidden rounded-2xl"
            >
              <HotspotMap
                hotspots={hotspots}
                geoRegions={geoRegions}
                onHotspotSelect={(h) =>
                  setSelectedHotspot({
                    lat: h.lat,
                    lng: h.lng,
                    hotspotId: h.hotspotId,
                    title: h.title,
                  })
                }
              />
            </div>

            {/* Report + brief panel slot — filled by 15-02 and 15-03 */}
            {selectedHotspot && (
              <div
                data-testid="hotspot-report-slot"
                className="w-full lg:w-[400px] shrink-0"
              >
                <HotspotReportPanel
                  lat={selectedHotspot.lat}
                  lng={selectedHotspot.lng}
                  hotspotId={selectedHotspot.hotspotId}
                  title={selectedHotspot.title}
                  onClose={() => setSelectedHotspot(null)}
                />
              </div>
            )}
          </div>
        </TechnicalFrame>
      </div>
    </div>
  );
}
