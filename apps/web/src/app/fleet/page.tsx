"use client";

/**
 * Fleet Manager dashboard — full-bleed workbench layout.
 * Setup wizard + selectable HVIP catalog to build the fleet.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useWorkOSAuth } from "@/lib/auth";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { KpiCell } from "@/components/design/kpi-cell";
import { PrimaryButton } from "@/components/design/primary-button";
import { StatusBadge } from "@/components/design/status-badge";
import { TechnicalLabel } from "@/components/design/technical-label";
import { SkeletonContent } from "@/components/design/skeleton-card";
import {
  FleetVehiclePicker,
  type FleetSelection,
} from "@/components/fleet/fleet-vehicle-picker";
import { CreateFleetModal } from "@/components/fleet/create-fleet-modal";
import { CelebrationOverlay } from "@/components/fleet/celebration-overlay";
import {
  addSavedFleet,
  type FleetStatus,
  type SavedFleetVehicle,
} from "@/lib/fleet/saved-fleets";
import {
  Check,
  MapPin,
  Plus,
  Route,
  Users,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SELECTION_KEY = "fleetvolt_fleet_selected_vehicles";
const FLEET_ID_KEY = "fleetvolt_active_fleet_id";
const NAMES_KEY = "fleetvolt_fleet_vehicle_names";

type NameMap = Record<string, string>;

function loadSelection(): FleetSelection {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    // Migrate legacy Set-as-array format → qty 1 each
    if (Array.isArray(parsed)) {
      const next: FleetSelection = {};
      for (const slug of parsed) {
        if (typeof slug === "string") next[slug] = 1;
      }
      return next;
    }
    if (parsed && typeof parsed === "object") {
      const next: FleetSelection = {};
      for (const [slug, qty] of Object.entries(parsed as Record<string, unknown>)) {
        const n = typeof qty === "number" ? qty : parseInt(String(qty), 10);
        if (Number.isFinite(n) && n > 0) next[slug] = n;
      }
      return next;
    }
    return {};
  } catch {
    return {};
  }
}

function persistSelection(selection: FleetSelection) {
  try {
    localStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
  } catch {
    // ignore
  }
}

function loadNames(): NameMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(NAMES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as NameMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistNames(names: NameMap) {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(names));
  } catch {
    // ignore
  }
}

export default function FleetDashboardPage() {
  const { displayName, loading } = useWorkOSAuth();
  const [step, setStep] = useState(0);
  const [fleetId, setFleetId] = useState<string | null>(null);
  const [lotName, setLotName] = useState("");
  const [lotAddress, setLotAddress] = useState("");
  const [lotLat, setLotLat] = useState("");
  const [lotLng, setLotLng] = useState("");
  const [lotCapacity, setLotCapacity] = useState("10");
  const [lotAmenities, setLotAmenities] = useState<string[]>([]);
  const [driverName, setDriverName] = useState("");
  const [selection, setSelection] = useState<FleetSelection>({});
  const [vehicleNames, setVehicleNames] = useState<NameMap>({});
  const [mounted, setMounted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [celebrateName, setCelebrateName] = useState("");

  const createFleet = useMutation(api.fleet.mutations.createFleet);
  const addLot = useMutation(api.fleet.mutations.addParkingLot);
  const addDriver = useMutation(api.fleet.mutations.addDriverToFleet);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate persisted browser state after mount */
    setSelection(loadSelection());
    setVehicleNames(loadNames());
    try {
      const saved = localStorage.getItem(FLEET_ID_KEY);
      if (saved) setFleetId(saved);
    } catch {
      // ignore
    }
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Sidebar hash links (#fleets, #drivers, …) → scroll + open matching setup step
  useEffect(() => {
    if (!mounted) return;
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash === "fleets") setStep(0);
      if (hash === "parking") setStep(1);
      if (hash === "drivers") setStep(2);
      if (hash === "routes" || hash === "maintenance") setStep(3);
      if (!hash) return;
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [mounted]);

  const fleetOverview = useQuery(
    api.fleet.queries.getFleetOverview,
    fleetId ? { fleetId } : "skip",
  );

  const AMENITIES = [
    "charging",
    "restroom",
    "food",
    "secure_parking",
    "maintenance",
    "driver_lounge",
  ];
  const steps = ["Create Fleet", "Parking Lots", "Drivers", "Routes"];

  const selectedVehicles: SavedFleetVehicle[] = useMemo(
    () =>
      Object.entries(selection).map(([slug, qty]) => ({
        slug,
        qty,
        displayName: vehicleNames[slug],
      })),
    [selection, vehicleNames],
  );

  const canCreateFleet = selectedVehicles.some((v) => v.qty > 0);

  async function handleSaveFleet(input: {
    name: string;
    routeName: string;
    status: FleetStatus;
  }) {
    const id = `fleet_${Date.now()}`;
    await createFleet({
      fleetId: id,
      name: input.name,
      address: "TBD",
      location: { lat: 0, lng: 0 },
    });
    setFleetId(id);
    try {
      localStorage.setItem(FLEET_ID_KEY, id);
    } catch {
      // ignore
    }
    addSavedFleet({
      id,
      name: input.name,
      routeName: input.routeName,
      status: input.status,
      vehicles: selectedVehicles,
      createdAt: Date.now(),
    });
    setModalOpen(false);
    setCelebrateName(input.name);
    setCelebrate(true);
    setStep(1);
  }

  async function handleAddLot() {
    if (!fleetId) return;
    const lotId = `lot_${Date.now()}`;
    await addLot({
      lotId,
      fleetId,
      name: lotName,
      address: lotAddress,
      location: {
        lat: parseFloat(lotLat) || 0,
        lng: parseFloat(lotLng) || 0,
      },
      capacityTrucks: parseInt(lotCapacity) || 1,
      amenities: lotAmenities,
    });
    setLotName("");
    setLotAddress("");
    setLotLat("");
    setLotLng("");
    setLotCapacity("10");
    setLotAmenities([]);
  }

  async function handleAddDriver() {
    if (!fleetId) return;
    const driverId = `drv_${Date.now()}`;
    const truckSlug = Object.keys(selection)[0];
    await addDriver({
      fleetId,
      driverId,
      driverName,
      ...(truckSlug ? { assignedTruckSlug: truckSlug } : {}),
    });
    setDriverName("");
  }

  function toggleSlug(slug: string, displayName?: string) {
    setSelection((prev) => {
      const next = { ...prev };
      if (next[slug] != null) {
        delete next[slug];
      } else {
        next[slug] = 1;
      }
      persistSelection(next);
      return next;
    });
    if (displayName) {
      setVehicleNames((prev) => {
        const next = { ...prev, [slug]: displayName };
        persistNames(next);
        return next;
      });
    }
  }

  function setQty(slug: string, qty: number) {
    setSelection((prev) => {
      const next = { ...prev, [slug]: Math.max(1, qty) };
      persistSelection(next);
      return next;
    });
  }

  function clearSelection() {
    setSelection({});
    persistSelection({});
  }

  if (loading || !mounted) {
    return (
      <div
        data-testid="fleet-dashboard"
        className="min-h-[calc(100dvh-3.5rem)] w-full max-w-none bg-[var(--fv-bg)] px-5 py-5 md:px-8"
      >
        <SkeletonContent kpiCount={3} cardLines={6} />
      </div>
    );
  }

  const greeting = displayName ? `Welcome, ${displayName}` : "Fleet Manager";

  return (
    <div
      data-testid="fleet-dashboard"
      className="min-h-[calc(100dvh-3.5rem)] w-full max-w-none bg-[var(--fv-bg)]"
    >
      <div className="border-b border-black/8 bg-[var(--fv-paper)] px-5 py-5 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3.5">
            <h1 className="text-[19px] font-bold tracking-tight text-[var(--fv-graphite)]">
              {greeting}
            </h1>
            <StatusBadge variant="ok">Fleet Manager</StatusBadge>
          </div>
          <Link href="/fleet/contract-plan" className="no-underline">
            <PrimaryButton className="flex items-center gap-2">
              <ArrowRight size={16} />
              Plan Contract
            </PrimaryButton>
          </Link>
        </div>
      </div>

      <div className="px-5 py-5 md:px-8">
        {/* Fleet Setup */}
        <section id="fleets" className="scroll-mt-20">
          <SkeuomorphicCard padding="lg">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-base font-bold text-[var(--fv-graphite)]">
                  Fleet Setup
                </span>
                <TechnicalLabel>FLEET REGISTRATION & OPERATIONS</TechnicalLabel>
              </div>
              <StatusBadge variant={fleetId ? "ok" : "neutral"}>
                {fleetId ? "Fleet Active" : "No Fleet Created"}
              </StatusBadge>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <KpiCell
                label="DRIVERS"
                value={fleetOverview?.drivers?.length ?? 0}
              />
              <KpiCell
                label="PARKING LOTS"
                value={fleetOverview?.parkingLots?.length ?? 0}
              />
              <KpiCell
                label="ROUTES"
                value={fleetOverview?.routes?.length ?? 0}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {steps.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStep(i)}
                  className={cn(
                    "min-h-11 rounded-sm border px-3 text-[11px] font-mono uppercase tracking-wider transition",
                    step === i
                      ? "border-[#42a5d9] bg-[#42a5d9] text-[#061018]"
                      : "border-white/12 bg-[#121820] text-[#a5b2bc] hover:border-[#42a5d9]/50 hover:text-white",
                  )}
                >
                  {i + 1}. {s}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {step === 0 && (
                <div>
                  <TechnicalLabel className="mb-3 block">
                    BUILD YOUR FLEET
                  </TechnicalLabel>
                  <p className="mb-3 text-sm text-[var(--fv-text-muted)]">
                    Check vehicles in the catalog below, set quantities, then
                    create your fleet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    disabled={!canCreateFleet}
                    className={cn(
                      "fv-btn-primary",
                      canCreateFleet && "fv-create-fleet-pulse",
                    )}
                    style={{ width: "auto", padding: "10px 20px" }}
                    data-testid="create-fleet-cta"
                  >
                    Create Fleet
                  </button>
                  {canCreateFleet ? (
                    <p className="mt-2 text-xs text-[var(--fv-text-muted)]">
                      {selectedVehicles.length} model
                      {selectedVehicles.length === 1 ? "" : "s"} ·{" "}
                      {selectedVehicles.reduce((s, v) => s + v.qty, 0)} unit
                      {selectedVehicles.reduce((s, v) => s + v.qty, 0) === 1
                        ? ""
                        : "s"}{" "}
                      ready.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-[var(--fv-text-muted)]">
                      Select at least one vehicle with qty ≥ 1 to enable Create
                      Fleet.
                    </p>
                  )}
                  {fleetId ? (
                    <div className="mt-3 flex items-center gap-1 font-mono text-[10px] text-[var(--fv-signal-green)]">
                      <Check size={14} /> Fleet active: {fleetId}
                    </div>
                  ) : null}
                </div>
              )}

              {step === 1 && (
                <div id="parking">
                  {!fleetId ? (
                    <p className="text-sm text-[var(--fv-text-muted)]">
                      Create a fleet first.
                    </p>
                  ) : (
                    <>
                      <TechnicalLabel className="mb-3 block">
                        ADD PARKING LOT
                      </TechnicalLabel>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <input
                          value={lotName}
                          onChange={(e) => setLotName(e.target.value)}
                          placeholder="Lot name"
                          className="fv-input"
                        />
                        <input
                          value={lotAddress}
                          onChange={(e) => setLotAddress(e.target.value)}
                          placeholder="Address"
                          className="fv-input"
                        />
                        <input
                          value={lotLat}
                          onChange={(e) => setLotLat(e.target.value)}
                          placeholder="Latitude"
                          className="fv-input"
                        />
                        <input
                          value={lotLng}
                          onChange={(e) => setLotLng(e.target.value)}
                          placeholder="Longitude"
                          className="fv-input"
                        />
                        <input
                          value={lotCapacity}
                          onChange={(e) => setLotCapacity(e.target.value)}
                          placeholder="Capacity (trucks)"
                          type="number"
                          className="fv-input"
                        />
                      </div>
                      <div className="mt-3">
                        <TechnicalLabel className="mb-2 block">
                          AMENITIES
                        </TechnicalLabel>
                        <div className="flex flex-wrap gap-2">
                          {AMENITIES.map((a) => (
                            <button
                              key={a}
                              type="button"
                              onClick={() =>
                                setLotAmenities((p) =>
                                  p.includes(a)
                                    ? p.filter((x) => x !== a)
                                    : [...p, a],
                                )
                              }
                              className="fv-btn-secondary"
                              style={{
                                width: "auto",
                                padding: "5px 10px",
                                fontSize: "10px",
                                background: lotAmenities.includes(a)
                                  ? "linear-gradient(180deg, #2a2a2e, #141416)"
                                  : undefined,
                                color: lotAmenities.includes(a)
                                  ? "#f5f5f7"
                                  : undefined,
                              }}
                            >
                              {a}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleAddLot()}
                        disabled={!lotName}
                        className="fv-btn-primary mt-3"
                        style={{ width: "auto", padding: "10px 20px" }}
                      >
                        <Plus size={14} className="inline" /> Add Lot
                      </button>
                      {fleetOverview?.parkingLots?.map(
                        (lot: {
                          name: string;
                          address?: string;
                          capacityTrucks: number;
                          amenities?: string[];
                        }) => (
                          <div
                            key={lot.name}
                            className="mt-2 rounded-lg border border-black/5 bg-[var(--fv-surface)] p-2 font-mono text-[11px] text-[var(--fv-slate)]"
                          >
                            <MapPin size={12} className="mr-1 inline" />{" "}
                            {lot.name} — {lot.address} (cap:{" "}
                            {lot.capacityTrucks}) [
                            {lot.amenities?.join(", ")}]
                          </div>
                        ),
                      )}
                    </>
                  )}
                </div>
              )}

              {step === 2 && (
                <div id="drivers">
                  {!fleetId ? (
                    <p className="text-sm text-[var(--fv-text-muted)]">
                      Create a fleet first.
                    </p>
                  ) : (
                    <>
                      <TechnicalLabel className="mb-3 block">
                        ADD DRIVER
                      </TechnicalLabel>
                      <div className="flex flex-wrap gap-3">
                        <input
                          value={driverName}
                          onChange={(e) => setDriverName(e.target.value)}
                          placeholder="Driver name"
                          className="fv-input min-w-[220px] flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => void handleAddDriver()}
                          disabled={!driverName}
                          className="fv-btn-primary"
                          style={{ width: "auto", padding: "10px 20px" }}
                        >
                          <Plus size={14} className="inline" /> Add Driver
                        </button>
                      </div>
                      {fleetOverview?.drivers?.map(
                        (d: {
                          driverName: string;
                          driverId: string;
                          assignedTruckSlug?: string;
                        }) => (
                          <div
                            key={d.driverId}
                            className="mt-2 rounded-lg border border-black/5 bg-[var(--fv-surface)] p-2 font-mono text-[11px] text-[var(--fv-slate)]"
                          >
                            <Users size={12} className="mr-1 inline" />{" "}
                            {d.driverName}{" "}
                            {d.assignedTruckSlug &&
                              `→ ${d.assignedTruckSlug}`}
                          </div>
                        ),
                      )}
                    </>
                  )}
                </div>
              )}

              {step === 3 && (
                <div id="routes">
                  <TechnicalLabel className="mb-3 block">
                    PLAN ROUTE
                  </TechnicalLabel>
                  <p className="text-sm text-[var(--fv-text-muted)]">
                    Plan contract routes with charger, schedule, and fleet
                    assumptions on the map.
                  </p>
                  <Link
                    href="/fleet/contract-plan"
                    className="fv-btn-primary mt-3 inline-block no-underline"
                    style={{ width: "auto", padding: "12px 20px" }}
                  >
                    Open Contract Plan →
                  </Link>
                  {fleetOverview?.routes?.length === 0 && (
                    <p className="mt-3 font-mono text-[10px] text-[var(--fv-steel)]">
                      No routes planned yet.
                    </p>
                  )}
                  {fleetOverview?.routes?.map(
                    (r: { name: string; routeId: string }) => (
                      <div
                        key={r.routeId}
                        className="mt-2 rounded-lg border border-black/5 bg-[var(--fv-surface)] p-2 font-mono text-[11px] text-[var(--fv-slate)]"
                      >
                        <Route size={12} className="mr-1 inline" /> {r.name}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </SkeuomorphicCard>
        </section>

        <div id="maintenance" className="scroll-mt-20" />

        <FleetVehiclePicker
          selection={selection}
          onToggle={toggleSlug}
          onQtyChange={setQty}
          onClearSelection={clearSelection}
        />

        <div className="fv-footer-credit mt-8 pb-6 text-right">
          POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
        </div>
      </div>

      <CreateFleetModal
        open={modalOpen}
        vehicles={selectedVehicles}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveFleet}
      />

      <CelebrationOverlay
        active={celebrate}
        fleetName={celebrateName}
        onDone={() => setCelebrate(false)}
      />
    </div>
  );
}
