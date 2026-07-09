// Load Major Traffic Generators into Convex.
//
//   python3 data/ingest/caltrans/prep_traffic_generators.py
//   node scripts/generators_load.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const WEB = resolve(REPO, "apps/web");
const PREP = resolve(REPO, "data/ingest/caltrans/prep_traffic_generators.py");
const OUT = resolve(REPO, "data/ingest/caltrans/out/traffic_generators.json");

if (!existsSync(OUT)) {
  console.log("Prepping generators…");
  execFileSync("python3", [PREP], { stdio: "inherit", cwd: REPO });
}

const parsed = JSON.parse(readFileSync(OUT, "utf8"));
const rows = parsed.rows ?? [];
if (rows.length === 0) {
  console.error("No rows in", OUT);
  process.exit(1);
}

const arg = JSON.stringify({ rows, fetchedAt: Date.now() });
console.log(`Running generators/ingest:run with ${rows.length} rows…`);
execFileSync("npx", ["convex", "run", "generators/ingest:run", arg], {
  cwd: WEB,
  encoding: "utf8",
  stdio: "inherit",
  maxBuffer: 64 * 1024 * 1024,
  env: process.env,
});
console.log("Done.");
