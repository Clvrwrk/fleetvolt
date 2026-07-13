import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PREP = resolve("data/ingest/census/prep_ca_air_districts.py");
const SOURCE = resolve("data/ingest/census/out/ca_air_districts.json");
const WEB = resolve("apps/web");
execFileSync(
  "uv",
  ["run", "--with", "shapely", "--with", "pyshp", "python", PREP],
  { stdio: "inherit" },
);
const rows = JSON.parse(readFileSync(SOURCE, "utf8"));

if (rows.length === 0) throw new Error("No air-district polygons were prepared.");

const output = execFileSync(
  "pnpm",
  [
    "exec",
    "convex",
    "run",
    "geo/ingestAirDistrictGeometry:ingest",
    JSON.stringify({ rows, fetchedAt: Date.now() }),
  ],
  { cwd: WEB, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);
console.log(`Prepared ${rows.length} topology-safe CARB districts.`);
console.log(output.trim());
