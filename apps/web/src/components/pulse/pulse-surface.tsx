"use client";

import { useRef, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { BlueprintGrid } from "@/components/design/blueprint-grid";
import { TechnicalFrame } from "@/components/design/technical-frame";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { MetadataBlock } from "@/components/design/metadata-block";

/**
 * PulseSurface — the single Technical Brand Geometry shell orchestrator for /pulse.
 *
 * Composes the CAD chrome (07-02, Wave 1): an off-GL BlueprintGrid layered behind
 * (z-0), a TechnicalFrame (z-10) carrying MetadataBlock corners, a central map slot
 * (filled by Wave 2), a SkeuomorphicCard control-panel region, a sources-footer slot
 * (Wave 3), and a collapsed Data Quality drawer slot (Wave 3).
 *
 * SHELL-04 responsiveness: desktop shows the control panel beside the map; at tablet
 * width (<1024px) the control panel collapses into a radix Collapsible accordion
 * beneath the framed map. Phone is out of scope (body pins min-w-[1024px]).
 *
 * NO map / Google / @vis.gl here — the map arrives in Wave 2 (07-03) into the
 * named slots. This component owns shell chrome only.
 */
export function PulseSurface() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      // Reveal motion tokens (07-UI-SPEC § Motion): frame/panel entrance,
      // power3.out 0.6–0.8s, stagger 0.1s.
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

  const controlPanelBody = (
    <div className="flex flex-col gap-3">
      <div className="font-[family-name:var(--font-jetbrains-mono)] text-[12px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-primary)]">
        Corridor Controls
      </div>
      {/* Port selector lands in Wave 2 (07-03). */}
      <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] leading-relaxed text-[var(--color-text-secondary)]">
        Port selector arrives with the map layer.
      </p>
    </div>
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
          {/* Corner metadata labels (07-UI-SPEC § Copywriting). */}
          <MetadataBlock
            position="top-left"
            category="SURFACE"
            value="FREIGHT PULSE — WEST COAST"
          />
          <MetadataBlock
            position="bottom-right"
            category="DATASET"
            value="No source loaded · —"
          />

          {/* Desktop layout: map slot beside the control panel. */}
          <div className="flex h-full flex-col gap-6 lg:flex-row">
            {/* Central map slot — Wave 2 fills this. */}
            <div
              data-testid="pulse-map-slot"
              className="relative flex min-h-[420px] flex-1 items-center justify-center rounded-2xl border border-dashed"
              style={{ borderColor: "var(--color-line)" }}
            >
              <div className="max-w-md px-6 text-center">
                <h1 className="text-[24px] font-medium leading-tight text-[var(--color-text-primary)]">
                  No corridor data loaded
                </h1>
                <p className="mt-2 text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
                  Freight datasets are still ingesting. Corridors appear as
                  sources finish loading.
                </p>
              </div>
            </div>

            {/* Control panel — desktop: beside the map (visible, not collapsed). */}
            <div className="hidden w-[300px] shrink-0 lg:block">
              <SkeuomorphicCard
                data-testid="control-panel"
                padding="6"
                className="h-full"
              >
                {controlPanelBody}
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
            <SkeuomorphicCard
              data-testid="control-panel-accordion"
              padding="6"
            >
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
                {controlPanelBody}
              </Collapsible.Content>
            </SkeuomorphicCard>
          </Collapsible.Root>
        </div>
      </div>
    </div>
  );
}
