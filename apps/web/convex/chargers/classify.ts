// Pure Class-8 charger classifier + connector normalization (P12-07).
//
// NO Convex imports — pure functions so they unit-test fast (node --test) and
// are reused by the ingest action (chargers/ingest.ts). This is the honesty
// engine of the flagship gap: the ≥350 kW AND MD/HD gate is what makes the
// POLB→SB corridor return ZERO Class-8-capable chargers (the LD dealership /
// Tesla units at 44–75 kW correctly classify FALSE). Mirrors the Phase-1
// PostGIS logic in data/ingest/chargers.py (POWER_FLOOR_KW=350, J3271/MCS MCS
// gate) so the two backends agree.

/** AFDC max vehicle class as returned by developer.nlr.gov. */
export type MaxVehicleClass = "LD" | "MD" | "HD";

/** ≥350 kW HD power floor (mirror of data/ingest/chargers.py POWER_FLOOR_KW). */
export const POWER_FLOOR_KW = 350;

/** Connector tokens that count as MCS-capable (heavy-duty megawatt charging). */
export const MCS_CONNECTORS = new Set(["J3271", "MCS"]);

/**
 * THE Class-8 capability gate (P12-07): a station is usable by an 80,000 lb
 * Class-8 truck ONLY if its peak connector power is ≥350 kW AND the site's
 * maximum_vehicle_class is Medium- or Heavy-Duty. Power alone is not enough — a
 * 400 kW LD dealership stall does NOT qualify (wrong site class); an HD site at
 * 300 kW does NOT qualify (below the floor). Both boundary cases return false.
 */
export function isClass8Capable(
  maxPowerKw: number,
  maxVehicleClass: string | null | undefined,
): boolean {
  return (
    maxPowerKw >= POWER_FLOOR_KW &&
    (maxVehicleClass === "MD" || maxVehicleClass === "HD")
  );
}

/**
 * Shape of a single AFDC ev_charging_unit's connectors map:
 *   { "<TYPE>": { power_kw: number|null, port_count: number } }
 */
export interface AfdcConnector {
  power_kw?: number | null;
  port_count?: number | null;
}
export interface AfdcChargingUnit {
  connectors?: Record<string, AfdcConnector> | null;
  charging_level?: string | null;
}

/**
 * Derive the station's peak per-connector power (kW) from the AFDC
 * ev_charging_units[] list — the max power_kw across every unit and every
 * connector (nulls skipped). Mirrors data/ingest/chargers.py _aggregate_by_
 * station's max() over units. Returns 0 when no numeric power is present.
 */
export function stationMaxPowerKw(
  units: AfdcChargingUnit[] | null | undefined,
): number {
  if (!units || units.length === 0) return 0;
  let max = 0;
  for (const unit of units) {
    const connectors = unit?.connectors;
    if (!connectors) continue;
    for (const key of Object.keys(connectors)) {
      const p = connectors[key]?.power_kw;
      if (typeof p === "number" && Number.isFinite(p) && p > max) max = p;
    }
  }
  return max;
}

/**
 * Normalize AFDC ev_connector_types into a sorted, de-duplicated, upper-cased
 * array. Tolerates a raw array, a delimited string, null, or undefined.
 */
export function normalizeConnectors(
  connectorTypes: string[] | string | null | undefined,
): string[] {
  if (!connectorTypes) return [];
  const raw = Array.isArray(connectorTypes)
    ? connectorTypes
    : connectorTypes.split(/[|,]/);
  const set = new Set<string>();
  for (const c of raw) {
    const token = String(c).trim().toUpperCase();
    if (token) set.add(token);
  }
  return [...set].sort();
}

/**
 * True when any connector is MCS-capable (J3271 / MCS) — mirrors the Phase-1
 * is_mcs_capable = connectors ∩ {J3271, MCS} logic.
 */
export function isMcsCapable(
  connectors: string[] | string | null | undefined,
): boolean {
  const normalized = normalizeConnectors(connectors);
  return normalized.some((c) => MCS_CONNECTORS.has(c));
}
