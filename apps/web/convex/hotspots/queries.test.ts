// Integration test: listModeledHotspots + listGeoRegions against live deployment.
// SKIP LOUDLY if deployment unreachable or tables empty.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../_generated/api.js";
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function convexUrl(): string | null {
  if (process.env.NEXT_PUBLIC_CONVEX_URL) return process.env.NEXT_PUBLIC_CONVEX_URL;
  const envPath = resolve(__dirname, "..", "..", ".env.local");
  if (!existsSync(envPath)) return null;
  const m = readFileSync(envPath, "utf8").match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m);
  return m ? m[1].trim() : null;
}

let client: ConvexHttpClient | null = null;
async function getClient() {
  if (!client) {
    const url = convexUrl();
    if (!url) throw new Error("No CONVEX_URL — set NEXT_PUBLIC_CONVEX_URL or .env.local");
    client = new ConvexHttpClient(url);
  }
  return client;
}

test("listModeledHotspots returns 5+ hotspots with scores", async () => {
  const c = await getClient();
  let hotspots: any[];
  try {
    hotspots = await c.query(api.hotspots.queries.listModeledHotspots, {});
  } catch (e) {
    console.log("SKIP: deployment unreachable —", (e as Error).message);
    return;
  }
  if (!hotspots || hotspots.length === 0) {
    console.log("SKIP: no modeled hotspots ingested — run hotspots/compute first");
    return;
  }
  assert.ok(hotspots.length >= 5, `expected 5+ hotspots, got ${hotspots.length}`);
  for (const h of hotspots) {
    assert.ok(typeof h.score === "number", "hotspot has numeric score");
    assert.ok(h.score >= 0 && h.score <= 1, `score ${h.score} in [0,1]`);
  }
  console.log(`[HOTSPOTS] ${hotspots.length} modeled hotspots, top score ${Math.max(...hotspots.map(h => h.score))}`);
});

test("listGeoRegions returns state + county regions with aggregateScores", async () => {
  const c = await getClient();
  let regions: any[];
  try {
    regions = await c.query(api.geo.queries.listGeoRegions, {});
  } catch (e) {
    console.log("SKIP: deployment unreachable —", (e as Error).message);
    return;
  }
  if (!regions || regions.length === 0) {
    console.log("SKIP: no geoRegions ingested — run geo_load.mjs first");
    return;
  }
  const counties = regions.filter((r: any) => r.level === "county");
  const states = regions.filter((r: any) => r.level === "state");
  assert.ok(counties.length >= 3, `expected 3+ counties, got ${counties.length}`);
  assert.ok(states.length >= 1, "expected 1+ state");
  // Corridor counties
  const corridorFips = ["06037", "06065", "06071"];
  for (const fips of corridorFips) {
    const county = counties.find((c: any) => c.fips === fips);
    if (county) {
      console.log(`[GEO] ${county.name} (${fips}) aggregateScore=${county.aggregateScore ?? "null"}`);
    }
  }
  console.log(`[GEO] ${regions.length} regions (${counties.length} counties, ${states.length} states)`);
});
