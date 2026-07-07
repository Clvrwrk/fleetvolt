"use client";

// PortAnchors — one AdvancedMarkerElement per Convex port (FLOW-02, D-10).
//
// - Reads ports reactively via useQuery(api.ports.list) — each marker maps to a
//   real provenance-tagged Convex record (the credibility chain).
// - Uses the vis.gl <AdvancedMarker> wrapper (AdvancedMarkerElement under the
//   hood), NEVER the deprecated google.maps.Marker (D-10). Requires the vector
//   mapId provided by PulseMap.
// - Marker content is a technical CAD pill with the JetBrains Mono port code.
//   The focused port renders in accent teal (--color-accent); others neutral.
import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

type PortAnchorsProps = {
  /** Code of the currently focused port (POLA/POLB/HUE/OAK/SF/SD), if any. */
  selectedPortCode?: string | null;
  /** Click-to-select callback — parent owns selection state. */
  onSelect?: (code: string) => void;
};

/**
 * Renders the six port anchors. Loading/empty (no ports seeded yet) renders
 * nothing rather than crashing.
 */
export function PortAnchors({ selectedPortCode, onSelect }: PortAnchorsProps) {
  const ports = useQuery(api.ports.list);

  if (!ports || ports.length === 0) {
    return null;
  }

  return (
    <>
      {ports.map((port) => {
        const focused = port.code === selectedPortCode;
        return (
          <AdvancedMarker
            key={port._id}
            position={{ lat: port.location.lat, lng: port.location.lng }}
            title={`${port.name} (${port.code})`}
            onClick={() => onSelect?.(port.code)}
          >
            <div
              data-testid="port-anchor"
              data-port-code={port.code}
              data-focused={focused ? "true" : "false"}
              className="flex -translate-y-1/2 items-center gap-1.5 rounded-md border px-2 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.1em] shadow-sm"
              style={
                focused
                  ? {
                      borderColor: "var(--color-accent)",
                      backgroundColor: "var(--color-accent)",
                      color: "#ffffff",
                    }
                  : {
                      borderColor: "var(--color-line)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text-primary)",
                    }
              }
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: focused
                    ? "#ffffff"
                    : "var(--color-accent)",
                }}
              />
              {port.code}
            </div>
          </AdvancedMarker>
        );
      })}
    </>
  );
}
