// OSM POI ingest loader/driver (P12-14) — reads the prepped OSM-extracted POIs
// (data/ingest/osm/out/osm_pois.json, produced by data/ingest/osm/extract_pois.py
// from a streaming pyosmium pass over california-latest.osm.pbf) and drives the
// deployed Convex action `pois/ingest:run` against the dev deployment
// (sensible-oriole-832), chunking rows so every `npx convex run` arg stays under
// the 5MiB limit. Prints per-type counts.
//
// Usage (from repo root or apps/web):  node scripts/pois_load.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const WEB = resolve(REPO, "apps/web");
const POIS = resolve(REPO, "data/ingest/osm/out/osm_pois.json");
const ROWS_PER_CALL = 4000; // ~1MB/call JSON — comfortably under the 5MiB cap

if (!existsSync(WEB)) {
  console.error(`Could not find apps/web under ${WEB}`);
  process.exit(1);
}
if (!existsSync(POIS)) {
  console.error(
    `Missing ${POIS}\n  Run: env -i HOME="$HOME" PATH="/usr/bin:/bin" .venv/bin/python data/ingest/osm/extract_pois.py`,
  );
  console.log("POIS_DEFERRED — no osm_pois.json; extraction not yet run.");
  process.exit(1);
}

const rows = JSON.parse(readFileSync(POIS, "utf8"));
if (!Array.isArray(rows) || rows.length === 0) {
  console.error("osm_pois.json is empty — nothing to ingest.");
  process.exit(1);
}

const srcByType = {};
for (const r of rows) srcByType[r.type] = (srcByType[r.type] ?? 0) + 1;
console.log(`pois_load: ${rows.length} POIs (source counts ${JSON.stringify(srcByType)}), ingesting in chunks of ${ROWS_PER_CALL} ...`);

const fetchedAt = Date.now();
let received = 0;
let inserted = 0;
let patched = 0;
let skippedUnclassified = 0;
const byType = {};
let ok = true;
for (let i = 0; i < rows.length; i += ROWS_PER_CALL) {
  const batch = rows.slice(i, i + ROWS_PER_CALL);
  const arg = JSON.stringify({ rows: batch, fetchedAt });
  let out;
  try {
    out = execFileSync("npx", ["convex", "run", "pois/ingest:run", arg], {
      cwd: WEB,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    console.error(`pois/ingest:run failed on chunk @${i}:`, err.message);
    ok = false;
    break;
  }
  const match = out.match(/\{[\s\S]*\}/);
  if (match) {
    const r = JSON.parse(match[0]);
    received += r.received ?? 0;
    inserted += r.inserted ?? 0;
    patched += r.patched ?? 0;
    skippedUnclassified += r.skippedUnclassified ?? 0;
    for (const [k, n] of Object.entries(r.byType ?? {})) byType[k] = (byType[k] ?? 0) + n;
  }
  console.log(`  chunk @${i}: +${batch.length} (running received=${received})`);
}

console.log("\n---- pois_load DONE ----");
if (ok) {
  console.log(`received=${received} inserted=${inserted} patched=${patched} skippedUnclassified=${skippedUnclassified}`);
  console.log(`byType=${JSON.stringify(byType)}`);
} else {
  console.log("POIS_DEFERRED — the Convex action did not complete; see error above.");
}
