// Charger ingest loader/driver (P12-07) — thin wrapper that invokes the
// deployed Convex action `chargers/ingest:run` against the dev deployment
// (sensible-oriole-832) and prints the ingested total + Class-8 count.
//
// The heavy lifting (LIVE AFDC fetch from developer.nlr.gov, classify, chunk,
// spatial-index) all happens inside the Convex action — this script only
// triggers it and surfaces the honest counts. NLR_API_KEY must be set in the
// Convex deployment env (npx convex env set NLR_API_KEY <value>); it is read by
// the action via process.env and NEVER passed through this loader or logged.
//
// Usage (from apps/web, where the convex CLI is wired):
//   node ../../scripts/chargers_load.mjs
//   node scripts/chargers_load.mjs        (if run from repo root, cd handled below)
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// scripts/ -> repo root is one level up; the convex CLI runs from apps/web.
const REPO = resolve(__dirname, "..");
const WEB = resolve(REPO, "apps/web");

if (!existsSync(resolve(WEB, "convex"))) {
  console.error(`Could not find apps/web/convex under ${WEB}`);
  process.exit(1);
}

console.log("chargers_load: invoking Convex action chargers/ingest:run ...");
console.log("  (LIVE AFDC fetch from developer.nlr.gov happens inside the action)");

let out;
try {
  out = execFileSync(
    "npx",
    ["convex", "run", "chargers/ingest:run", "{}"],
    { cwd: WEB, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
} catch (err) {
  console.error("chargers/ingest:run failed:", err.message);
  process.exit(1);
}

console.log(out.trim());

// The action returns a JSON object; parse the last JSON-looking line to print a
// clean summary line for the SUMMARY / logs.
try {
  const match = out.match(/\{[\s\S]*\}/);
  if (match) {
    const r = JSON.parse(match[0]);
    console.log(
      `chargers_load DONE: fetched=${r.totalFetched} ingested=${r.ingested} ` +
        `class8Capable=${r.class8Capable} inserted=${r.inserted} patched=${r.patched} ` +
        `skippedNoCoords=${r.skippedNoCoords}`,
    );
  }
} catch {
  // non-fatal: the raw action output above already carries the result
}
