// Truck-config ingest loader/driver (P14-TRUCKS) — reads the enriched truck
// JSON files (data/trucks/*.json) and drives the deployed Convex action
// `trucks/ingest:run` against the dev deployment (sensible-oriole-832).
//
// The truck JSON files carry BOTH the existing physics fields (nameplate_kwh,
// usable_kwh, drag_coefficient, etc.) AND the new street metadata fields
// (vehicleClass, streetEfficiencyKwhPerMi, batteryHealthGuidance, etc.).
//
// This script reads the JSON files OUTSIDE the Convex bundler (which rejects
// node:fs/node:path in convex/ files) and passes them as args to the action,
// mirroring the carriers_load.mjs pattern exactly.
//
// Usage (from apps/web, where the convex CLI is wired):
//   node ../../scripts/trucks_load.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const WEB = resolve(REPO, "apps/web");
const TRUCKS_DIR = resolve(REPO, "data/trucks");

if (!existsSync(resolve(WEB, "convex"))) {
  console.error(`Could not find apps/web/convex under ${WEB}`);
  process.exit(1);
}
if (!existsSync(TRUCKS_DIR)) {
  console.error(`Missing ${TRUCKS_DIR} — nothing to ingest.`);
  process.exit(1);
}

// Read all truck JSON files
const files = readdirSync(TRUCKS_DIR).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.error("No truck JSON files found in data/trucks/ — nothing to ingest.");
  process.exit(1);
}

console.log(`trucks_load: found ${files.length} truck config files in ${TRUCKS_DIR}`);

// Transform raw JSON truck configs → Convex truckRows
const rows = [];
for (const file of files.sort()) {
  const raw = JSON.parse(readFileSync(resolve(TRUCKS_DIR, file), "utf8"));
  const sm = raw.street_metadata ?? {};

  // Build the params object from physics fields (existing shape)
  const params = {
    nameplate_kwh: raw.nameplate_kwh,
    usable_kwh: raw.usable_kwh,
    bms_reserve_kwh: raw.bms_reserve_kwh,
    curb_weight_lbs: raw.curb_weight_lbs,
    drag_coefficient: raw.drag_coefficient,
    frontal_area_m2: raw.frontal_area_m2,
    C_rr: raw.C_rr,
    regen_efficiency: raw.regen_efficiency,
    aux_kw_base: raw.aux_kw_base,
    drivetrain_efficiency: raw.drivetrain_efficiency,
    charge_curve: raw.charge_curve,
    source_notes: raw.source_notes,
  };

  rows.push({
    name: raw.name,
    isPreset: true,
    batteryUsableKwh: raw.usable_kwh,
    curbWeightLbs: raw.curb_weight_lbs,
    cdA: raw.drag_coefficient * raw.frontal_area_m2,
    rollingResistanceCoeff: raw.C_rr,
    regenEfficiency: raw.regen_efficiency,
    auxKwBase: raw.aux_kw_base,
    maxChargeRateKw: raw.charge_curve?.[0]?.max_kw ?? undefined,
    params,
    // Street metadata
    vehicleClass: sm.vehicleClass,
    axleConfig: sm.axleConfig,
    batteryNameplateKwh: sm.batteryNameplateKwh,
    batteryChemistry: sm.batteryChemistry,
    streetEfficiencyKwhPerMi: sm.streetEfficiencyKwhPerMi,
    ratedRangeMiles: sm.ratedRangeMiles,
    recommendedMilesPerCharge: sm.recommendedMilesPerCharge,
    batteryHealthGuidance: sm.batteryHealthGuidance,
    streetDataSources: sm.streetDataSources,
    streetDataConfidence: sm.streetDataConfidence,
  });
}

console.log(`  transformed ${rows.length} truck configs → Convex truckRows`);
console.log(`  trucks: ${rows.map((r) => r.name).join(", ")}`);
console.log(`  ingesting via trucks/ingest:run ...`);

const arg = JSON.stringify({ rows });
let out;
try {
  out = execFileSync("npx", ["convex", "run", "trucks/ingest:run", arg], {
    cwd: WEB,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  console.error("trucks/ingest:run failed:", err.message);
  process.exit(1);
}

// Parse the action result from stdout
try {
  const match = out.match(/\{[\s\S]*\}/);
  if (match) {
    const r = JSON.parse(match[0]);
    console.log(
      `\ntrucks_load DONE: received=${r.received} inserted=${r.inserted} ` +
        `patched=${r.patched}`,
    );
  } else {
    console.log(out.trim());
  }
} catch {
  // non-fatal: the raw action output above already carries the result
  console.log(out.trim());
}
