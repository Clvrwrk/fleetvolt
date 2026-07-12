"use client";

import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";

export function TrafficGeneratorMarker({
  name,
  generatorId,
  testId = "traffic-generator-marker",
}: {
  name: string;
  generatorId: string;
  testId?: string;
}) {
  return (
    <span className="relative flex h-11 w-11 items-center justify-center">
      <button
        type="button"
        data-testid={testId}
        data-generator-id={generatorId}
        className="relative z-10 flex h-9 min-w-9 items-center justify-center rounded-full border-2 border-white bg-sky-600 px-2 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-lg transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)]"
        aria-label={name}
      >
        POI
      </button>
    </span>
  );
}

export type GeneratorMarkersProps = {
  portCode: string | null;
  visible?: boolean;
  onSelectGenerator?: (generatorId: string) => void;
};

/** Subtle facility dots near the selected (or all west-coast) ports. */
export function GeneratorMarkers({
  portCode,
  visible = true,
  onSelectGenerator,
}: GeneratorMarkersProps) {
  const near = useQuery(
    api.generators.queries.listNearPort,
    portCode ? { portCode, radiusMiles: 20, limit: 30 } : "skip",
  );

  if (!visible || !portCode || !near?.length) return null;

  return (
    <>
      {near.map((g) => (
        <AdvancedMarker
          key={g.generatorId}
          position={{ lat: g.location.lat, lng: g.location.lng }}
          title={g.name}
          onClick={() => onSelectGenerator?.(g.generatorId)}
        >
          <TrafficGeneratorMarker name={g.name} generatorId={g.generatorId} />
        </AdvancedMarker>
      ))}
    </>
  );
}
