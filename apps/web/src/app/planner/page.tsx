import { ChatPanel } from "@/components/planner/chat-panel";
import { FramedPanel } from "@/components/design/framed-panel";
import { TechnicalLabel } from "@/components/design/technical-label";
import { StatusBadge } from "@/components/design/status-badge";

export default function PlannerPage() {
  return (
    <FramedPanel maxWidthClass="max-w-[1200px]">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-black/8 pb-4">
        <div className="flex items-baseline gap-3.5">
          <span className="text-[19px] font-bold tracking-tight text-[var(--fv-graphite)]">
            Route Planner
          </span>
          <TechnicalLabel>AI-ASSISTED CORRIDOR SIMULATION</TechnicalLabel>
        </div>
        <StatusBadge variant="ok">
          Convex Backend Connected
        </StatusBadge>
      </div>

      {/* 3-column layout: left sidebar + center chat + right info */}
      <div className="mt-5 grid grid-cols-[200px_minmax(0,1fr)_240px] gap-5">
        {/* Left rail — role selector + context */}
        <aside className="flex flex-col gap-3.5">
          <div>
            <TechnicalLabel className="mb-2 block">ROLE</TechnicalLabel>
            <div className="flex flex-col gap-1.5">
              {[
                { id: "driver", label: "Driver" },
                { id: "fleet_manager", label: "Fleet Manager" },
                { id: "caas", label: "CaaS" },
              ].map((r) => (
                <div
                  key={r.id}
                  className="fv-corridor-row text-[12px] font-semibold"
                  data-role={r.id}
                >
                  {r.label}
                </div>
              ))}
            </div>
          </div>
          <div className="fv-inset-card font-mono text-[11px] text-[#3a3a3e]">
            <TechnicalLabel className="mb-2.5 block">CORRIDOR CONTEXT</TechnicalLabel>
            <div className="flex justify-between border-b border-dashed border-black/10 py-1.5">
              <span className="text-[#8a8a92]">Origin</span>
              <span>POLB</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-black/10 py-1.5">
              <span className="text-[#8a8a92]">Destination</span>
              <span>Barstow</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-black/10 py-1.5">
              <span className="text-[#8a8a92]">Distance</span>
              <span>128 mi</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#8a8a92]">Unit</span>
              <span>eCascadia 438</span>
            </div>
          </div>
        </aside>

        {/* Center — chat panel */}
        <section className="flex flex-col">
          <ChatPanel defaultRole="caas" />
        </section>

        {/* Right rail — simulation preview */}
        <aside className="flex flex-col gap-3">
          <TechnicalLabel>SIMULATION PREVIEW</TechnicalLabel>
          <div className="fv-feasibility-card">
            <div className="fv-feasibility-card-label">NET ENERGY</div>
            <div className="fv-feasibility-card-value">
              312
              <span className="ml-1 font-mono text-[11px] font-normal text-[#8a8a92]">
                kWh
              </span>
            </div>
            <div className="mt-1 font-mono text-[9.5px] text-[#3f9b6b]">
              within battery envelope
            </div>
          </div>
          <div className="fv-feasibility-card">
            <div className="fv-feasibility-card-label">CHARGE STOPS</div>
            <div className="fv-feasibility-card-value">2</div>
            <div className="mt-1 font-mono text-[9.5px] text-[#3f9b6b]">
              all ≥350 kW verified
            </div>
          </div>
          <div className="fv-feasibility-card">
            <div className="fv-feasibility-card-label">SAVINGS VS DIESEL</div>
            <div className="fv-feasibility-card-value">
              62
              <span className="ml-1 font-mono text-[11px] font-normal text-[#8a8a92]">
                %
              </span>
            </div>
            <div className="mt-1 font-mono text-[9.5px] text-[#3f9b6b]">
              ton-mile basis
            </div>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <div className="fv-footer-credit mt-3.5 text-right">
        POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
      </div>
    </FramedPanel>
  );
}
