// P12-08 Task 5 — REPORT PAYLOAD SHAPE TEST.
// Asserts hotspotReport returns all 6 sections (carriers/parking/pois/chargers/
// score/freightContext) with correct shapes, the score honesty guard
// (method==="modeled" + 4 inputs), chargers.class8WithinRadius === LIVE (3 NOT 0),
// parking.totalSpots is a number, and pois are grouped by type.
//
// Talks to LIVE dev deployment (sensible-oriole-832) via ConvexHttpClient.
// SKIPS LOUDLY (never vacuously green) if the deployment/ingest is absent.
//
// Run: node --import tsx --test convex/report.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "./_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const POLB = { lat: 33.754, lng: -118.216 };
// 3000m — not the flagship 8047m (5mi). At 5mi the report query reads >32K docs
// (Convex per-function limit) across carriers+parking+pois+chargers+hotspots+
// freightOD. 3000m stays under the limit while still covering the POLB origin
// and WattEV Pier A (the nearest live Class-8 charger at ~2.6km). The full
// corridor count of 3 is asserted in flagship.test.ts via class8Gap.
const RADIUS_M = 3000;

function convexUrl(): string | null {
  if (process.env.NEXT_PUBLIC_CONVEX_URL) return process.env.NEXT_PUBLIC_CONVEX_URL;
  const envPath = resolve(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) return null;
  const m = readFileSync(envPath, "utf8").match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m);
  return m ? m[1].trim() : null;
}

interface ReportPayload {
  location: { lat: number; lng: number };
  radiusM: number;
  carriers: unknown[];
  parking: { count: number; totalSpots: number; parking: unknown[] };
  pois: { total: number; byType: Record<string, number>; pois: unknown[] };
  chargers: {
    fiveClosest: unknown[];
    class8WithinRadius: number;
    closestClass8DistanceM: number | null;
    class8Chargers: unknown[];
  };
  score: {
    score: number;
    method: string;
    inputs: string[];
    components: unknown;
    source: string;
    hotspotId: string | null;
    title: string | null;
  } | null;
  freightContext: {
    origin: string;
    year: number;
    rowCount: number;
    totalKtons: number;
    totalValueUSD: number;
    truckKtons: number;
    truckValueUSD: number;
  };
  whatsMissing: {
    mobileEnergyOpportunity: boolean;
    opportunityThreshold: number;
    noClass8Charging: boolean;
    noParkingCapacity: boolean;
    noCarriersInRadius: boolean;
    deferredToPhase13: {
      detourCost: string;
      environmentalBenefit: string;
    };
  };
}

interface Boot {
  bootErr: string | null;
  report: ReportPayload | null;
}

let _bootPromise: Promise<Boot> | null = null;
function boot(): Promise<Boot> {
  if (_bootPromise) return _bootPromise;
  _bootPromise = (async (): Promise<Boot> => {
    const out: Boot = { bootErr: null, report: null };
    const url = convexUrl();
    if (!url) {
      out.bootErr = "NEXT_PUBLIC_CONVEX_URL absent (checked env + apps/web/.env.local)";
      return out;
    }
    try {
      const client = new ConvexHttpClient(url);
      const report = (await client.query(api.report.hotspotReport, {
        lat: POLB.lat,
        lng: POLB.lng,
        radiusM: RADIUS_M,
      })) as ReportPayload;
      out.report = report;
      if (!report) {
        out.bootErr = "hotspotReport returned null/undefined";
      }
    } catch (e) {
      out.bootErr = `Convex deployment unreachable: ${(e as Error).message}`;
    }
    return out;
  })();
  return _bootPromise;
}

function liveTest(name: string, fn: (b: Boot) => void | Promise<void>) {
  test(name, async () => {
    const b = await boot();
    if (b.bootErr) {
      throw new Error(
        `LIVE REPORT UNAVAILABLE — refusing to pass vacuously: ${b.bootErr}. ` +
          "Bring the dev deployment + live ingest up, then re-run.",
      );
    }
    await fn(b);
  });
}

// ── 6 sections present with correct shapes ──────────────────────────────────────
liveTest("report: all 6 sections present (carriers/parking/pois/chargers/score/freightContext)", (b) => {
  const r = b.report!;
  assert.ok(Array.isArray(r.carriers), "carriers must be an array");
  assert.ok(r.parking && typeof r.parking === "object", "parking must be an object");
  assert.ok(r.pois && typeof r.pois === "object", "pois must be an object");
  assert.ok(r.chargers && typeof r.chargers === "object", "chargers must be an object");
  assert.ok(r.score !== null && typeof r.score === "object", "score must be non-null object");
  assert.ok(r.freightContext && typeof r.freightContext === "object", "freightContext must be an object");
});

// ── Score honesty guard: method==="modeled" + 4 inputs ──────────────────────────
liveTest("report: score.method===\"modeled\" + 4 inputs (honesty guard)", (b) => {
  const s = b.report!.score!;
  assert.equal(s.method, "modeled", "score.method must be 'modeled' — never 'observed'");
  assert.ok(Array.isArray(s.inputs), "score.inputs must be an array");
  assert.equal(s.inputs.length, 4, "score.inputs must list exactly 4 proxies");
  assert.ok(
    s.inputs.includes("NATD_parking_capacity"),
    "inputs must include NATD_parking_capacity",
  );
  assert.ok(
    s.inputs.includes("Caltrans_5axle_truckAADT"),
    "inputs must include Caltrans_5axle_truckAADT",
  );
  assert.ok(
    s.inputs.includes("FAF_zone061_flow"),
    "inputs must include FAF_zone061_flow",
  );
  assert.ok(
    s.inputs.includes("POLB_carrier_concentration"),
    "inputs must include POLB_carrier_concentration",
  );
  assert.ok(typeof s.score === "number" && s.score >= 0 && s.score <= 1, "score must be in [0,1]");
});

// ── chargers.class8WithinRadius matches LIVE (NOT 0) ───────────────────────────
liveTest("report: chargers.class8WithinRadius >= 1 (LIVE — gap closed, NOT 0)", (b) => {
  const c = b.report!.chargers;
  assert.ok(
    c.class8WithinRadius >= 1,
    "class8WithinRadius must be >= 1 at POLB 3km — the flagship gap has closed (WattEV Pier A ~2.6km)",
  );
  assert.notEqual(c.class8WithinRadius, 0, "must NOT be 0 — live HD chargers exist on corridor");
  // non-inflation: count must equal surfaced list length
  assert.equal(
    c.class8WithinRadius,
    c.class8Chargers.length,
    "class8WithinRadius count must equal class8Chargers list length",
  );
  // each surfaced Class-8 charger must truly be ≥350kW AND MD/HD
  for (const charger of c.class8Chargers as Array<Record<string, unknown>>) {
    assert.ok(
      (charger.powerKw as number) >= 350,
      `${charger.stationId}: powerKw ${charger.powerKw} < 350 (inflation)`,
    );
    const mvc = charger.maxVehicleClass;
    assert.ok(
      mvc === "MD" || mvc === "HD",
      `${charger.stationId}: maxVehicleClass=${mvc} (not MD/HD — inflation)`,
    );
  }
  console.log(
    `[REPORT] chargers.class8WithinRadius=${c.class8WithinRadius} at POLB 3km ` +
      `(closest ${c.closestClass8DistanceM ?? "n/a"}m) — NOT 0. ` +
      `Full corridor count of 3 asserted in flagship.test.ts.`,
  );
});

// ── parking.totalSpots is a number ───────────────────────────────────────────────
liveTest("report: parking.totalSpots is a number", (b) => {
  const p = b.report!.parking;
  assert.equal(typeof p.totalSpots, "number", "parking.totalSpots must be a number");
  assert.ok(p.totalSpots >= 0, "parking.totalSpots must be non-negative");
  assert.equal(typeof p.count, "number", "parking.count must be a number");
});

// ── pois grouped by type ────────────────────────────────────────────────────────
liveTest("report: pois grouped by type (byType record)", (b) => {
  const pois = b.report!.pois;
  assert.equal(typeof pois.total, "number", "pois.total must be a number");
  assert.ok(
    pois.byType && typeof pois.byType === "object" && !Array.isArray(pois.byType),
    "pois.byType must be a Record<string, number>",
  );
  // sum of byType values must equal total
  const sumByType = Object.values(pois.byType).reduce((a, b) => a + b, 0);
  assert.equal(sumByType, pois.total, "sum of byType values must equal pois.total");
});

// ── freightContext shape ────────────────────────────────────────────────────────
liveTest("report: freightContext has zone-061 outbound totals", (b) => {
  const f = b.report!.freightContext;
  assert.equal(f.origin, "061", "freightContext.origin must be port zone 061");
  assert.equal(typeof f.totalKtons, "number", "totalKtons must be a number");
  assert.equal(typeof f.truckKtons, "number", "truckKtons must be a number");
  assert.ok(f.rowCount > 0, "freightContext must have at least one freightOD row");
});

// ── whatsMissing deferredToPhase13 ──────────────────────────────────────────────
liveTest("report: whatsMissing.deferredToPhase13 marks detour cost + env benefit as external", (b) => {
  const w = b.report!.whatsMissing;
  assert.ok(w.deferredToPhase13, "deferredToPhase13 must be present");
  assert.ok(
    typeof w.deferredToPhase13.detourCost === "string" &&
      w.deferredToPhase13.detourCost.includes("Phase-13"),
    "detourCost must be deferred to Phase-13 (not computed here)",
  );
  assert.ok(
    typeof w.deferredToPhase13.environmentalBenefit === "string" &&
      w.deferredToPhase13.environmentalBenefit.includes("Phase-13"),
    "environmentalBenefit must be deferred to Phase-13 (not computed here)",
  );
});
