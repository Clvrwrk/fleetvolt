"use client";

import { useMemo } from "react";
import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { WorkbenchSelection } from "../types";
import { trafficGeneratorSelection } from "@/lib/workbench/traffic-generator-selection";
import { TrafficGeneratorMarker } from "./generator-markers";

export type GeneratorSpokesLayerProps = {
  visible?: boolean;
  onSelectGenerator?: (selection: WorkbenchSelection) => void;
};

type Spoke = {
  generatorId: string;
  name: string;
  city: string;
  county: string;
  zip: string;
  district: string;
  generator: { lat: number; lng: number };
  portCode: string;
  port: { lat: number; lng: number };
  tier: "low" | "medium" | "heavy";
  color: string;
  dailyTruckIndex: number;
};

/**
 * Statewide traffic-generator POIs.
 *
 * The query exposes port associations as endpoint pairs, not road geometry.
 * Never draw those pairs as route-like spokes. Road paths belong in the
 * road-traced freight-flow layer once a routing provider has supplied them.
 */
export function GeneratorSpokesLayer({
  visible = true,
  onSelectGenerator,
}: GeneratorSpokesLayerProps) {
  const data = useQuery(api.generators.queries.listWithPortSpokes, {
    limit: 120,
  });
  const spokes = useMemo(
    () => (data?.spokes ?? []) as Spoke[],
    [data?.spokes],
  );
  if (!visible || !spokes.length) return null;

  return (
    <>
      {spokes.map((spoke) => (
        <AdvancedMarker
          key={spoke.generatorId}
          position={{ lat: spoke.generator.lat, lng: spoke.generator.lng }}
          title={spoke.name}
          onClick={() =>
            onSelectGenerator?.(
              trafficGeneratorSelection({
                generatorId: spoke.generatorId,
                name: spoke.name,
                city: spoke.city,
                county: spoke.county,
                zip: spoke.zip,
                district: spoke.district,
                location: spoke.generator,
                portCode: spoke.portCode,
                tier: spoke.tier,
                dailyTruckIndex: spoke.dailyTruckIndex,
              }),
            )
          }
        >
          <TrafficGeneratorMarker
            name={spoke.name}
            generatorId={spoke.generatorId}
            testId="traffic-generator-spoke-marker"
          />
        </AdvancedMarker>
      ))}
    </>
  );
}
