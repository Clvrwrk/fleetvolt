// Air-district loader script (P-ROLES).
//
// Reads data/raw/geo/ca_air_districts.json and calls the Convex action
// geo.ingestAirDistricts:ingestAirDistricts to patch the airDistrict field
// on existing geoRegions county rows.
//
// Usage: npx tsx scripts/air_district_load.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEPLOYMENT_URL = "https://sensible-oriole-832.convex.cloud";

async function main() {
  // apps/web/scripts/ -> repo root is three levels up
const REPO = resolve(__dirname, "..", "..", "..");
const jsonPath = resolve(REPO, "data/raw/geo/ca_air_districts.json");
  const raw = readFileSync(jsonPath, "utf8");
  const parsed = JSON.parse(raw);
  const districts = parsed.airDistricts;
  if (!Array.isArray(districts) || districts.length === 0) {
    console.error("No airDistricts found in ca_air_districts.json");
    process.exit(1);
  }
  console.log(`Loaded ${districts.length} air districts from JSON`);

  const client = new ConvexHttpClient(DEPLOYMENT_URL);

  const result = await client.action(
    api.geo.ingestAirDistricts.ingestAirDistricts,
    { districts },
  );

  console.log("Ingest result:", JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
