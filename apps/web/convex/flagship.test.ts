// P12-08 Task 6 — FLAGSHIP NORTH-STAR ACCEPTANCE TEST (POLB→San Bernardino).
//
// Asserts from the LIVE Convex deployment:
//  (a) Charger gap — class8Gap returns the LIVE count (3) + non-inflation soundness.
//      Prints [FLAGSHIP] reconciliation. NOT 0 (gap closed: WattEV Pier A 360kW,
//      WattEV SB 360kW, Greenlane 400kW).
//  (b) 5-closest+config — fiveClosest returns 5 stations each with
//      powerKw/maxVehicleClass/connectorTypes.
//  (c) Carrier clusters — carrierDensityByCorridorCity returns Long Beach as
//      top + totalInCorridor ~560 (NOT 685 — 12 canonical cities, clean partition).
//  (d) Most-congested-route — data-driven/truckAADT-ranked (route 5 = 3.08M),
//      NOT hardcoded.
//  (e) FAF freight context — zone-061 magnitude ~393k ktons / ~1.29T USD.
//  (f) DEFERRED — detour cost + environmental benefit NOT computed here, marked
//      Phase-13/external.
//
// Each sub-answer SKIPS LOUDLY (never vacuously green) if its layer is absent.
//
// Run: node --import tsx --test convex/flagship.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "./_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const POLB = { lat: 33.754, lng: -118.216 };
const RADIUS_M = 8047; // 5 mi — flagship detour radius
const CORRIDOR = [
  { lat: 33.754, lng: -118.216 },
  { lat: 33.83, lng: -118.1 },
  { lat: 33.9, lng: -117.9 },
  { lat: 34.0, lng: -117.6 },
  { lat: 34.108, lng: -117.29 },
];

function convexUrl(): string | null {
  if (process.env.NEXT_PUBLIC_CONVEX_URL) return process.env.NEXT_PUBLIC_CONVEX_URL;
  const envPath = resolve(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) return null;
  const m = readFileSync(envPath, "utf8").match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m);
  return m ? m[1].trim() : null;
}

interface ConfigRow {
  stationId: string;
  name: string | null;
  powerKw: number;
  maxVehicleClass: "LD" | "MD" | "HD" | null;
  connectorTypes: string[];
  isClass8Capable: boolean;
  distanceM: number;
}
interface GapResult {
  class8WithinCorridor: number;
  closestClass8DistanceM: number | null;
  class8Chargers: ConfigRow[];
  fiveClosestAnyClass: ConfigRow[];
}
interface CarrierClusters {
  clusters: { corridorCity: string; count: number }[];
  totalInCorridor: number;
}
interface CongestedRoute {
  route: string;
  sumTruckAADT: number;
  maxTruckAADT: number;
  segmentCount: number;
}
interface FreightContext {
  origin: string;
  year: number;
  rowCount: number;
  totalKtons: number;
  totalValueUSD: number;
  truckKtons: number;
  truckValueUSD: number;
}
interface ReportPayload {
  whatsMissing: {
    mobileEnergyOpportunity: boolean;
    deferredToPhase13: { detourCost: string; environmentalBenefit: string };
  };
}

// ── Boot: fetch each layer independently so a missing layer skips ONLY itself ──
interface Boot {
  client: ConvexHttpClient | null;
  urlErr: string | null;
  gap: { data: GapResult | null; err: string | null };
  fiveClosest: { data: ConfigRow[] | null; err: string | null };
  carrierDensity: { data: CarrierClusters | null; err: string | null };
  congested: { data: CongestedRoute[] | null; err: string | null };
  freight: { data: FreightContext | null; err: string | null };
  report: { data: ReportPayload | null; err: string | null };
}

let _bootPromise: Promise<Boot> | null = null;
function boot(): Promise<Boot> {
  if (_bootPromise) return _bootPromise;
  _bootPromise = (async (): Promise<Boot> => {
    const out: Boot = {
      client: null,
      urlErr: null,
      gap: { data: null, err: null },
      fiveClosest: { data: null, err: null },
      carrierDensity: { data: null, err: null },
      congested: { data: null, err: null },
      freight: { data: null, err: null },
      report: { data: null, err: null },
    };
    const url = convexUrl();
    if (!url) {
      out.urlErr = "NEXT_PUBLIC_CONVEX_URL absent";
      return out;
    }
    const client = new ConvexHttpClient(url);
    out.client = client;

    const layers: Array<[keyof Pick<Boot, "gap" | "fiveClosest" | "carrierDensity" | "congested" | "freight" | "report">, Promise<unknown>]> = [
      ["gap", client.query(api.chargers.queries.class8Gap, { corridorPoints: CORRIDOR, radiusM: RADIUS_M })],
      ["fiveClosest", client.query(api.chargers.queries.fiveClosest, { lat: POLB.lat, lng: POLB.lng, limit: 5 })],
      ["carrierDensity", client.query(api.carriers.queries.carrierDensityByCorridorCity, {})],
      ["congested", client.query(api.highways.queries.mostCongestedRoute, { limit: 5 })],
      ["freight", client.query(api.faf.queries.freightContext, { year: 2023 })],
    ];
    for (const [key, promise] of layers) {
      try {
        (out[key] as { data: unknown }).data = await promise;
      } catch (e) {
        (out[key] as { err: string }).err = (e as Error).message;
      }
    }
    // Fetch report at 3km (5mi exceeds Convex 32K doc limit). This is used for
    // the (f) deferred assertion — the same assertion is also verified in
    // report.test.ts at 3km.
    try {
      out.report.data = (await client.query(api.report.hotspotReport, {
        lat: POLB.lat, lng: POLB.lng, radiusM: 3000,
      })) as ReportPayload | null;
    } catch (e) {
      out.report.err = (e as Error).message;
    }
    return out;
  })();
  return _bootPromise;
}

// Loud-skip wrapper: if the deployment URL is absent, ALL tests fail loudly.
// Per-layer skips are handled inside each test.
async function ensureClient(): Promise<ConvexHttpClient> {
  const b = await boot();
  if (b.urlErr || !b.client) {
    throw new Error(
      `FLAGSHIP LIVE UNAVAILABLE — refusing to pass vacuously: ${b.urlErr}. ` +
        "Bring the dev deployment up, then re-run.",
    );
  }
  return b.client;
}

// ── (a) Charger gap: class8Gap returns LIVE count (3) + non-inflation ─────────────
test("(a) charger gap: class8WithinCorridor === 3 (LIVE, NOT 0) + non-inflation", async () => {
  await ensureClient();
  const b = await boot();
  if (b.gap.err || !b.gap.data) {
    throw new Error(
      `SKIP (a) charger gap — layer absent: ${b.gap.err ?? "null data"}. ` +
        "Run chargers/ingest:run first.",
    );
  }
  const gap = b.gap.data;
  assert.equal(
    gap.class8WithinCorridor,
    3,
    "class8WithinCorridor must be 3 (WattEV Pier A 360kW, WattEV SB 360kW, Greenlane 400kW)",
  );
  assert.notEqual(gap.class8WithinCorridor, 0, "FLAGSHIP gap has closed — must NOT be 0");
  // non-inflation: count === surfaced list length
  assert.equal(
    gap.class8WithinCorridor,
    gap.class8Chargers.length,
    "class8WithinCorridor count must equal surfaced list length",
  );
  // each surfaced charger must truly be ≥350kW AND MD/HD
  for (const c of gap.class8Chargers) {
    assert.ok(c.powerKw >= 350, `${c.stationId}: powerKw ${c.powerKw} < 350 (inflation)`);
    assert.ok(
      c.maxVehicleClass === "MD" || c.maxVehicleClass === "HD",
      `${c.stationId}: maxVehicleClass=${c.maxVehicleClass} (not MD/HD — inflation)`,
    );
    assert.equal(c.isClass8Capable, true, `${c.stationId} class8 flag inconsistent`);
  }
  const ids = gap.class8Chargers
    .map((c) => `${c.stationId}:${c.name ?? "?"}:${c.powerKw}kW`)
    .join(", ");
  console.log(
    `[FLAGSHIP] (a) class8WithinCorridor = ${gap.class8WithinCorridor} ` +
      `(closest ${gap.closestClass8DistanceM ?? "n/a"}m). ` +
      `FLAGSHIP-QUERY-VERIFIED.md (2026-07-07) recorded 0. ` +
      `Live Class-8: [${ids}]. STATUS: GREEN.`,
  );
});

// ── (b) 5-closest+config: fiveClosest returns 5 with full config ────────────────
test("(b) fiveClosest: 5 stations each with powerKw/maxVehicleClass/connectorTypes", async () => {
  await ensureClient();
  const b = await boot();
  if (b.fiveClosest.err || !b.fiveClosest.data) {
    throw new Error(
      `SKIP (b) fiveClosest — layer absent: ${b.fiveClosest.err ?? "null data"}. ` +
        "Run chargers/ingest:run first.",
    );
  }
  const rows = b.fiveClosest.data;
  assert.equal(rows.length, 5, "fiveClosest must return exactly 5 rows");
  for (const r of rows) {
    assert.ok(typeof r.powerKw === "number", `${r.stationId} missing powerKw`);
    // maxVehicleClass may be null for some AFDC entries — assert the field EXISTS
    assert.ok(
      r.maxVehicleClass === "LD" || r.maxVehicleClass === "MD" || r.maxVehicleClass === "HD" || r.maxVehicleClass === null,
      `${r.stationId}: maxVehicleClass must be LD/MD/HD/null, got ${r.maxVehicleClass}`,
    );
    assert.ok(Array.isArray(r.connectorTypes), `${r.stationId} missing connectorTypes`);
    assert.ok(typeof r.distanceM === "number", `${r.stationId} missing distanceM`);
  }
  // ascending by distance
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i].distanceM >= rows[i - 1].distanceM, "must be sorted ascending by distance");
  }
  console.log(
    `[FLAGSHIP] (b) fiveClosest returned ${rows.length} stations at POLB, ` +
      `distances ${rows.map((r) => `${r.distanceM.toFixed(0)}m`).join(", ")}. STATUS: GREEN.`,
  );
});

// ── (c) Carrier clusters: Long Beach top + totalInCorridor ~560 (NOT 685) ────────
test("(c) carrierDensity: Long Beach top + totalInCorridor ~560 (NOT 685)", async () => {
  await ensureClient();
  const b = await boot();
  if (b.carrierDensity.err || !b.carrierDensity.data) {
    throw new Error(
      `SKIP (c) carrier density — layer absent: ${b.carrierDensity.err ?? "null data"}. ` +
        "Run carriers/ingest:run first.",
    );
  }
  const cd = b.carrierDensity.data;
  assert.equal(
    cd.clusters[0].corridorCity,
    "Long Beach",
    "Long Beach must be the top corridor city cluster",
  );
  assert.ok(
    cd.clusters[0].count === 127,
    `Long Beach count must be 127, got ${cd.clusters[0].count}`,
  );
  // totalInCorridor ~560 (12 canonical cities, NOT 685)
  assert.ok(
    cd.totalInCorridor >= 550 && cd.totalInCorridor <= 570,
    `totalInCorridor must be ~560 (12 canonical cities), got ${cd.totalInCorridor} (NOT 685)`,
  );
  assert.notEqual(cd.totalInCorridor, 685, "must NOT be 685 — stale inflated count");
  console.log(
    `[FLAGSHIP] (c) carrierDensity top=${cd.clusters[0].corridorCity} (${cd.clusters[0].count}), ` +
      `totalInCorridor=${cd.totalInCorridor} (NOT 685). STATUS: GREEN.`,
  );
});

// ── (d) Most-congested-route: data-driven, route 5 = 3.08M (NOT hardcoded) ───────
test("(d) mostCongestedRoute: data-driven/truckAADT-ranked, route 5 top (~3.08M)", async () => {
  await ensureClient();
  const b = await boot();
  if (b.congested.err || !b.congested.data) {
    throw new Error(
      `SKIP (d) mostCongestedRoute — layer absent: ${b.congested.err ?? "null data"}. ` +
        "Run highways/ingest:run first.",
    );
  }
  const routes = b.congested.data;
  assert.ok(routes.length >= 1, "must return at least 1 ranked route");
  const top = routes[0];
  // route 5 is top by DATA, not a hardcoded constant
  assert.ok(
    top.route === "5" || top.route === "005" || top.route === "I-5",
    `top route must be I-5/route-5 (data-driven), got "${top.route}"`,
  );
  // sumTruckAADT ~3.08M (data-driven ranking on 5-axle truckAADT)
  assert.ok(
    top.sumTruckAADT >= 2_800_000 && top.sumTruckAADT <= 3_300_000,
    `route 5 sumTruckAADT must be ~3.08M, got ${top.sumTruckAADT}`,
  );
  // verify ranking is desc by sumTruckAADT (data-driven, NOT hardcoded)
  for (let i = 1; i < routes.length; i++) {
    assert.ok(
      routes[i].sumTruckAADT <= routes[i - 1].sumTruckAADT,
      "routes must be ranked descending by sumTruckAADT (data-driven)",
    );
  }
  assert.ok(top.segmentCount > 0, "route 5 must have >0 segments (data-driven, not constant)");
  console.log(
    `[FLAGSHIP] (d) mostCongestedRoute top=route ${top.route} ` +
      `sumTruckAADT=${(top.sumTruckAADT / 1e6).toFixed(2)}M (${top.segmentCount} segments, data-driven). STATUS: GREEN.`,
  );
});

// ── (e) FAF freight context: zone-061 ~393k ktons / ~1.29T USD ───────────────────
test("(e) FAF freight: zone-061 truckKtons ~393k / totalValueUSD ~1.29T", async () => {
  await ensureClient();
  const b = await boot();
  if (b.freight.err || !b.freight.data) {
    throw new Error(
      `SKIP (e) FAF freight context — layer absent: ${b.freight.err ?? "null data"}. ` +
        "Run faf/ingest:run first.",
    );
  }
  const f = b.freight.data;
  assert.equal(f.origin, "061", "origin must be port zone 061");
  assert.ok(f.rowCount > 0, "must have freightOD rows");
  // truckKtons ~393,438
  assert.ok(
    f.truckKtons >= 380_000 && f.truckKtons <= 410_000,
    `truckKtons must be ~393k, got ${f.truckKtons}`,
  );
  // totalValueUSD ~1,289,036 (millions => ~$1.29T)
  assert.ok(
    f.totalValueUSD >= 1_200_000 && f.totalValueUSD <= 1_400_000,
    `totalValueUSD must be ~1.29M (millions), got ${f.totalValueUSD}`,
  );
  console.log(
    `[FLAGSHIP] (e) FAF zone-061 truckKtons=${(f.truckKtons / 1000).toFixed(0)}k ` +
      `totalValueUSD=~$${(f.totalValueUSD / 1e6).toFixed(2)}T. STATUS: GREEN.`,
  );
});

// ── (f) DEFERRED: detour cost + env benefit NOT computed here (Phase-13) ──────────
test("(f) DEFERRED: detour cost + environmental benefit marked Phase-13/external", async () => {
  await ensureClient();
  const b = await boot();
  if (b.report.err || !b.report.data) {
    // report layer may fail at 5mi (32K doc limit) — assert via report.test.ts instead.
    // Still SKIP loudly, not vacuous green:
    throw new Error(
      `SKIP (f) deferred — report layer absent: ${b.report.err ?? "null data"}. ` +
        "Verified in report.test.ts at 3km radius. NOT computed in Convex (Phase-13 external).",
    );
  }
  const w = b.report.data.whatsMissing;
  assert.ok(w.deferredToPhase13, "deferredToPhase13 must be present");
  assert.ok(
    typeof w.deferredToPhase13.detourCost === "string" &&
      w.deferredToPhase13.detourCost.includes("Phase-13"),
    "detourCost must be deferred to Phase-13 (NOT computed in Convex)",
  );
  assert.ok(
    typeof w.deferredToPhase13.environmentalBenefit === "string" &&
      w.deferredToPhase13.environmentalBenefit.includes("Phase-13"),
    "environmentalBenefit must be deferred to Phase-13 (NOT computed in Convex)",
  );
  console.log(
    `[FLAGSHIP] (f) DEFERRED — detour cost + env benefit marked Phase-13/external. STATUS: GREEN.`,
  );
});
