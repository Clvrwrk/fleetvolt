/**
 * Capture Python baseline SimulateResponse fixtures for parity testing.
 *
 * Calls the live Python simulator's POST http://localhost:8000/v1/simulate
 * for two validation cases and writes the full response JSON to fixtures/.
 *
 * Usage:
 *   cd apps/web && npx tsx convex/physics/capturePythonBaseline.ts
 *
 * Requires: docker compose up -d postgres simulator
 * FAILS LOUDLY if the simulator is unreachable — never fabricates baselines.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");

const SIMULATOR_URL = "http://localhost:8000/v1/simulate";

interface CaseDef {
  name: string;
  fixture: string;
  request: Record<string, unknown>;
}

const CASES: CaseDef[] = [
  {
    name: "polb_cajon_pass",
    fixture: "python-baseline-polb-cajon.json",
    request: {
      route: { corridor_key: "polb_cajon_pass" },
      truck: { slug: "ecascadia_438" },
      conditions: {
        weather_preset: "ideal",
        payload_lbs: 34000,
        port_drayage_enabled: false,
      },
      overrides: {},
      options: { include_charging: true },
    },
  },
  {
    name: "flat_highway_oem",
    fixture: "python-baseline-flat-highway.json",
    request: {
      route: { origin: { lat: 34, lon: -118 }, dest: { lat: 34, lon: -117 } },
      truck: { slug: "ecascadia_438" },
      conditions: {
        weather_preset: "ideal",
        payload_lbs: 45000,
        port_drayage_enabled: false,
      },
      overrides: {},
      options: { include_charging: false },
    },
  },
];

async function captureCase(caseDef: CaseDef): Promise<void> {
  console.log(`\nCapturing "${caseDef.name}" ...`);
  console.log(`  POST ${SIMULATOR_URL}`);

  let response: Response;
  try {
    response = await fetch(SIMULATOR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(caseDef.request),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    console.error(`\n❌ FAILED: Python simulator unreachable at ${SIMULATOR_URL}`);
    console.error(`   Error: ${(err as Error).message}`);
    console.error(`   Run: docker compose up -d postgres simulator`);
    process.exit(1);
  }

  if (!response.ok) {
    console.error(`\n❌ FAILED: HTTP ${response.status} ${response.statusText}`);
    console.error(`   Run: docker compose up -d postgres simulator`);
    process.exit(1);
  }

  const data = await response.json();

  // Validate the response has the expected shape
  if (!data.segments || !data.kpis || !data.kpis.total_kwh) {
    console.error(`\n❌ FAILED: Response missing required fields (segments, kpis.total_kwh)`);
    console.error(`   Got keys: ${Object.keys(data).join(", ")}`);
    process.exit(1);
  }

  const fixturePath = join(FIXTURES_DIR, caseDef.fixture);
  mkdirSync(FIXTURES_DIR, { recursive: true });
  writeFileSync(fixturePath, JSON.stringify(data, null, 2) + "\n", "utf-8");

  console.log(`  ✅ Written to ${fixturePath}`);
  console.log(
    `  total_kwh=${data.kpis.total_kwh.toFixed(4)}, segments=${data.segments.length}, ` +
      `soc: ${data.segments[0].soc_pct}% → ${data.segments[data.segments.length - 1].soc_pct}%`,
  );
  if (data.feasibility) {
    console.log(
      `  feasibility: ${data.feasibility.verdict} / ${data.feasibility.tier} / stops=${data.feasibility.stop_count}`,
    );
  }
}

async function main(): Promise<void> {
  console.log("=== Python Baseline Capture ===");
  console.log(`Simulator: ${SIMULATOR_URL}`);
  console.log(`Fixtures:  ${FIXTURES_DIR}`);

  for (const caseDef of CASES) {
    await captureCase(caseDef);
  }

  console.log("\n✅ All baselines captured.\n");
}

main().catch((err) => {
  console.error("\n❌ Unexpected error:", err);
  process.exit(1);
});
