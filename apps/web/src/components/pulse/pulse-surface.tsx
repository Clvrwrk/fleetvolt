"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BlueprintGrid } from "@/components/design/blueprint-grid";
import { TechnicalFrame } from "@/components/design/technical-frame";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { MetadataBlock } from "@/components/design/metadata-block";
import { PulseMap } from "@/components/pulse/pulse-map";
import { PortAnchors } from "@/components/pulse/port-anchors";
import { ControlPanel, type PortOption } from "@/components/pulse/control-panel";
import { getAnonFilterKey } from "@/lib/anon-filter-key";
import type { LatLng } from "@/lib/ca-framing";

/**
 * PulseSurface — the single Technical Brand Geometry shell orchestrator for /pulse.
 *
 * Wave 1 (07-02) built the CAD chrome. Wave 2 (07-03) injects the map stack:
 * PulseMap (vector Google map) with PortAnchors as children into the map slot,
 * and ControlPanel (port selector) into the control-panel slot. Selection state
 * is owned HERE and flows down by props — the <Map> never remounts (Pitfall #6).
 *
 * Selection persists to Convex userFilters under the anonymous filterKey (D-07);
 * the initial value is read back from userFilters.get(anonKey) on mount.
 */
export function PulseSurface() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  // User's explicit selection this session (null until they pick a port).
  const [userSelection, setUserSelection] = useState<string | null>(null);

  // Anonymous filterKey (D-07) — stable per browser, resolved after mount so SSR
  // and client agree (getAnonFilterKey returns "anonymous" during SSR).
  const [filterKey, setFilterKey] = useState<string | null>(null);
  useEffect(() => {
    // Read the anonymous key from localStorage post-mount so SSR ("anonymous")
    // and the client's first paint agree, then upgrade to the persisted UUID.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilterKey(getAnonFilterKey());
  }, []);

  const ports = useQuery(api.ports.list);
  const persistedFilters = useQuery(
    api.userFilters.get,
    filterKey ? { filterKey } : "skip",
  );
  const upsertFilters = useMutation(api.userFilters.upsert);

  // Effective selection = the user's live choice, else the persisted value
  // (D-07 hydration). Derived — no setState-in-effect (cascading renders).
  const persistedPort =
    (persistedFilters as { selectedPort?: string } | undefined)
      ?.selectedPort ?? null;
  const selectedPortCode = userSelection ?? persistedPort;

  const portOptions: PortOption[] = useMemo(
    () => (ports ?? []).map((p) => ({ code: p.code, name: p.name })),
    [ports],
  );

  // Coordinate for the focused port — drives the imperative map pan (no remount).
  const focusPoint: LatLng | null = useMemo(() => {
    if (!selectedPortCode || !ports) return null;
    const match = ports.find((p) => p.code === selectedPortCode);
    return match ? { lat: match.location.lat, lng: match.location.lng } : null;
  }, [selectedPortCode, ports]);

  const handleFocusPort = (code: string) => {
    setUserSelection(code);
    if (filterKey) {
      void upsertFilters({ filterKey, selectedPort: code });
    }
  };

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

  const controlPanel = (
    <ControlPanel
      ports={portOptions}
      selectedPortCode={selectedPortCode}
      onFocusPort={handleFocusPort}
    />
  );

  return (
    <div
      ref={rootRef}
      data-testid="pulse-surface"
      className="pulse-scope relative min-h-screen w-full overflow-hidden px-10 py-14"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {/* Off-GL animated blueprint grid, layered behind the frame (z-0). */}
      <BlueprintGrid />

      <div className="relative z-10 mx-auto flex w-full max-w-[1320px] flex-col gap-6">
        <TechnicalFrame data-reveal reserveAttribution className="min-h-[560px]">
          <MetadataBlock
            position="top-left"
            category="SURFACE"
            value="FREIGHT PULSE — WEST COAST"
          />
          <MetadataBlock
            position="bottom-right"
            category="DATASET"
            value="BTS Port · 2022"
          />

          {/* Desktop layout: map slot beside the control panel. */}
          <div className="flex h-full flex-col gap-6 lg:flex-row">
            {/* Central map slot — Wave 2 fills this with the vector map + anchors. */}
            <div
              data-testid="pulse-map-slot"
              className="relative flex min-h-[420px] flex-1 overflow-hidden rounded-2xl"
            >
              <PulseMap focusPoint={focusPoint}>
                <PortAnchors
                  selectedPortCode={selectedPortCode}
                  onSelect={handleFocusPort}
                />
              </PulseMap>
            </div>

            {/* Control panel — desktop: beside the map (visible, not collapsed). */}
            <div className="hidden w-[300px] shrink-0 lg:block">
              <SkeuomorphicCard
                data-testid="control-panel"
                padding="6"
                className="h-full"
              >
                {controlPanel}
              </SkeuomorphicCard>
            </div>
          </div>

          {/* Footer slot — SRC-02 SourcesFooter fills this in Wave 3. */}
          <div
            data-testid="sources-footer-slot"
            className="mt-6 border-t pt-4"
            style={{ borderColor: "var(--color-line-subtle)" }}
          />

          {/* Collapsed Data Quality drawer slot — Wave 3 fills content. */}
          <div data-testid="data-quality-drawer-slot" className="mt-2" />
        </TechnicalFrame>

        {/* Control panel — tablet: collapses into an accordion beneath the map. */}
        <div className="lg:hidden" data-reveal>
          <Collapsible.Root open={panelOpen} onOpenChange={setPanelOpen}>
            <SkeuomorphicCard data-testid="control-panel-accordion" padding="6">
              <Collapsible.Trigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between font-[family-name:var(--font-jetbrains-mono)] text-[12px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-primary)]"
                  aria-label="Toggle corridor controls"
                >
                  <span>Corridor Controls</span>
                  <span aria-hidden>{panelOpen ? "–" : "+"}</span>
                </button>
              </Collapsible.Trigger>
              <Collapsible.Content className="pt-3">
                {controlPanel}
              </Collapsible.Content>
            </SkeuomorphicCard>
          </Collapsible.Root>
        </div>
      </div>
    </div>
  );
}
