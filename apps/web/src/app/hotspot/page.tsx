import type { Metadata } from "next";
import { HotspotExplorer } from "@/components/hotspot/hotspot-explorer";

export const metadata: Metadata = {
  title: "Hotspot Explorer — FleetVolt",
  description:
    "Modeled truck parking/dwelling hotspot explorer with drill-down report and AI sales brief",
};

/**
 * /hotspot — thin server shell rendering the client HotspotExplorer.
 *
 * No auth guard (parity with /pulse). No Convex hooks here (hooks are
 * client-only); HotspotExplorer is the 'use client' boundary.
 */
export default function HotspotPage() {
  return <HotspotExplorer />;
}
