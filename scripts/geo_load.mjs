// Geo ingest + rollup driver (P12-13) — reads data/ingest/census/out/geo_regions.json
// (produced by prep_geo_regions.py), drives geo/ingest:run to upsert the
// US -> State -> County rows into geoRegions, then runs geo/rollup:rollupScores to
// aggregate the modeled hotspot scores county -> state -> nation.
//
// Usage (from repo root or apps/web — convex CLI is wired in apps/web):
//   node scripts/geo_load.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const WEB = resolve(REPO, "apps/web");
const GEO_JSON = resolve(REPO, "data/ingest/census/out/geo_regions.json");

if (!existsSync(resolve(WEB, "convex"))) {
  console.error(`Could not find apps/web/convex under ${WEB}`);
  process.exit(1);
}
if (!existsSync(GEO_JSON)) {
  console.error(
    `Missing ${GEO_JSON}\n  Run: env -i HOME="$HOME" PATH="/usr/bin:/bin" ` +
      `CENSUS_DATA_API_KEY="$KEY" services/simulator/.venv/bin/python ` +
      `data/ingest/census/prep_geo_regions.py`,
  );
  process.exit(1);
}

const rows = JSON.parse(readFileSync(GEO_JSON, "utf8"));
if (!Array.isArray(rows) || rows.length === 0) {
  console.error("geo_regions.json is empty — nothing to ingest.");
  process.exit(1);
}

const counties = rows.filter((r) => r.level === "county");
const corridor = rows.filter((r) => ["06037", "06065", "06071"].includes(r.fips));
console.log(
  `geo_load: ${rows.length} regions (${counties.length} counties, ` +
    `+ state + nation). corridor counties: ${corridor.map((r) => r.name).join(", ")}`,
);

const fetchedAt = Date.now();
const arg = JSON.stringify({ rows, fetchedAt });
try {
  const out = execFileSync("npx", ["convex", "run", "geo/ingest:run", arg], {
    cwd: WEB,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 64 * 1024 * 1024,
  });
  console.log("  ingest:", out.trim().split("\n").pop());
} catch (err) {
  console.error("geo/ingest:run failed:", err.message);
  process.exit(1);
}

console.log("  rolling up modeled hotspot scores county -> state -> nation ...");
try {
  const out = execFileSync("npx", ["convex", "run", "geo/rollup:rollupScores", "{}"], {
    cwd: WEB,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 64 * 1024 * 1024,
  });
  const match = out.match(/\{[\s\S]*\}/);
  console.log("\n---- geo_load DONE (rollup) ----");
  if (match) {
    const r = JSON.parse(match[0]);
    console.log(
      `hotspots=${r.hotspots} assigned=${r.assigned} unassigned=${r.unassigned} ` +
        `countiesScored=${r.countiesScored}`,
    );
    for (const c of r.corridorCounties ?? []) {
      console.log(
        `  ${c.fips}: aggregateScore=${c.aggregateScore ?? "null"} ` +
          `(${c.hotspotCount} hotspots)`,
      );
    }
  } else {
    console.log(out.trim());
  }
} catch (err) {
  console.error("geo/rollup:rollupScores failed:", err.message);
  process.exit(1);
}
