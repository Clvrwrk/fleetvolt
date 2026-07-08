// NATD parking ingest loader/driver (P12-06 item 6) — reads the prepped NATD CA
// truck-stop parking rows (data/ingest/natd/out/natd_parking.json, produced by
// data/ingest/natd/prep_parking.py) and drives the deployed Convex action
// `parking/ingest:run` against the dev deployment (sensible-oriole-832),
// chunking rows so every `npx convex run` arg stays under the 5MiB limit.
//
// Usage (from repo root or apps/web):  node scripts/natd_load.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const WEB = resolve(REPO, "apps/web");
const PARKING = resolve(REPO, "data/ingest/natd/out/natd_parking.json");
const ROWS_PER_CALL = 2000; // small dataset (~83 CA rows) — one call in practice

if (!existsSync(WEB)) {
  console.error(`Could not find apps/web under ${WEB}`);
  process.exit(1);
}
if (!existsSync(PARKING)) {
  console.error(
    `Missing ${PARKING}\n  Run: env -i HOME="$HOME" PATH="/usr/bin:/bin" .venv/bin/python data/ingest/natd/prep_parking.py`,
  );
  process.exit(1);
}

const rows = JSON.parse(readFileSync(PARKING, "utf8"));
if (!Array.isArray(rows) || rows.length === 0) {
  console.error("natd_parking.json is empty — nothing to ingest.");
  process.exit(1);
}

console.log(`natd_load: ${rows.length} parking rows, ingesting via parking/ingest:run ...`);

const fetchedAt = Date.now();
let received = 0;
let inserted = 0;
let patched = 0;
let withSpots = 0;
let ok = true;
for (let i = 0; i < rows.length; i += ROWS_PER_CALL) {
  const batch = rows.slice(i, i + ROWS_PER_CALL);
  const arg = JSON.stringify({ rows: batch, fetchedAt });
  let out;
  try {
    out = execFileSync("npx", ["convex", "run", "parking/ingest:run", arg], {
      cwd: WEB,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    console.error(`parking/ingest:run failed on chunk @${i}:`, err.message);
    ok = false;
    break;
  }
  const match = out.match(/\{[\s\S]*\}/);
  if (match) {
    const r = JSON.parse(match[0]);
    received += r.received ?? 0;
    inserted += r.inserted ?? 0;
    patched += r.patched ?? 0;
    withSpots += r.withSpots ?? 0;
  }
}

console.log("\n---- natd_load DONE ----");
if (ok) {
  console.log(`received=${received} inserted=${inserted} patched=${patched} withSpots=${withSpots}`);
} else {
  console.log("NATD_DEFERRED — the Convex action did not complete; see error above.");
}
