"use client";

import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";

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
          <button
            type="button"
            data-testid="traffic-generator-marker"
            data-generator-id={g.generatorId}
            className="h-2.5 w-2.5 rounded-full border border-white bg-[var(--fv-caution-amber)] shadow"
            aria-label={g.name}
          />
        </AdvancedMarker>
      ))}
    </>
  );
}
