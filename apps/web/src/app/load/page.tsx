import { ScreenShell } from "@/components/screens/screen-shell";

export default function LoadConfiguratorPage() {
  return (
    <ScreenShell
      mockFile="FleetVolt Load Configurator.dc.html"
      title="Load Configurator"
      subtitle="DRAYAGE PAYLOAD MODEL — POLB"
      phaseNote="Phase 5+ — container type, payload distribution, axle limits, and CG trim per mockup."
      gridClass="grid-cols-[296px_minmax(0,1fr)_268px]"
      leftLabel="CONTAINER TYPE"
      centerLabel="SIDE ELEVATION — LOAD & AXLE DISTRIBUTION"
      rightLabel="PERFORMANCE IMPACT"
    />
  );
}
