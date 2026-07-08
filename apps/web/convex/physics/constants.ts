// Centralized physical constants and unit conversions (port of constants.py).
// EXACT values from services/simulator/app/simulation/constants.py — drift breaks parity.

export const G = 9.80665; // m/s² standard gravity
export const MPS_PER_MPH = 0.44704; // meters per second per mile per hour
export const US_MILE_M = 1609.344; // meters per US survey mile
export const RHO_SEA_LEVEL = 1.225; // kg/m³ air density at sea level, 15°C
export const LBS_TO_KG = 0.45359237;

// Segment builder limits (D-05, D-07, threat T-02-02)
export const MAX_PHYSICS_SEGMENTS = 200;
export const BASE_SEGMENT_M = US_MILE_M * 10; // ~16093.44 m (10 US miles)
export const GRADE_SCAN_INTERVAL_M = 150.0;
export const GRADE_SPLIT_THRESHOLD_PCT = 6.0;

// Route provider constants (from route_provider.py)
export const KPH_TO_MPH = 1.0 / 1.609344;
export const DEFAULT_TRUCK_TOP_SPEED_MPH = 120.0 * KPH_TO_MPH; // ≈ 74.5645 mph
