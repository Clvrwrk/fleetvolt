// Catalog ingest loader — reads the official California HVIP eligible-vehicles
// CSV + FleetVolt physics truck JSONs, builds CatalogVehicle rows via
// from-hvip-csv.ts, and drives catalog/ingest:run on the dev deployment.
//
// Usage (from apps/web, where the convex CLI is wired):
//   npx tsx ../../scripts/catalog_load.ts
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCatalogVehicleFromHvipRow,
  type HvipCsvRow,
  type PhysicsTruckLink,
} from "../apps/web/src/lib/catalog/from-hvip-csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const WEB = resolve(REPO, "apps/web");
const TRUCKS_DIR = resolve(REPO, "data/trucks");
const CSV_REL = "data/raw/HVIP Vehicle Data/eligible-hvip-vehicles-070826.csv";

const MODEL_HINT_STOP = new Set([
  "kwh",
  "bev",
  "ev",
  "fcev",
  "class",
  "battery",
  "electric",
  "the",
  "semi",
  "lr",
  "sr",
]);

function resolveCsvPath(): string {
  const local = resolve(REPO, CSV_REL);
  if (existsSync(local)) return local;
  const main = resolve(REPO, "..", "..", CSV_REL);
  if (existsSync(main)) return main;
  throw new Error(`HVIP CSV not found at ${local} or ${main}`);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0] ?? "");
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function oemFromTruckName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  if (first.length > 0) return first;
  return "Freightliner";
}

function modelHintsFromName(name: string, oem: string): string[] {
  const oemNorm = oem.toLowerCase();
  const hints = new Set<string>();
  for (const token of name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
    if (token.length < 2) continue;
    if (MODEL_HINT_STOP.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    if (token === oemNorm || oemNorm.includes(token)) continue;
    hints.add(token);
  }
  return [...hints];
}

function loadPhysicsTrucks(): PhysicsTruckLink[] {
  const files = readdirSync(TRUCKS_DIR).filter((file) => file.endsWith(".json"));
  const trucks: PhysicsTruckLink[] = [];

  for (const file of files.sort()) {
    const raw = JSON.parse(readFileSync(resolve(TRUCKS_DIR, file), "utf8")) as {
      name: string;
      nameplate_kwh: number;
      street_metadata?: {
        streetEfficiencyKwhPerMi?: {
          min: number;
          max: number;
          typical: number;
        };
      };
    };
    const sm = raw.street_metadata?.streetEfficiencyKwhPerMi;
    if (!sm) continue;

    const name = raw.name;
    const oem = oemFromTruckName(name);
    trucks.push({
      slug: basename(file, ".json"),
      name,
      oem,
      modelHints: modelHintsFromName(name, oem),
      packKwh: raw.nameplate_kwh,
      streetEfficiencyKwhPerMi: sm,
    });
  }

  return trucks;
}

function peerKwhPerMiBounds(
  physicsTrucks: PhysicsTruckLink[],
): { min: number | null; max: number | null } {
  const typicals = physicsTrucks
    .map((truck) => truck.streetEfficiencyKwhPerMi.typical)
    .filter((value): value is number => Number.isFinite(value));
  if (typicals.length === 0) return { min: null, max: null };
  return { min: Math.min(...typicals), max: Math.max(...typicals) };
}

function toHvipCsvRow(record: Record<string, string>): HvipCsvRow {
  return {
    Model: record.Model ?? "",
    Category: record.Category ?? "",
    OEM: record.OEM ?? "",
    "Technology Type": record["Technology Type"] ?? "",
    "Vehicle Incentive": record["Vehicle Incentive"] ?? "",
    "Vehicle Size": record["Vehicle Size"] ?? "",
    Dealers: record.Dealers ?? "",
    "New or Conversion": record["New or Conversion"] ?? "",
    Battery: record.Battery ?? "",
    "Model Year": record["Model Year"] ?? "",
    GVWR: record.GVWR ?? "",
    "Vehicle Type": record["Vehicle Type"] ?? "",
    URL: record.URL ?? "",
  };
}

if (!existsSync(resolve(WEB, "convex"))) {
  console.error(`Could not find apps/web/convex under ${WEB}`);
  process.exit(1);
}
if (!existsSync(TRUCKS_DIR)) {
  console.error(`Missing ${TRUCKS_DIR} — nothing to link.`);
  process.exit(1);
}

const csvPath = resolveCsvPath();
const csvText = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
const csvRecords = parseCsv(csvText);
if (csvRecords.length === 0) {
  console.error(`No rows parsed from ${csvPath}`);
  process.exit(1);
}

const physicsTrucks = loadPhysicsTrucks();
const peerBounds = peerKwhPerMiBounds(physicsTrucks);

console.log(
  `catalog_load: CSV=${csvPath} rows=${csvRecords.length} physicsTrucks=${physicsTrucks.length}`,
);

const rows = csvRecords.map((record) =>
  buildCatalogVehicleFromHvipRow(toHvipCsvRow(record), {
    physicsTrucks,
    peerKwhPerMiMin: peerBounds.min,
    peerKwhPerMiMax: peerBounds.max,
  }),
);

const linked = rows.filter((row) => row.physicsTruckSlug != null).length;
console.log(
  `  built ${rows.length} catalog rows (${linked} linked to physics trucks)`,
);
console.log("  ingesting via catalog/ingest:run ...");

const arg = JSON.stringify({ rows });
let out: string;
try {
  out = execFileSync("npx", ["convex", "run", "catalog/ingest:run", arg], {
    cwd: WEB,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("catalog/ingest:run failed:", message);
  process.exit(1);
}

try {
  const match = out.match(/\{[\s\S]*\}/);
  if (match) {
    const result = JSON.parse(match[0]) as {
      received: number;
      inserted: number;
      patched: number;
    };
    console.log(
      `\ncatalog_load DONE: received=${result.received} inserted=${result.inserted} ` +
        `patched=${result.patched} linked=${linked}`,
    );
  } else {
    console.log(out.trim());
  }
} catch {
  console.log(out.trim());
}
