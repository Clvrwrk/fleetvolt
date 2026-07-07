// FAF ingest loader (P12-03) — reads the prepped JSON and drives the deployed
// Convex actions. This is the documented invocation path:
//
//   1. python data/ingest/faf/prep_faf_zone061.py lookups
//   2. python data/ingest/faf/prep_faf_zone061.py filter
//   3. node scripts/faf_load.mjs
//
// The actuals JSON (~105k rows / ~13MB) exceeds a Convex action's 5MiB arg cap,
// so we SUPER-CHUNK it here (~2000 rows/call ≈ well under 5MiB) and call
// faf/ingestActuals:run once per super-chunk; the action sub-chunks to 500/row
// mutations internally. Lookups (~190 rows) go in one faf/lookups:seed call.
// One fetchedAt is stamped here and threaded through — idempotent per run.
//
// usefulnessScore (data-review-gate rubric OUTPUT on the FAF bytes, DINT-03 —
// NOT a catalog guess):
//   identity/keys present (dms_orig/dest/mode/sctg2)      +2
//   location joinable (FAF zone → crosswalk state/CFS)    +1
//   temporal depth (7 actual years 2018-2024)             +2
//   measured (not modeled/estimate) public federal source +2
//   full provenance + units explicit (ktons / M-USD)      +1
//   completeness (all modes+commodities, no nulls in key) +1
//   = 9/10  (docked 1: single-origin cut, no sub-annual granularity)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// this file lives at apps/web/scripts/ -> repo root is three levels up
const REPO = resolve(__dirname, "..", "..", "..");
const OUT = resolve(REPO, "data/ingest/faf/out");

const USEFULNESS_SCORE = 9;
const SUPER_CHUNK = 2000;

function loadEnv() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (url) return url;
  // Fallback: parse apps/web/.env.local
  const env = readFileSync(resolve(REPO, "apps/web/.env.local"), "utf8");
  const m = env.match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m);
  if (!m) throw new Error("NEXT_PUBLIC_CONVEX_URL not found");
  return m[1].trim();
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const client = new ConvexHttpClient(loadEnv());
  const fetchedAt = Date.now();

  const lookups = JSON.parse(readFileSync(resolve(OUT, "faf_lookups.json"), "utf8"));
  const rows = JSON.parse(readFileSync(resolve(OUT, "faf_zone061.json"), "utf8"));

  console.log(
    `loader: ${lookups.zones.length} zones, ${lookups.modes.length} modes, ` +
      `${lookups.commodities.length} commodities, ${rows.length} OD rows`,
  );

  const lkRes = await client.action(api.faf.lookups.seed, {
    zones: lookups.zones,
    modes: lookups.modes,
    commodities: lookups.commodities,
    fetchedAt,
    usefulnessScore: USEFULNESS_SCORE,
  });
  console.log("lookups seeded:", lkRes);

  let inserted = 0;
  let patched = 0;
  const superChunks = chunk(rows, SUPER_CHUNK);
  for (let i = 0; i < superChunks.length; i++) {
    const res = await client.action(api.faf.ingestActuals.run, {
      rows: superChunks[i],
      fetchedAt,
      usefulnessScore: USEFULNESS_SCORE,
    });
    inserted += res.inserted;
    patched += res.patched;
    if (i % 10 === 0 || i === superChunks.length - 1) {
      console.log(`  super-chunk ${i + 1}/${superChunks.length} done`);
    }
  }
  console.log(`freightOD ingest: inserted=${inserted} patched=${patched} total=${rows.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
