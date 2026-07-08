"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Truck, MapPin, Users, Route, Plus, Check } from "lucide-react";

export default function FleetPage() {
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
  const [routeName, setRouteName] = useState("");

  const createFleet = useMutation(api.fleet.mutations.createFleet);
  const addLot = useMutation(api.fleet.mutations.addParkingLot);
  const addDriver = useMutation(api.fleet.mutations.addDriverToFleet);
  const createRouteMut = useMutation(api.fleet.mutations.createRoute);

  const fleetOverview = useQuery(
    api.fleet.queries.getFleetOverview,
    fleetId ? { fleetId } : "skip",
  );

  const AMENITIES = ["charging", "restroom", "food", "secure_parking", "maintenance", "driver_lounge"];

  async function handleCreateFleet() {
    const id = `fleet_${Date.now()}`;
    await createFleet({ fleetId: id, name: fleetName, address: "TBD", lat: 0, lng: 0 });
    setFleetId(id);
    setStep(1);
  }

  async function handleAddLot() {
    if (!fleetId) return;
    const lotId = `lot_${Date.now()}`;
    await addLot({
      lotId, fleetId, name: lotName, address: lotAddress,
      lat: parseFloat(lotLat) || 0, lng: parseFloat(lotLng) || 0,
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

  const steps = ["Create Fleet", "Parking Lots", "Drivers", "Routes & Assignments"];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2 text-[var(--fv-text,#e0e0e8)]">Fleet Manager</h1>
      <div className="flex gap-2 mb-6">
        {steps.map((s, i) => (
          <button key={i} onClick={() => setStep(i)} className={`px-3 py-1.5 rounded-lg text-sm ${step === i ? "bg-[var(--fv-accent,#3b82f6)] text-white" : "bg-[var(--fv-surface,#1a1a2e)] text-[var(--fv-text-muted,#888)]"}`}>
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3 p-6 rounded-lg bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)]">
          <label className="block text-sm text-[var(--fv-text-muted,#888)]">Fleet / Company Name</label>
          <input value={fleetName} onChange={(e) => setFleetName(e.target.value)} placeholder="Acme Drayage Co." className="w-full px-4 py-2 rounded-lg bg-[var(--fv-bg,#0d0d1a)] border border-[var(--fv-stroke,#2a2a3e)] text-[var(--fv-text,#e0e0e8)]" />
          <button onClick={handleCreateFleet} disabled={!fleetName} className="px-4 py-2 rounded-lg bg-[var(--fv-accent,#3b82f6)] text-white disabled:opacity-50">Create Fleet</button>
          {fleetId && <p className="text-sm text-green-400 flex items-center gap-1"><Check size={14} /> Fleet created: {fleetName}</p>}
        </div>
      )}

      {step === 1 && fleetId && (
        <div className="space-y-3 p-6 rounded-lg bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)]">
          <h2 className="font-semibold text-[var(--fv-text,#e0e0e8)]">Add Parking Lot</h2>
          <div className="grid grid-cols-2 gap-3">
            <input value={lotName} onChange={(e) => setLotName(e.target.value)} placeholder="Lot name" className="px-3 py-2 rounded-lg bg-[var(--fv-bg,#0d0d1a)] border border-[var(--fv-stroke,#2a2a3e)] text-[var(--fv-text,#e0e0e8)] text-sm" />
            <input value={lotAddress} onChange={(e) => setLotAddress(e.target.value)} placeholder="Address" className="px-3 py-2 rounded-lg bg-[var(--fv-bg,#0d0d1a)] border border-[var(--fv-stroke,#2a2a3e)] text-[var(--fv-text,#e0e0e8)] text-sm" />
            <input value={lotLat} onChange={(e) => setLotLat(e.target.value)} placeholder="Latitude" className="px-3 py-2 rounded-lg bg-[var(--fv-bg,#0d0d1a)] border border-[var(--fv-stroke,#2a2a3e)] text-[var(--fv-text,#e0e0e8)] text-sm" />
            <input value={lotLng} onChange={(e) => setLotLng(e.target.value)} placeholder="Longitude" className="px-3 py-2 rounded-lg bg-[var(--fv-bg,#0d0d1a)] border border-[var(--fv-stroke,#2a2a3e)] text-[var(--fv-text,#e0e0e8)] text-sm" />
            <input value={lotCapacity} onChange={(e) => setLotCapacity(e.target.value)} placeholder="Capacity (trucks)" type="number" className="px-3 py-2 rounded-lg bg-[var(--fv-bg,#0d0d1a)] border border-[var(--fv-stroke,#2a2a3e)] text-[var(--fv-text,#e0e0e8)] text-sm" />
          </div>
          <div>
            <p className="text-sm text-[var(--fv-text-muted,#888)] mb-1">Amenities</p>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((a) => (
                <button key={a} onClick={() => setLotAmenities((p) => p.includes(a) ? p.filter(x => x !== a) : [...p, a])} className={`px-2 py-1 rounded text-xs ${lotAmenities.includes(a) ? "bg-[var(--fv-accent,#3b82f6)] text-white" : "bg-[var(--fv-bg,#0d0d1a)] border border-[var(--fv-stroke,#2a2a3e)] text-[var(--fv-text-muted,#888)]"}`}>{a}</button>
              ))}
            </div>
          </div>
          <button onClick={handleAddLot} disabled={!lotName} className="px-4 py-2 rounded-lg bg-[var(--fv-accent,#3b82f6)] text-white disabled:opacity-50"><Plus size={14} className="inline" /> Add Lot</button>
          {fleetOverview?.parkingLots?.map((lot: { name: string; address?: string; capacityTrucks: number; amenities?: string[] }) => (
            <div key={lot.name} className="text-sm text-[var(--fv-text,#e0e0e8)] p-2 rounded bg-[var(--fv-bg,#0d0d1a)]">
              <MapPin size={12} className="inline mr-1" /> {lot.name} — {lot.address} (cap: {lot.capacityTrucks}) [{lot.amenities?.join(", ")}]
            </div>
          ))}
        </div>
      )}

      {step === 2 && fleetId && (
        <div className="space-y-3 p-6 rounded-lg bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)]">
          <h2 className="font-semibold text-[var(--fv-text,#e0e0e8)]">Add Driver</h2>
          <input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Driver name" className="w-full px-4 py-2 rounded-lg bg-[var(--fv-bg,#0d0d1a)] border border-[var(--fv-stroke,#2a2a3e)] text-[var(--fv-text,#e0e0e8)]" />
          <button onClick={handleAddDriver} disabled={!driverName} className="px-4 py-2 rounded-lg bg-[var(--fv-accent,#3b82f6)] text-white disabled:opacity-50"><Plus size={14} className="inline" /> Add Driver</button>
          {fleetOverview?.drivers?.map((d: { driverName: string; driverId: string; assignedTruckSlug?: string }) => (
            <div key={d.driverId} className="text-sm text-[var(--fv-text,#e0e0e8)] p-2 rounded bg-[var(--fv-bg,#0d0d1a)]">
              <Users size={12} className="inline mr-1" /> {d.driverName} {d.assignedTruckSlug && `→ ${d.assignedTruckSlug}`}
            </div>
          ))}
        </div>
      )}

      {step === 3 && fleetId && (
        <div className="space-y-3 p-6 rounded-lg bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)]">
          <h2 className="font-semibold text-[var(--fv-text,#e0e0e8)]">Plan Route</h2>
          <p className="text-sm text-[var(--fv-text-muted,#888)]">Use the AI Planner for full route planning with charger analysis.</p>
          <a href="/planner" className="inline-block px-4 py-2 rounded-lg bg-[var(--fv-accent,#3b82f6)] text-white text-sm">Open AI Planner →</a>
          {fleetOverview?.routes?.length === 0 && <p className="text-sm text-[var(--fv-text-muted,#888)]">No routes planned yet.</p>}
          {fleetOverview?.routes?.map((r: { name: string; routeId: string }) => (
            <div key={r.routeId} className="text-sm text-[var(--fv-text,#e0e0e8)] p-2 rounded bg-[var(--fv-bg,#0d0d1a)]">
              <Route size={12} className="inline mr-1" /> {r.name}
            </div>
          ))}
        </div>
      )}

      {fleetId && (
        <div className="mt-6 p-4 rounded-lg bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)]">
          <h3 className="text-sm font-semibold text-[var(--fv-text,#e0e0e8)] mb-2">Fleet Overview</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><Truck size={14} className="inline mr-1 text-[var(--fv-text-muted,#888)]" /> {fleetOverview?.drivers?.length ?? 0} drivers</div>
            <div><MapPin size={14} className="inline mr-1 text-[var(--fv-text-muted,#888)]" /> {fleetOverview?.parkingLots?.length ?? 0} lots</div>
            <div><Route size={14} className="inline mr-1 text-[var(--fv-text-muted,#888)]" /> {fleetOverview?.routes?.length ?? 0} routes</div>
          </div>
        </div>
      )}
    </div>
  );
}
