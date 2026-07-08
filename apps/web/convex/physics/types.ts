// Physics types — port of schemas.py + physics_engine.py dataclasses.
// Mirrors the Python dataclass / Pydantic model shapes for parity.

import { LBS_TO_KG } from "./constants";

/** Truck physics parameters — mirrors TruckParams dataclass (physics_engine.py). */
export interface TruckParams {
  usable_kwh: number;
  curb_weight_lbs: number;
  payload_lbs: number;
  C_rr: number;
  drag_coefficient: number;
  frontal_area_m2: number;
  regen_efficiency: number;
  regen_power_cap_kw: number;
  regen_soc_cutoff: number;
  aux_kw_base: number;
  drivetrain_efficiency: number;
}

/** mass_kg property — (curb_weight_lbs + payload_lbs) * LBS_TO_KG. */
export function massKg(truck: TruckParams): number {
  return (truck.curb_weight_lbs + truck.payload_lbs) * LBS_TO_KG;
}

/** Weather adjustment (mirrors WeatherAdjustment dataclass from weather.py). */
export interface WeatherAdjustment {
  rho: number;
  thermal_factor: number;
  aux_mult: number;
  headwind_mph: number;
  temp_c: number;
}

export type WeatherPresetName = "ideal" | "hot" | "cold" | "headwind";

// --- Schemas.py port ---

export interface LatLon {
  lat: number;
  lon: number;
}

export interface RouteSpec {
  corridor_key?: string | null;
  origin?: LatLon | null;
  dest?: LatLon | null;
  terminal_key?: string | null;
}

export interface TruckSpec {
  slug: string;
}

export interface ChargingConditionsSpec {
  soc_trigger_pct?: number; // default 18.0
  soc_floor_pct?: number; // default 10.0
  target_soc_pct?: number; // default 80.0
  min_arrival_soc_pct?: number; // default 10.0
}

export interface ConditionsSpec {
  weather_preset?: WeatherPresetName; // default "ideal"
  payload_lbs?: number; // default 0
  port_drayage_enabled?: boolean; // default false
  charging?: ChargingConditionsSpec;
}

export interface AssumptionEntry {
  field: string;
  value: number;
  source: string; // "oem_default" | "user_override"
  oem_default: number;
  category?: string | null;
  note?: string | null;
}

export interface OverridesSpec {
  reset_to_oem?: boolean;
  C_rr?: number | null;
  drag_coefficient?: number | null;
  usable_kwh?: number | null;
  aux_kw_base?: number | null;
  regen_efficiency?: number | null;
}

export interface SimulateOptions {
  include_charging?: boolean; // default true
}

export interface SimulateRequest {
  route: RouteSpec;
  truck: TruckSpec;
  conditions?: ConditionsSpec;
  overrides?: OverridesSpec;
  options?: SimulateOptions;
}

export interface SegmentResult {
  dist_m: number;
  grade: number;
  speed: number;
  energy_kwh: number;
  soc_pct: number;
  charging_event?: boolean;
  stop_sequence?: number | null;
}

export interface KpiResult {
  total_kwh: number;
  wh_per_mi: number;
  regen_kwh: number;
  total_time_s: number;
}

export interface ChargingStopResult {
  station_id: string;
  name?: string | null;
  lat: number;
  lon: number;
  power_kw: number;
  arrival_soc_pct: number;
  departure_soc_pct: number;
  dwell_s: number;
  energy_added_kwh: number;
  detour_s: number;
}

export type FeasibilityVerdict = "feasible" | "critical" | "infeasible";
export type FeasibilityTier = "public_hd" | "depot_required" | "infrastructure_gap";
export type BlockingReason =
  | "no_charger_in_radius"
  | "detour_exceeded"
  | "cannot_reach_destination"
  | null;

export interface FeasibilityResult {
  verdict: FeasibilityVerdict;
  tier: FeasibilityTier;
  soc_deficit_kwh?: number | null;
  blocking_reason?: BlockingReason;
  stop_count: number;
}

export interface SimulateResponse {
  segments: SegmentResult[];
  kpis: KpiResult;
  disclaimer: string;
  assumptions: AssumptionEntry[];
  corridor_key?: string | null;
  truck_slug?: string | null;
  metadata?: Record<string, unknown>;
  charging_stops?: ChargingStopResult[] | null;
  feasibility?: FeasibilityResult | null;
}

/** Internal segment (from buildSegments). */
export interface PhysicsSegment {
  dist_m: number;
  grade_pct: number;
  start_m: number;
  end_m: number;
  mid_lon: number;
  mid_lat: number;
}

/** Elevation profile point. */
export interface ElevationPoint {
  dist_m: number;
  elev_m: number;
}

/** Posted speed limit for one edge (from route_provider.py EdgeSpeed). */
export interface EdgeSpeed {
  start_m: number;
  edge_length_m: number;
  speed_limit_mph: number;
}

export function edgeEndM(edge: EdgeSpeed): number {
  return edge.start_m + edge.edge_length_m;
}

/** Charge curve breakpoint (from charge_curve.py). */
export interface ChargeBreakpoint {
  soc_pct: number;
  max_kw: number;
}
