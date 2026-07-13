// Load California Geoportal ZIP areas into Convex (geoZcta).
//
// Usage (repo root):
//   services/simulator/.venv/bin/python3.14 data/ingest/census/prep_ca_zcta.py
//   node scripts/zcta_load.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const WEB = resolve(REPO, "apps/web");
const ZCTA_JSON = resolve(REPO, "data/ingest/census/out/ca_zcta.json");

function parseConvexJson(stdout) {
  const text = String(stdout ?? "").trim();
  const start =
    text.lastIndexOf("\n{") >= 0
      ? text.lastIndexOf("\n{") + 1
      : text.lastIndexOf("{");
  if (start < 0) return null;
  try {
    return JSON.parse(text.slice(start));
  } catch {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}

if (!existsSync(resolve(WEB, "convex"))) {
  console.error(`Could not find apps/web/convex under ${WEB}`);
  process.exit(1);
}
if (!existsSync(ZCTA_JSON)) {
  console.error(
    `Missing ${ZCTA_JSON}\n  Run: services/simulator/.venv/bin/python3.14 data/ingest/census/prep_ca_zcta.py`,
  );
  process.exit(1);
}

const rows = JSON.parse(readFileSync(ZCTA_JSON, "utf8"));
if (!Array.isArray(rows) || rows.length === 0) {
  console.error("ca_zcta.json is empty — nothing to ingest.");
  process.exit(1);
}
console.log(`zcta_load: ${rows.length} California Geoportal ZIP areas from ${ZCTA_JSON}`);

const fetchedAt = Date.now();
const BATCH = 80; // keep argv under shell limits
let inserted = 0;
let patched = 0;
let lastCounty = null;

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const arg = JSON.stringify({ rows: batch, fetchedAt });
  try {
    const out = execFileSync(
      "npx",
      ["convex", "run", "geo/ingestZcta:ingestZcta", arg],
      {
        cwd: WEB,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    const parsed = parseConvexJson(out);
    if (!parsed) {
      console.error("  unparsed at", i, out.slice(-400));
      process.exit(1);
    }
    inserted += parsed.inserted ?? 0;
    patched += parsed.patched ?? 0;
    lastCounty = parsed.countyAttach ?? null;
    console.log(
      `  ${Math.min(i + BATCH, rows.length)}/${rows.length} +${parsed.inserted} ~${parsed.patched}`,
    );
  } catch (err) {
    console.error(
      "ingest failed at offset",
      i,
      err.stderr?.toString?.() ?? err.message,
    );
    process.exit(1);
  }
}

try {
  const out = execFileSync(
    "npx",
    [
      "convex",
      "run",
      "geo/ingestZcta:purgeNonCaliforniaZcta",
      JSON.stringify({ keepZctas: rows.map((row) => row.zcta) }),
    ],
    {
      cwd: WEB,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  console.log("authoritative reconciliation:", parseConvexJson(out) ?? out.trim());
} catch (err) {
  console.error("purge failed:", err.stderr?.toString?.() ?? err.message);
  process.exit(1);
}

console.log("done", { inserted, patched, countyAttach: lastCounty });
