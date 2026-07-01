"""Centralized physical constants and unit conversions (MAPE drift prevention)."""

from __future__ import annotations

G = 9.80665  # m/s² standard gravity
MPS_PER_MPH = 0.44704  # meters per second per mile per hour
US_MILE_M = 1609.344  # meters per US survey mile
RHO_SEA_LEVEL = 1.225  # kg/m³ air density at sea level, 15°C
LBS_TO_KG = 0.45359237

# Segment builder limits (D-05, D-07, threat T-02-02)
MAX_PHYSICS_SEGMENTS = 200
BASE_SEGMENT_M = US_MILE_M * 10
GRADE_SCAN_INTERVAL_M = 150.0
GRADE_SPLIT_THRESHOLD_PCT = 6.0
