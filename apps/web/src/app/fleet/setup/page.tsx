"use client";

// Fleet Manager setup — moved from /fleet to /fleet/setup.
// Phase 16 / Wave 4 / Task 4.2: the /fleet route is now a dashboard; the
// 4-step fleet creation wizard lives here at /fleet/setup.

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Truck, MapPin, Users, Route, Plus, Check } from "lucide-react";
import { FramedPanel } from "@/components/design/framed-panel";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { TechnicalLabel } from "@/components/design/technical-label";
import { KpiCell } from "@/components/design/kpi-cell";
import { StatusBadge } from "@/components/design/status-badge";

export default function FleetSetupPage() {
  const [step, setStep] = useState(0);
  const [fleetName, setFleetName] = useState("");
  const [fleetId, setFleetId] = useState<string | null>(null);
  const [lotName, setLotName] = useState("");
  const [lotAddress, setLotAddress] = useState("");
  const [lotLat, setLotLat] = useState("");
  const [lotLng, setLotLng] = useState("");
  const [lotCapacity, setLotCapacity] = useState("10");
  const [lotAmenities, setLotAmenities] = useState<string[]>([]);
  const [driverName, setDriverName] = useState("");

  const createFleet = useMutation(api.fleet.mutations.createFleet);
  const addLot = useMutation(api.fleet.mutations.addParkingLot);
  const addDriver = useMutation(api.fleet.mutations.addDriverToFleet);

  const fleetOverview = useQuery(
    api.fleet.queries.getFleetOverview,
    fleetId ? { fleetId } : "skip",
  );

  const AMENITIES = ["charging", "restroom", "food", "secure_parking", "maintenance", "driver_lounge"];

  async function handleCreateFleet() {
    const id = `fleet_${Date.now()}`;
    await createFleet({ fleetId: id, name: fleetName, address: "TBD", location: { lat: 0, lng: 0 } });
    setFleetId(id);
    setStep(1);
  }

  async function handleAddLot() {
    if (!fleetId) return;
    const lotId = `lot_${Date.now()}`;
    await addLot({
      lotId, fleetId, name: lotName, address: lotAddress,
      location: { lat: parseFloat(lotLat) || 0, lng: parseFloat(lotLng) || 0 },
      capacityTrucks: parseInt(lotCapacity) || 1,
      amenities: lotAmenities,
    });
    setLotName(""); setLotAddress(""); setLotLat(""); setLotLng(""); setLotCapacity("10"); setLotAmenities([]);
  }

  async function handleAddDriver() {
    if (!fleetId) return;
    const driverId = `drv_${Date.now()}`;
    await addDriver({ fleetId, driverId, driverName });
    setDriverName("");
  }

  const steps = ["Create Fleet", "Parking Lots", "Drivers", "Routes"];

  return (
    <FramedPanel maxWidthClass="max-w-[1000px]">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-black/8 pb-4">
        <div className="flex items-baseline gap-3.5">
          <span className="text-[19px] font-bold tracking-tight text-[var(--fv-graphite)]">
            Fleet Setup
          </span>
          <TechnicalLabel>FLEET REGISTRATION & OPERATIONS</TechnicalLabel>
        </div>
        <StatusBadge variant={fleetId ? "ok" : "neutral"}>
          {fleetId ? "Fleet Active" : "No Fleet Created"}
        </StatusBadge>
      </div>

      {/* KPI strip */}
      <div className="mt-5 flex gap-2.5">
        <KpiCell label="DRIVERS" value={fleetOverview?.drivers?.length ?? 0} className="flex-1" />
        <KpiCell label="PARKING LOTS" value={fleetOverview?.parkingLots?.length ?? 0} className="flex-1" />
        <KpiCell label="ROUTES" value={fleetOverview?.routes?.length ?? 0} className="flex-1" />
      </div>

      {/* Step navigation */}
      <div className="mt-5 flex gap-2">
        {steps.map((s, i) => (
          <button key={i} onClick={() => setStep(i)} className="fv-segmented" style={{ display: "inline-flex" }}>
            <button type="button" data-active={step === i} onClick={() => setStep(i)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
              {i + 1}. {s}
            </button>
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="mt-5">
        {step === 0 && (
          <SkeuomorphicCard padding="lg">
            <TechnicalLabel className="mb-3 block">FLEET / COMPANY NAME</TechnicalLabel>
            <div className="flex gap-3">
              <input value={fleetName} onChange={(e) => setFleetName(e.target.value)} placeholder="Acme Drayage Co." className="fv-input flex-1" />
              <button onClick={handleCreateFleet} disabled={!fleetName} className="fv-btn-primary" style={{ width: "auto", padding: "10px 20px" }}>Create Fleet</button>
            </div>
            {fleetId && (
              <div className="mt-3 flex items-center gap-1 font-mono text-[10px] text-[var(--fv-signal-green)]">
                <Check size={14} /> Fleet created: {fleetName}
              </div>
            )}
          </SkeuomorphicCard>
        )}

        {step === 1 && fleetId && (
          <SkeuomorphicCard padding="lg">
            <TechnicalLabel className="mb-3 block">ADD PARKING LOT</TechnicalLabel>
            <div className="grid grid-cols-2 gap-3">
              <input value={lotName} onChange={(e) => setLotName(e.target.value)} placeholder="Lot name" className="fv-input" />
              <input value={lotAddress} onChange={(e) => setLotAddress(e.target.value)} placeholder="Address" className="fv-input" />
              <input value={lotLat} onChange={(e) => setLotLat(e.target.value)} placeholder="Latitude" className="fv-input" />
              <input value={lotLng} onChange={(e) => setLotLng(e.target.value)} placeholder="Longitude" className="fv-input" />
              <input value={lotCapacity} onChange={(e) => setLotCapacity(e.target.value)} placeholder="Capacity (trucks)" type="number" className="fv-input" />
            </div>
            <div className="mt-3">
              <TechnicalLabel className="mb-2 block">AMENITIES</TechnicalLabel>
              <div className="flex flex-wrap gap-2">
                {AMENITIES.map((a) => (
                  <button key={a} onClick={() => setLotAmenities((p) => p.includes(a) ? p.filter(x => x !== a) : [...p, a])} className="fv-btn-secondary" style={{ width: "auto", padding: "5px 10px", fontSize: "10px", background: lotAmenities.includes(a) ? "linear-gradient(180deg, #2a2a2e, #141416)" : undefined, color: lotAmenities.includes(a) ? "#f5f5f7" : undefined }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleAddLot} disabled={!lotName} className="fv-btn-primary mt-3" style={{ width: "auto", padding: "10px 20px" }}>
              <Plus size={14} className="inline" /> Add Lot
            </button>
            {fleetOverview?.parkingLots?.map((lot: { name: string; address?: string; capacityTrucks: number; amenities?: string[] }) => (
              <div key={lot.name} className="mt-2 rounded-lg border border-black/5 bg-[var(--fv-surface)] p-2 font-mono text-[11px] text-[var(--fv-slate)]">
                <MapPin size={12} className="mr-1 inline" /> {lot.name} — {lot.address} (cap: {lot.capacityTrucks}) [{lot.amenities?.join(", ")}]
              </div>
            ))}
          </SkeuomorphicCard>
        )}

        {step === 2 && fleetId && (
          <SkeuomorphicCard padding="lg">
            <TechnicalLabel className="mb-3 block">ADD DRIVER</TechnicalLabel>
            <div className="flex gap-3">
              <input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Driver name" className="fv-input flex-1" />
              <button onClick={handleAddDriver} disabled={!driverName} className="fv-btn-primary" style={{ width: "auto", padding: "10px 20px" }}>
                <Plus size={14} className="inline" /> Add Driver
              </button>
            </div>
            {fleetOverview?.drivers?.map((d: { driverName: string; driverId: string; assignedTruckSlug?: string }) => (
              <div key={d.driverId} className="mt-2 rounded-lg border border-black/5 bg-[var(--fv-surface)] p-2 font-mono text-[11px] text-[var(--fv-slate)]">
                <Users size={12} className="mr-1 inline" /> {d.driverName} {d.assignedTruckSlug && `→ ${d.assignedTruckSlug}`}
              </div>
            ))}
          </SkeuomorphicCard>
        )}

        {step === 3 && fleetId && (
          <SkeuomorphicCard padding="lg">
            <TechnicalLabel className="mb-3 block">PLAN ROUTE</TechnicalLabel>
            <p className="text-sm text-[var(--fv-text-muted)]">Use the AI Planner for full route planning with charger analysis.</p>
            <a href="/planner" className="fv-btn-primary mt-3 no-underline inline-block" style={{ width: "auto", padding: "12px 20px" }}>Open AI Planner →</a>
            {fleetOverview?.routes?.length === 0 && (
              <p className="mt-3 font-mono text-[10px] text-[var(--fv-steel)]">No routes planned yet.</p>
            )}
            {fleetOverview?.routes?.map((r: { name: string; routeId: string }) => (
              <div key={r.routeId} className="mt-2 rounded-lg border border-black/5 bg-[var(--fv-surface)] p-2 font-mono text-[11px] text-[var(--fv-slate)]">
                <Route size={12} className="mr-1 inline" /> {r.name}
              </div>
            ))}
          </SkeuomorphicCard>
        )}
      </div>

      <div className="fv-footer-credit mt-3.5 text-right">
        POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
      </div>
    </FramedPanel>
  );
}
