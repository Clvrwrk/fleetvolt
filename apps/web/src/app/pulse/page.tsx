import type { Metadata } from "next";
import { PulseSurface } from "@/components/pulse/pulse-surface";

export const metadata: Metadata = {
  title: "Freight Pulse — FleetVolt Route",
  description:
    "West Coast freight corridor pulse: Technical Brand Geometry surface for Class 8 BEV freight flows",
};

/**
 * /pulse — thin server shell rendering the client PulseSurface.
 *
 * D-06: /pulse ships OPEN in Phase 7 — NO auth guard/redirect. The WorkOS
 * boundary is a Phase 10 change. No Convex hooks here (hooks are client-only,
 * Pitfall #4); PulseSurface is the 'use client' boundary.
 */
export default function PulsePage() {
  return <PulseSurface />;
}
