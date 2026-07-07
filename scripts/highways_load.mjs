// Highway-segment ingest loader/driver (P12-06) — reads the prepped CalTrans
// Truck-AADT rows (data/ingest/caltrans/out/caltrans_segments.json, produced by
// data/ingest/caltrans/prep_truck_aadt.py) and drives the deployed Convex action
// `highways/ingest:run` against the dev deployment (sensible-oriole-832),
// chunking rows so every `npx convex run` arg stays well under the 5MiB limit.
//
// It ALSO regenerates the corridor-region parity fixture
// (apps/web/convex/fixtures/postgis-corridor.json) — the set of segmentIds whose
// bbox overlaps the POLB->San Bernardino corridor bbox — computed independently
// here in plain JS from the SAME CalTrans source the ingest loads.
//
// SOURCE-MISMATCH NOTE (honest, per plan T-12-06d): the docker PostGIS instance
// does NOT hold a CalTrans highwaySegments/AADT table (it has chargers +
// nhfn_network only), so a literal PostGIS ST_Extent ground truth for CalTrans
// segments does not exist. Rather than fabricate one, the parity gate is
// asserted against the SAME-SOURCE ground truth: the corridor membership is
// derived by an INDEPENDENT bbox computation (this loader) over the raw prepped
// rows, and the test asserts Convex segmentsInBbox returns the identical
// segmentId set. The independent JS bbox math here stands in for the ST_&&
// bbox predicate; the source note is documented, not papered over.
//
// Finally it prints the top-N most-congested segments (by 5-axle truckAADT) so
// the flagship "most congested freight route" can be checked against the data.
//
// Usage (from repo root or apps/web):
//   node scripts/highways_load.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const WEB = resolve(REPO, "apps/web");
const SEGMENTS = resolve(REPO, "data/ingest/caltrans/out/caltrans_segments.json");
const FIXTURE_DIR = resolve(WEB, "convex/fixtures");
const FIXTURE = resolve(FIXTURE_DIR, "postgis-corridor.json");

// POLB -> San Bernardino corridor bbox (I-710/I-10/I-110 gateway). Derived from
// the POLB origin (~33.75,-118.22) and San Bernardino dest (~34.11,-117.29)
// plus margin. Same box the queries.test.ts parity gate uses.
const CORRIDOR_BBOX = {
  minLat: 33.6,
  minLng: -118.3,
  maxLat: 34.2,
  maxLng: -117.2,
};

const ROWS_PER_CALL = 1500; // ~450KB/call JSON — comfortably under the 5MiB cap

if (!existsSync(resolve(WEB, "convex"))) {
  console.error(`Could not find apps/web/convex under ${WEB}`);
  process.exit(1);
}
if (!existsSync(SEGMENTS)) {
  console.error(
    `Missing ${SEGMENTS}\n  Run: .venv/bin/python data/ingest/caltrans/prep_truck_aadt.py`,
  );
  process.exit(1);
}

const rows = JSON.parse(readFileSync(SEGMENTS, "utf8"));
if (!Array.isArray(rows) || rows.length === 0) {
  console.error("caltrans_segments.json is empty — nothing to ingest.");
  process.exit(1);
}

// ── Independent corridor-region fixture (same-source ground truth) ────────────
function bboxesIntersect(a, b) {
  return !(
    a.maxLat < b.minLat ||
    a.minLat > b.maxLat ||
    a.maxLng < b.minLng ||
    a.minLng > b.maxLng
  );
}
const corridorIds = rows
  .filter((r) => r.bbox && bboxesIntersect(CORRIDOR_BBOX, r.bbox))
  .map((r) => r.segmentId)
  .sort();
mkdirSync(FIXTURE_DIR, { recursive: true });
writeFileSync(
  FIXTURE,
  JSON.stringify(
    {
      source: "CalTrans_Truck_AADT (same-source ground truth)",
      note:
        "PostGIS has no CalTrans highwaySegments table; corridor membership is " +
        "computed independently here by bbox-intersection over the raw prepped " +
        "rows (the ST_&&-bbox equivalent). Convex segmentsInBbox must match this set.",
      bbox: CORRIDOR_BBOX,
      segmentIds: corridorIds,
      count: corridorIds.length,
    },
    null,
    2,
  ),
);
console.log(
  `highways_load: wrote corridor fixture ${FIXTURE} (${corridorIds.length} segmentIds in POLB->SB bbox)`,
);

// ── Top-N most-congested segments (by 5-axle truckAADT) ───────────────────────
const topSegments = [...rows]
  .filter((r) => typeof r.truckAADT === "number")
  .sort((a, b) => b.truckAADT - a.truckAADT)
  .slice(0, 10);

// Aggregate by route to preview the flagship mostCongestedRoute answer.
const byRoute = new Map();
for (const r of rows) {
  if (typeof r.truckAADT !== "number") continue;
  const cur = byRoute.get(r.route) ?? { sum: 0, max: 0, count: 0 };
  cur.sum += r.truckAADT;
  cur.max = Math.max(cur.max, r.truckAADT);
  cur.count += 1;
  byRoute.set(r.route, cur);
}
const topRoutes = [...byRoute.entries()]
  .map(([route, s]) => ({ route, ...s }))
  .sort((a, b) => b.sum - a.sum)
  .slice(0, 8);

console.log(`highways_load: ${rows.length} segments, ingesting in chunks of ${ROWS_PER_CALL} via highways/ingest:run ...`);

// ── Chunk + drive the action. Share ONE fetchedAt across all chunks. ──────────
const fetchedAt = Date.now();
let received = 0;
let inserted = 0;
let patched = 0;
let withTruck = 0;
let ingestOk = true;
for (let i = 0; i < rows.length; i += ROWS_PER_CALL) {
  const batch = rows.slice(i, i + ROWS_PER_CALL);
  const arg = JSON.stringify({ rows: batch, fetchedAt });
  let out;
  try {
    out = execFileSync("npx", ["convex", "run", "highways/ingest:run", arg], {
      cwd: WEB,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    console.error(`highways/ingest:run failed on chunk @${i}:`, err.message);
    ingestOk = false;
    break;
  }
  const match = out.match(/\{[\s\S]*\}/);
  if (match) {
    const r = JSON.parse(match[0]);
    received += r.received ?? 0;
    inserted += r.inserted ?? 0;
    patched += r.patched ?? 0;
    withTruck += r.withTruck ?? 0;
  }
  console.log(`  chunk @${i}: +${batch.length} (running total received=${received})`);
}

console.log("\n---- highways_load DONE ----");
if (ingestOk) {
  console.log(
    `received=${received} inserted=${inserted} patched=${patched} withTruck=${withTruck}`,
  );
} else {
  console.log("INGEST_DEFERRED_FLAG — the Convex action did not complete; see error above.");
}
console.log("\ntop-8 routes by aggregate 5-axle truckAADT (flagship mostCongestedRoute preview):");
for (const r of topRoutes) {
  console.log(
    `  RTE ${String(r.route).padStart(4)}  sumTruckAADT=${r.sum}  maxSeg=${r.max}  segs=${r.count}`,
  );
}
console.log("\ntop-10 individual most-congested segments (by 5-axle truckAADT):");
for (const s of topSegments) {
  console.log(
    `  ${s.segmentId}  RTE ${s.route}  truckAADT(5-axle)=${s.truckAADT}  aadt(total-truck)=${s.aadt ?? "n/a"}`,
  );
}
