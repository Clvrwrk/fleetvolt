// Carrier ingest loader/driver (P12-09) — reads the locally-geocoded carrier
// rows (data/ingest/carriers/out/carriers_geocoded.json, produced by
// prep_polb_carriers.py + geocode.py) and drives the deployed Convex action
// `carriers/ingest:run` against the dev deployment (sensible-oriole-832),
// chunking rows so every `npx convex run` arg stays well under the 5MiB limit.
//
// It then prints the honest flagship parity numbers: total ingested, geocoded%,
// and the corridor-city cluster counts (Long Beach ~127, Wilmington ~74, …) so
// the P12-10c "companies to target" ranking can be checked against
// FLAGSHIP-QUERY-VERIFIED.md. Cluster counts are computed from the same city
// text the ingest tags with, so they hold even when geocoding is deferred.
//
// Usage (from apps/web, where the convex CLI is wired):
//   node ../../scripts/carriers_load.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const WEB = resolve(REPO, "apps/web");
const GEOCODED = resolve(
  REPO,
  "data/ingest/carriers/out/carriers_geocoded.json",
);

// Canonical corridor-city cluster names (mirror of convex/carriers/corridorCity.ts;
// kept inline so the loader has no Convex import). Used only for the parity print.
const CORRIDOR_CITIES = [
  "Long Beach",
  "Wilmington",
  "Carson",
  "Gardena",
  "Compton",
  "Ontario",
  "City of Industry",
  "Chino",
  "San Bernardino",
  "Rancho Cucamonga",
  "Fontana",
  "Rialto",
];
const VARIANTS = new Map([
  ["long beach", "Long Beach"],
  ["wilmington", "Wilmington"],
  ["carson", "Carson"],
  ["gardena", "Gardena"],
  ["compton", "Compton"],
  ["ontario", "Ontario"],
  ["city of industry", "City of Industry"],
  ["industry", "City of Industry"],
  ["chino", "Chino"],
  ["san bernardino", "San Bernardino"],
  ["rancho cucamonga", "Rancho Cucamonga"],
  ["fontana", "Fontana"],
  ["rialto", "Rialto"],
]);
function normalizeCorridorCity(city) {
  if (city == null) return null;
  const key = String(city)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[,]?\s*ca\.?$/i, "")
    .replace(/[.]+$/g, "")
    .trim();
  if (!key) return null;
  return VARIANTS.get(key) ?? null;
}

const ROWS_PER_CALL = 500; // ~90KB/call JSON — comfortably under the 5MiB arg cap

if (!existsSync(resolve(WEB, "convex"))) {
  console.error(`Could not find apps/web/convex under ${WEB}`);
  process.exit(1);
}
if (!existsSync(GEOCODED)) {
  console.error(
    `Missing ${GEOCODED}\n  Run: .venv/bin/python data/ingest/carriers/prep_polb_carriers.py` +
      ` && .venv/bin/python data/ingest/carriers/geocode.py`,
  );
  process.exit(1);
}

const rows = JSON.parse(readFileSync(GEOCODED, "utf8"));
if (!Array.isArray(rows) || rows.length === 0) {
  console.error("carriers_geocoded.json is empty — nothing to ingest.");
  process.exit(1);
}

// Local honesty stats (independent of the deployment).
const okCount = rows.filter((r) => r.geocodeStatus === "OK").length;
const clusterCounts = Object.fromEntries(CORRIDOR_CITIES.map((c) => [c, 0]));
let inCorridorLocal = 0;
for (const r of rows) {
  const cc = normalizeCorridorCity(r.city);
  if (cc) {
    clusterCounts[cc] += 1;
    inCorridorLocal += 1;
  }
}

console.log(
  `carriers_load: ${rows.length} carriers, ${okCount} geocoded OK ` +
    `(${((100 * okCount) / rows.length).toFixed(1)}%), ` +
    `${inCorridorLocal} in-corridor (local city text).`,
);
console.log(`  ingesting in chunks of ${ROWS_PER_CALL} via carriers/ingest:run ...`);

// Chunk + drive the action. Share ONE fetchedAt across all chunks.
const fetchedAt = Date.now();
let received = 0;
let inserted = 0;
let patched = 0;
let located = 0;
let inCorridor = 0;
for (let i = 0; i < rows.length; i += ROWS_PER_CALL) {
  const batch = rows.slice(i, i + ROWS_PER_CALL);
  const arg = JSON.stringify({ rows: batch, fetchedAt });
  let out;
  try {
    out = execFileSync("npx", ["convex", "run", "carriers/ingest:run", arg], {
      cwd: WEB,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    console.error(`carriers/ingest:run failed on chunk @${i}:`, err.message);
    process.exit(1);
  }
  const match = out.match(/\{[\s\S]*\}/);
  if (match) {
    const r = JSON.parse(match[0]);
    received += r.received ?? 0;
    inserted += r.inserted ?? 0;
    patched += r.patched ?? 0;
    located += r.located ?? 0;
    inCorridor += r.inCorridor ?? 0;
  }
  console.log(`  chunk @${i}: +${batch.length} (running total received=${received})`);
}

console.log("\n---- carriers_load DONE (flagship parity check) ----");
console.log(
  `received=${received} inserted=${inserted} patched=${patched} ` +
    `located=${located} inCorridor=${inCorridor}`,
);
console.log(`geocoded OK: ${okCount}/${rows.length} (${((100 * okCount) / rows.length).toFixed(1)}%)`);
console.log("corridor-city clusters (vs flagship VERIFIED):");
const FLAGSHIP = {
  "Long Beach": 127,
  Wilmington: 74,
  Carson: 68,
  Gardena: 54,
  Compton: 52,
  Ontario: 49,
  "City of Industry": 39,
  Chino: 34,
};
for (const c of CORRIDOR_CITIES) {
  const flag = FLAGSHIP[c] != null ? ` (flagship ${FLAGSHIP[c]})` : "";
  console.log(`  ${String(clusterCounts[c]).padStart(4)}  ${c}${flag}`);
}
console.log(`totalInCorridor (12 canonical cities): ${inCorridorLocal} (flagship ~685 over the broader corridor)`);
