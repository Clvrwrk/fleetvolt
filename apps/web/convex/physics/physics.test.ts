// Unit tests proving numeric parity on known inputs — Plan 13-01 Task 4.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  G,
  US_MILE_M,
  MPS_PER_MPH,
  RHO_SEA_LEVEL,
  LBS_TO_KG,
  MAX_PHYSICS_SEGMENTS,
  BASE_SEGMENT_M,
  GRADE_SCAN_INTERVAL_M,
  GRADE_SPLIT_THRESHOLD_PCT,
  DEFAULT_TRUCK_TOP_SPEED_MPH,
} from "./constants";
import {
  computeInputsHash,
  PHYSICS_VERSION,
  TEST_VECTOR_SCENARIO,
  TEST_VECTOR_EXPECTED_HASH,
} from "../../test-utils/inputsHashSync";
import { CHARGER_VERSION } from "./inputsHash";
import { airDensity, forceComponents, segmentForces } from "./physicsEngine";
import { integrateSoc } from "./socIntegrator";
import {
  buildSegments,
  gradeBetween,
  haversineM,
  interpolateElev,
  interpolatePointAtDist,
  subdivideBaseSegment,
} from "./segmentBuilder";
import { WEATHER_PRESETS, applyWeather } from "./weather";
import { resolveSpeeds, postedSpeedForSegment, defaultTruckSpeedParams } from "./speedResolver";
import { aggregateKpis } from "./kpiAggregator";
import {
  applyTruckOverrides,
  validateOverrideBounds,
  OverrideBoundsError,
} from "./overrides";
import type { TruckParams, ElevationPoint, EdgeSpeed } from "./types";
import { massKg } from "./types";

const ecascadia: TruckParams = {
  usable_kwh: 438,
  curb_weight_lbs: 26000,
  payload_lbs: 34000,
  C_rr: 0.0065,
  drag_coefficient: 0.65,
  frontal_area_m2: 9.8,
  regen_efficiency: 0.70,
  regen_power_cap_kw: 350,
  regen_soc_cutoff: 90,
  aux_kw_base: 10,
  drivetrain_efficiency: 0.92,
};

test("constants: exact Python values", () => {
  assert.equal(G, 9.80665);
  assert.equal(US_MILE_M, 1609.344);
  assert.equal(MPS_PER_MPH, 0.44704);
  assert.equal(RHO_SEA_LEVEL, 1.225);
  assert.equal(LBS_TO_KG, 0.45359237);
  assert.equal(MAX_PHYSICS_SEGMENTS, 200);
  assert.equal(BASE_SEGMENT_M, US_MILE_M * 10);
  assert.equal(GRADE_SCAN_INTERVAL_M, 150.0);
  assert.equal(GRADE_SPLIT_THRESHOLD_PCT, 6.0);
  assert.ok(DEFAULT_TRUCK_TOP_SPEED_MPH > 74 && DEFAULT_TRUCK_TOP_SPEED_MPH < 75);
});

test("airDensity: ~1.204 at 20°C (ISA formula)", () => {
  const rho = airDensity(20);
  // RHO_SEA_LEVEL * (288.15 / 293.15) = 1.225 * 0.98294... ≈ 1.2041
  assert.ok(Math.abs(rho - 1.2041) < 0.001, `rho=${rho}`);
});

test("forceComponents: flat grade at 55mph — fRoll>0, fAero>0, fGrade≈0", () => {
  const mass = massKg(ecascadia);
  const { fRoll, fAero, fGrade } = forceComponents([0], [55], mass, ecascadia.C_rr, ecascadia.drag_coefficient, ecascadia.frontal_area_m2, 1.225);
  assert.ok(fRoll[0] > 0, `fRoll=${fRoll[0]}`);
  assert.ok(fAero[0] > 0, `fAero=${fAero[0]}`);
  assert.ok(Math.abs(fGrade[0]) < 1e-10, `fGrade=${fGrade[0]}`);
});

test("segmentForces: 5% grade produces higher pTraction than 0%", () => {
  const distM = [16093.44];
  const { pTraction: pFlat } = segmentForces(distM, [0], [55], ecascadia, { rho: 1.225 });
  const { pTraction: pGrade } = segmentForces(distM, [5], [55], ecascadia, { rho: 1.225 });
  assert.ok(pGrade[0] > pFlat[0], `grade=${pGrade[0]} flat=${pFlat[0]}`);
});

test("integrateSoc: flat 100mi at 55mph drops SoC from 100 to finite positive", () => {
  const dist = 100 * 1609.344;
  const coords = [[-118, 34], [-117, 34]];
  const profile: ElevationPoint[] = [
    { dist_m: 0, elev_m: 100 },
    { dist_m: dist, elev_m: 100 },
  ];
  const segs = buildSegments(dist, coords, profile);
  const distM = segs.map((s) => s.dist_m);
  const grade = segs.map((s) => s.grade_pct);
  const speed = segs.map(() => 55);
  const { pTraction, auxW } = segmentForces(distM, grade, speed, ecascadia, { rho: airDensity(20) });
  const soc = integrateSoc(pTraction, auxW, distM, speed, ecascadia);
  const finalSoc = soc.socPct[soc.socPct.length - 1];
  assert.ok(finalSoc > 0 && finalSoc < 100, `finalSoc=${finalSoc}`);
  const totalKwh = soc.energyKwh.reduce((a, b) => a + b, 0);
  assert.ok(totalKwh > 0, `totalKwh=${totalKwh}`);
});

test("integrateSoc: negative pTraction (downhill) produces regen > 0 when soc < cutoff", () => {
  const distM = [16093.44];
  const speed = [55];
  const pTraction = [-50000]; // downhill regen
  const auxW = [10000];
  const soc = integrateSoc(pTraction, auxW, distM, speed, ecascadia, { initialSocPct: 80 });
  assert.ok(soc.regenKwh[0] > 0, `regenKwh=${soc.regenKwh[0]}`);
  // SoC should increase (net negative energy)
  assert.ok(soc.socPct[0] > 80, `socPct=${soc.socPct[0]}`);
});

test("integrateSoc: regen disabled when soc > regen_soc_cutoff (90)", () => {
  const distM = [16093.44];
  const speed = [55];
  const pTraction = [-50000];
  const auxW = [10000];
  const soc = integrateSoc(pTraction, auxW, distM, speed, ecascadia, { initialSocPct: 95 });
  assert.equal(soc.regenKwh[0], 0);
  // SoC should decrease (only aux draw, no regen)
  assert.ok(soc.socPct[0] < 95, `socPct=${soc.socPct[0]}`);
});

test("buildSegments: 100mi flat route produces ~10 base segments", () => {
  const dist = 100 * 1609.344;
  const coords = [[-118, 34], [-117, 34]];
  const profile: ElevationPoint[] = [
    { dist_m: 0, elev_m: 100 },
    { dist_m: dist, elev_m: 100 },
  ];
  const segs = buildSegments(dist, coords, profile);
  assert.ok(segs.length >= 9 && segs.length <= 11, `segs=${segs.length}`);
});

test("buildSegments: grade variation triggers subdivision", () => {
  const dist = 20 * 1609.344; // 20 miles = 2 base segments
  const coords = [[-118, 34], [-117.8, 34]];
  // Profile with steep grade change (>6%) within first base segment
  const profile: ElevationPoint[] = [];
  for (let d = 0; d <= dist; d += 150) {
    const elev = d < BASE_SEGMENT_M ? 100 + d * 0.08 : 100; // 8% grade then flat
    profile.push({ dist_m: d, elev_m: elev });
  }
  const segs = buildSegments(dist, coords, profile);
  assert.ok(segs.length > 2, `segs=${segs.length} (should subdivide)`);
});

test("aggregateKpis: sums energy correctly, wh_per_mi = total_kwh/miles*1000", () => {
  const kpis = aggregateKpis([10, 20, 30], [0, 0, 0], [16093, 16093, 16093], [55, 55, 55]);
  assert.equal(kpis.total_kwh, 60);
  const totalMiles = (16093 * 3) / US_MILE_M;
  const expectedWhPerMi = (60 / totalMiles) * 1000;
  assert.ok(Math.abs(kpis.wh_per_mi - expectedWhPerMi) < 0.01);
  assert.ok(kpis.total_time_s > 0);
});

test("applyWeather: cold preset produces aux_mult=1.5", () => {
  const w = applyWeather(ecascadia, { weather_preset: "cold", payload_lbs: 0, port_drayage_enabled: false });
  assert.equal(w.aux_mult, 1.5);
  assert.equal(w.thermal_factor, 0.92);
  assert.equal(w.temp_c, 0);
});

test("applyWeather: hot preset produces thermal_factor=0.94", () => {
  const w = applyWeather(ecascadia, { weather_preset: "hot", payload_lbs: 0, port_drayage_enabled: false });
  assert.equal(w.thermal_factor, 0.94);
  assert.equal(w.aux_mult, 1.15);
});

test("WEATHER_PRESETS: 4 presets", () => {
  assert.equal(Object.keys(WEATHER_PRESETS).sort().join(","), "cold,headwind,hot,ideal");
});

test("computeInputsHash: test vector matches expected hash", () => {
  const h = computeInputsHash(TEST_VECTOR_SCENARIO, PHYSICS_VERSION, "afdc-static-v1");
  assert.equal(h, TEST_VECTOR_EXPECTED_HASH);
});

test("computeInputsHash: deterministic for same input", () => {
  const h1 = computeInputsHash({ a: 1.0000001, b: 2 }, "v1", "v2");
  const h2 = computeInputsHash({ b: 2, a: 1.0000004 }, "v1", "v2");
  // round to 1e6 -> both become 1.0
  assert.equal(h1, h2);
});

test("validateOverrideBounds: throws when value > 1.2*oem_default", () => {
  assert.throws(
    () => validateOverrideBounds("C_rr", 0.012, 0.0065),
    OverrideBoundsError,
  );
});

test("validateOverrideBounds: accepts value within ±20%", () => {
  assert.doesNotThrow(() => validateOverrideBounds("C_rr", 0.0075, 0.0065));
});

test("applyTruckOverrides: reset_to_oem uses oem defaults", () => {
  const oem = { C_rr: 0.0065, drag_coefficient: 0.65, usable_kwh: 438, aux_kw_base: 10, regen_efficiency: 0.70 };
  const result = applyTruckOverrides(ecascadia, { reset_to_oem: true }, oem, {});
  assert.equal(result.truck.C_rr, 0.0065);
  assert.equal(result.assumptions.length, 5);
  assert.equal(result.assumptions[0].source, "oem_default");
});

test("applyTruckOverrides: user override applied and validated", () => {
  const oem = { C_rr: 0.0065, drag_coefficient: 0.65, usable_kwh: 438, aux_kw_base: 10, regen_efficiency: 0.70 };
  const result = applyTruckOverrides(
    ecascadia,
    { C_rr: 0.007 },
    oem,
    {},
  );
  assert.equal(result.truck.C_rr, 0.007);
  const crrAssumption = result.assumptions.find((a) => a.field === "C_rr");
  assert.equal(crrAssumption?.source, "user_override");
});

test("resolveSpeeds: empty edge_speeds falls back to DEFAULT_POSTED_MPH", () => {
  const segs = buildSegments(100 * 1609.344, [[-118, 34], [-117, 34]], [
    { dist_m: 0, elev_m: 100 },
    { dist_m: 100 * 1609.344, elev_m: 100 },
  ]);
  const speeds = resolveSpeeds(segs, [], defaultTruckSpeedParams());
  assert.ok(speeds.every((s) => s > 0));
  // All should be <= top_speed
  assert.ok(speeds.every((s) => s <= DEFAULT_TRUCK_TOP_SPEED_MPH + 0.01));
});

test("postedSpeedForSegment: weighted average from overlapping edges", () => {
  const edges: EdgeSpeed[] = [
    { start_m: 0, edge_length_m: 16093, speed_limit_mph: 65 },
    { start_m: 16093, edge_length_m: 16093, speed_limit_mph: 55 },
  ];
  const speed = postedSpeedForSegment(0, 32186, edges);
  assert.ok(Math.abs(speed - 60) < 0.01, `speed=${speed}`);
});

test("haversineM: known distance ~111km per degree lat", () => {
  const d = haversineM(0, 0, 1, 0);
  assert.ok(Math.abs(d - 111195) < 500, `d=${d}`);
});

test("massKg: correct conversion", () => {
  const m = massKg(ecascadia);
  assert.ok(Math.abs(m - (26000 + 34000) * LBS_TO_KG) < 0.01);
});

test("interpolateElev: linear interpolation", () => {
  const profile: ElevationPoint[] = [
    { dist_m: 0, elev_m: 100 },
    { dist_m: 1000, elev_m: 200 },
  ];
  const e = interpolateElev(profile, 500);
  assert.ok(Math.abs(e - 150) < 0.01, `e=${e}`);
});

test("gradeBetween: 100m elevation over 1000m = 10%", () => {
  const profile: ElevationPoint[] = [
    { dist_m: 0, elev_m: 100 },
    { dist_m: 1000, elev_m: 200 },
  ];
  const g = gradeBetween(profile, 0, 1000);
  assert.ok(Math.abs(g - 10) < 0.01, `g=${g}`);
});

test("interpolatePointAtDist: midpoint of 2-point line", () => {
  const coords = [[-118, 34], [-117, 34]];
  // Find the total distance first
  const total = haversineM(34, -118, 34, -117);
  const [lon, lat] = interpolatePointAtDist(coords, total / 2);
  assert.ok(Math.abs(lon - (-117.5)) < 0.01, `lon=${lon}`);
  assert.ok(Math.abs(lat - 34) < 0.01, `lat=${lat}`);
});
