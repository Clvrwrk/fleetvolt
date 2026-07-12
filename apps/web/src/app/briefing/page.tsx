import type { Metadata } from "next";
import { ExecutiveBriefing } from "@/components/briefing/executive-briefing";

export const metadata: Metadata = {
  title: "FleetVolt Executive Briefing — POLB to Shafter",
  description: "Executive route intelligence for Class 8 fleet electrification.",
};

export default function BriefingPage() {
  return <ExecutiveBriefing />;
}
