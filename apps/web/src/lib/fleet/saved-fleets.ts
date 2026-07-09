export type FleetStatus = "active" | "planned" | "archived";

export type SavedFleetVehicle = {
  slug: string;
  displayName?: string;
  qty: number;
};

export type SavedFleet = {
  id: string;
  name: string;
  routeName: string;
  status: FleetStatus;
  vehicles: SavedFleetVehicle[];
  createdAt: number;
};

const STORAGE_KEY = "fleetvolt_saved_fleets";
export const SAVED_FLEETS_EVENT = "fleetvolt:saved-fleets-changed";

export function loadSavedFleets(): SavedFleet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedFleet[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistSavedFleets(fleets: SavedFleet[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fleets));
    window.dispatchEvent(new Event(SAVED_FLEETS_EVENT));
  } catch {
    // ignore
  }
}

export function addSavedFleet(fleet: SavedFleet): SavedFleet[] {
  const next = [fleet, ...loadSavedFleets().filter((f) => f.id !== fleet.id)];
  persistSavedFleets(next);
  return next;
}
