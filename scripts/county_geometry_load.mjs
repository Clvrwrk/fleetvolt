import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rows = JSON.parse(
  readFileSync(resolve("data/ingest/census/out/ca_counties.json"), "utf8"),
);
if (!Array.isArray(rows) || rows.length === 0) {
  throw new Error("No prepared California county geometry rows found.");
}
const output = execFileSync(
  "pnpm",
  [
    "exec",
    "convex",
    "run",
    "geo/ingestCountyGeometry:ingest",
    JSON.stringify({ rows, fetchedAt: Date.now() }),
  ],
  { cwd: resolve("apps/web"), encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);
console.log(`Prepared ${rows.length} authoritative California Geoportal county geometries.`);
console.log(output.trim());
