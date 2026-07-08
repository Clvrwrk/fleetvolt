import { ScreenShell } from "@/components/screens/screen-shell";

export default function UnitConfiguratorPage() {
  return (
    <ScreenShell
      mockFile="FleetVolt Unit Configurator.dc.html"
      title="Unit Configurator"
      subtitle="CLASS 8 BEV TRACTOR — eCascadia 438 kWh"
      phaseNote="Phase 5+ — powertrain parameters, truck schematic, and live efficiency preview per mockup."
      gridClass="grid-cols-[296px_minmax(0,1fr)_268px]"
      leftLabel="POWERTRAIN PARAMETERS"
      centerLabel="UNIT SCHEMATIC — SIDE PROFILE"
      rightLabel="LIVE CALCULATED OUTPUTS"
    />
  );
}
