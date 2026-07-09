# HVIP Catalog EPA Truck Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an HVIP catalog browse + EPA-style efficiency detail card (kWh/mi, fully laden/drayage, annual energy + HVIP $, diesel compare @ 60k mi for CO₂e/NOx/PM₂.₅) backed by Convex `catalogVehicles`.

**Architecture:** Parse the official 209-row HVIP CSV into `CatalogVehicle` records; enrich energy metrics by linking to existing `data/trucks/*.json` / `truckConfigs` via slug. Pure TS modules compute annual energy cost, peer compare range, and diesel-baseline emissions (placeholder factors until Phase 5). React EPA card + Concept A list render on `/catalog` and `/catalog/[slug]`. Physics simulation stays on `truckConfigs`; catalog is the browse/identity surface.

**Tech Stack:** Next.js 16 (App Router), Convex, Zod, TypeScript, Node `node:test` + `tsx`, existing `--fv-*` / CAD design components (`TechnicalLabel`, `KpiCell`, `SkeuomorphicCard`).

**Spec:** `docs/superpowers/specs/2026-07-08-hvip-catalog-epa-truck-card-design.md`

**Out of scope for this plan:** FleetUnit CRUD (Concepts B/E), Firecrawl image scrape (leave `imageUrl` null), Phase 5 WTW table replacement, workbench truck-picker rewrite.

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/web/src/lib/catalog/types.ts` | Zod schemas + `CatalogVehicle` type |
| `apps/web/src/lib/catalog/emissions.ts` | Diesel vs BEV annual factors @ 60k mi |
| `apps/web/src/lib/catalog/energy.ts` | kWh/100 mi, annual energy cost, duty pair derivation |
| `apps/web/src/lib/catalog/from-hvip-csv.ts` | CSV row → catalog draft + physics link |
| `apps/web/src/lib/catalog/*.test.ts` | Unit tests (picked up by `pnpm test` after glob update) |
| `apps/web/convex/schema.ts` | Add `catalogVehicles` table |
| `apps/web/convex/catalog/mutations.ts` | `upsertCatalogBatch` (internal) |
| `apps/web/convex/catalog/queries.ts` | `list`, `getBySlug` |
| `apps/web/convex/catalog/ingest.ts` | Action `run` |
| `scripts/catalog_load.mjs` | Read CSV + truck JSON → call ingest |
| `apps/web/src/components/catalog/epa-catalog-efficiency-card.tsx` | Primary EPA label UI |
| `apps/web/src/components/catalog/catalog-vehicle-list.tsx` | Concept A browse grid |
| `apps/web/src/app/catalog/page.tsx` | Browse route |
| `apps/web/src/app/catalog/[slug]/page.tsx` | Detail route |
| `apps/web/src/components/nav/use-role-nav.ts` | Add Catalog nav for Fleet (+ optional Driver) |
| `apps/web/package.json` | Extend `test` glob for `src/lib/catalog/**/*.test.ts` |

---

### Task 1: Catalog types + energy/emissions pure functions (TDD)

**Files:**
- Create: `apps/web/src/lib/catalog/types.ts`
- Create: `apps/web/src/lib/catalog/energy.ts`
- Create: `apps/web/src/lib/catalog/emissions.ts`
- Create: `apps/web/src/lib/catalog/energy.test.ts`
- Create: `apps/web/src/lib/catalog/emissions.test.ts`
- Modify: `apps/web/package.json` (test script glob)

- [ ] **Step 1: Extend test glob**

In `apps/web/package.json`, change the `test` script to:

```json
"test": "node --import tsx --test 'src/lib/*.test.ts' 'src/lib/**/*.test.ts' 'src/stores/*.test.ts' 'convex/**/*.test.ts'"
```

- [ ] **Step 2: Write failing energy tests**

Create `apps/web/src/lib/catalog/energy.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  kwhPer100Miles,
  annualEnergyCostUsd,
  deriveDutyPair,
} from "./energy.js";

describe("catalog energy", () => {
  it("converts kWh/mi to kWh per 100 miles", () => {
    assert.equal(kwhPer100Miles(2.1), 210);
  });

  it("computes annual energy cost at 60k mi", () => {
    // 2.1 kWh/mi * 60000 * $0.18/kWh = 22680
    assert.equal(annualEnergyCostUsd(2.1, 0.18, 60_000), 22_680);
  });

  it("derives fully laden / drayage from street efficiency band", () => {
    const pair = deriveDutyPair({ min: 2.0, max: 2.3, typical: 2.165 });
    assert.equal(pair.combined, 2.165);
    assert.equal(pair.fullyLaden, 2.3);
    assert.equal(pair.drayage, 2.3);
  });
});
```

- [ ] **Step 3: Write failing emissions tests**

Create `apps/web/src/lib/catalog/emissions.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { annualEmissionsVsDiesel } from "./emissions.js";

describe("catalog emissions", () => {
  it("compares BEV vs diesel at 60k mi for CO2e, NOx, PM2.5", () => {
    const result = annualEmissionsVsDiesel({
      kwhPerMi: 2.1,
      milesPerYear: 60_000,
    });
    assert.ok(result.diesel.co2eT > result.bev.co2eT);
    assert.equal(result.bev.noxKg, 0);
    assert.equal(result.bev.pm25Kg, 0);
    assert.ok(result.avoided.co2eT > 0);
    assert.ok(result.avoided.pctCo2e > 0 && result.avoided.pctCo2e < 1);
    assert.equal(result.milesPerYear, 60_000);
  });
});
```

- [ ] **Step 4: Run tests — expect FAIL**

```bash
cd "/Volumes/M4 Application SSD/Projects/FleetVolt/apps/web" && pnpm test -- src/lib/catalog/energy.test.ts src/lib/catalog/emissions.test.ts
```

Expected: FAIL (modules missing).

- [ ] **Step 5: Implement types + energy + emissions**

Create `apps/web/src/lib/catalog/types.ts`:

```ts
import { z } from "zod";

export const streetEfficiencySchema = z.object({
  min: z.number(),
  max: z.number(),
  typical: z.number(),
});

export const annualEmissionsSchema = z.object({
  milesPerYear: z.number(),
  diesel: z.object({
    co2eT: z.number(),
    noxKg: z.number(),
    pm25Kg: z.number(),
  }),
  bev: z.object({
    co2eT: z.number(),
    noxKg: z.number(),
    pm25Kg: z.number(),
  }),
  avoided: z.object({
    co2eT: z.number(),
    noxKg: z.number(),
    pm25Kg: z.number(),
    pctCo2e: z.number(),
  }),
});

export const catalogVehicleSchema = z.object({
  slug: z.string().min(1),
  oem: z.string(),
  model: z.string(),
  displayName: z.string(),
  vehicleClassLabel: z.string(),
  category: z.string(),
  technology: z.string(),
  packKwh: z.number().nullable(),
  hvipIncentiveUsd: z.number().nullable(),
  hvipVehicleUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
  kwhPerMiCombined: z.number().nullable(),
  kwhPerMiFullyLaden: z.number().nullable(),
  kwhPerMiDrayage: z.number().nullable(),
  peerKwhPerMiMin: z.number().nullable(),
  peerKwhPerMiMax: z.number().nullable(),
  annualEnergyCostUsd: z.number().nullable(),
  emissionsAnnual: annualEmissionsSchema.nullable(),
  physicsTruckSlug: z.string().nullable(),
  physicsTruckName: z.string().nullable(),
  energyEstimatePending: z.boolean(),
  assumptionsHash: z.string(),
});

export type CatalogVehicle = z.infer<typeof catalogVehicleSchema>;
export type AnnualEmissions = z.infer<typeof annualEmissionsSchema>;
```

Create `apps/web/src/lib/catalog/energy.ts`:

```ts
export const DEFAULT_CA_INDUSTRIAL_USD_PER_KWH = 0.18;
export const DEFAULT_MILES_PER_YEAR = 60_000;

export function kwhPer100Miles(kwhPerMi: number): number {
  return Math.round(kwhPerMi * 100 * 10) / 10;
}

export function annualEnergyCostUsd(
  kwhPerMi: number,
  usdPerKwh: number = DEFAULT_CA_INDUSTRIAL_USD_PER_KWH,
  milesPerYear: number = DEFAULT_MILES_PER_YEAR,
): number {
  return Math.round(kwhPerMi * milesPerYear * usdPerKwh);
}

export function deriveDutyPair(street: {
  min: number;
  max: number;
  typical: number;
}): { combined: number; fullyLaden: number; drayage: number } {
  // Street band is fully laden port/drayage GCW — use max for both duty slots
  // until separate drayage cycle factors exist (Phase 5).
  return {
    combined: street.typical,
    fullyLaden: street.max,
    drayage: street.max,
  };
}
```

Create `apps/web/src/lib/catalog/emissions.ts`:

```ts
import type { AnnualEmissions } from "./types.js";
import { DEFAULT_MILES_PER_YEAR } from "./energy.js";

/** Placeholder planning factors — replace with Phase 5 WTW tables. */
export const PLANNING_FACTORS = {
  dieselMpg: 6.5,
  dieselKgCo2ePerGallon: 10.21, // approx WTW-ish planning constant
  dieselNoxGPerMi: 3.0,
  dieselPm25GPerMi: 0.04,
  caGridKgCo2ePerKwh: 0.24,
} as const;

export function annualEmissionsVsDiesel(args: {
  kwhPerMi: number;
  milesPerYear?: number;
}): AnnualEmissions {
  const miles = args.milesPerYear ?? DEFAULT_MILES_PER_YEAR;
  const gallons = miles / PLANNING_FACTORS.dieselMpg;
  const dieselCo2eT =
    (gallons * PLANNING_FACTORS.dieselKgCo2ePerGallon) / 1000;
  const dieselNoxKg = (PLANNING_FACTORS.dieselNoxGPerMi * miles) / 1000;
  const dieselPm25Kg = (PLANNING_FACTORS.dieselPm25GPerMi * miles) / 1000;

  const bevCo2eT =
    (args.kwhPerMi * miles * PLANNING_FACTORS.caGridKgCo2ePerKwh) / 1000;
  const bevNoxKg = 0;
  const bevPm25Kg = 0;

  const avoidedCo2eT = dieselCo2eT - bevCo2eT;
  return {
    milesPerYear: miles,
    diesel: {
      co2eT: round1(dieselCo2eT),
      noxKg: round1(dieselNoxKg),
      pm25Kg: round2(dieselPm25Kg),
    },
    bev: {
      co2eT: round1(bevCo2eT),
      noxKg: bevNoxKg,
      pm25Kg: bevPm25Kg,
    },
    avoided: {
      co2eT: round1(avoidedCo2eT),
      noxKg: round1(dieselNoxKg - bevNoxKg),
      pm25Kg: round2(dieselPm25Kg - bevPm25Kg),
      pctCo2e: dieselCo2eT > 0 ? avoidedCo2eT / dieselCo2eT : 0,
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
cd "/Volumes/M4 Application SSD/Projects/FleetVolt/apps/web" && pnpm test -- src/lib/catalog/energy.test.ts src/lib/catalog/emissions.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/catalog/
git commit -m "feat(catalog): add energy and emissions planning helpers"
```

---

### Task 2: HVIP CSV → CatalogVehicle builder + physics link

**Files:**
- Create: `apps/web/src/lib/catalog/from-hvip-csv.ts`
- Create: `apps/web/src/lib/catalog/from-hvip-csv.test.ts`
- Create: `apps/web/src/lib/catalog/slug.ts`

- [ ] **Step 1: Write failing builder tests**

Create `apps/web/src/lib/catalog/from-hvip-csv.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCatalogVehicleFromHvipRow } from "./from-hvip-csv.js";

describe("buildCatalogVehicleFromHvipRow", () => {
  it("parses incentive and pack from HVIP CSV row", () => {
    const vehicle = buildCatalogVehicleFromHvipRow(
      {
        Model: "eCascadia",
        Category: "Tractor",
        OEM: "Freightliner",
        "Technology Type": "Battery Electric",
        "Vehicle Incentive": "120,000",
        "Vehicle Size": "",
        Dealers: "Demo Dealer",
        "New or Conversion": "New",
        Battery: "438 kWh",
        "Model Year": "2024, 2025, 2026",
        GVWR: "Class 8: $120,000",
        "Vehicle Type": "Tractor",
        URL: "https://californiahvip.org/vehicles/freightliner-ecascadia-battery-electric-tractor/",
      },
      {
        physicsTrucks: [
          {
            slug: "ecascadia_438",
            name: "Freightliner eCascadia 438 kWh",
            oem: "Freightliner",
            modelHints: ["ecascadia"],
            packKwh: 438,
            streetEfficiencyKwhPerMi: { min: 2.0, max: 2.3, typical: 2.165 },
          },
        ],
        peerKwhPerMiMin: 1.8,
        peerKwhPerMiMax: 2.5,
      },
    );
    assert.equal(vehicle.hvipIncentiveUsd, 120_000);
    assert.equal(vehicle.packKwh, 438);
    assert.equal(vehicle.physicsTruckSlug, "ecascadia_438");
    assert.equal(vehicle.energyEstimatePending, false);
    assert.ok(vehicle.kwhPerMiCombined !== null);
    assert.ok(vehicle.emissionsAnnual !== null);
  });

  it("marks energy pending when no physics link", () => {
    const vehicle = buildCatalogVehicleFromHvipRow(
      {
        Model: "Unknown Van",
        Category: "Step & Panel Van",
        OEM: "Acme",
        "Technology Type": "Battery Electric",
        "Vehicle Incentive": "45,000",
        "Vehicle Size": "",
        Dealers: "",
        "New or Conversion": "New",
        Battery: "100 kWh",
        "Model Year": "2025",
        GVWR: "",
        "Vehicle Type": "Van",
        URL: "https://example.com",
      },
      { physicsTrucks: [], peerKwhPerMiMin: null, peerKwhPerMiMax: null },
    );
    assert.equal(vehicle.physicsTruckSlug, null);
    assert.equal(vehicle.energyEstimatePending, true);
    assert.equal(vehicle.kwhPerMiCombined, null);
    assert.equal(vehicle.emissionsAnnual, null);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd "/Volumes/M4 Application SSD/Projects/FleetVolt/apps/web" && pnpm test -- src/lib/catalog/from-hvip-csv.test.ts
```

- [ ] **Step 3: Implement slug + builder**

Create `apps/web/src/lib/catalog/slug.ts`:

```ts
export function catalogSlug(oem: string, model: string, packKwh: number | null): string {
  const base = `${oem}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return packKwh != null ? `${base}-${packKwh}` : base;
}
```

Create `apps/web/src/lib/catalog/from-hvip-csv.ts`:

```ts
import { createHash } from "node:crypto";
import type { CatalogVehicle } from "./types.js";
import {
  annualEnergyCostUsd,
  deriveDutyPair,
  DEFAULT_CA_INDUSTRIAL_USD_PER_KWH,
} from "./energy.js";
import { annualEmissionsVsDiesel } from "./emissions.js";
import { catalogSlug } from "./slug.js";

export type HvipCsvRow = {
  Model: string;
  Category: string;
  OEM: string;
  "Technology Type": string;
  "Vehicle Incentive": string;
  "Vehicle Size": string;
  Dealers: string;
  "New or Conversion": string;
  Battery: string;
  "Model Year": string;
  GVWR: string;
  "Vehicle Type": string;
  URL: string;
};

export type PhysicsTruckLink = {
  slug: string;
  name: string;
  oem: string;
  modelHints: string[];
  packKwh: number;
  streetEfficiencyKwhPerMi: { min: number; max: number; typical: number };
};

export function parseIncentiveUsd(raw: string): number | null {
  const digits = raw.replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

export function parsePrimaryPackKwh(battery: string): number | null {
  const match = battery.match(/(\d+(?:\.\d+)?)\s*kWh/i);
  if (!match) return null;
  return Number(match[1]);
}

function classLabelFromGvwr(gvwr: string, category: string): string {
  const m = gvwr.match(/Class\s*(\d+)/i);
  if (m) return `Class ${m[1]}`;
  if (/tractor/i.test(category)) return "Class 8";
  return gvwr.trim() || "HVIP eligible";
}

export function buildCatalogVehicleFromHvipRow(
  row: HvipCsvRow,
  opts: {
    physicsTrucks: PhysicsTruckLink[];
    peerKwhPerMiMin: number | null;
    peerKwhPerMiMax: number | null;
  },
): CatalogVehicle {
  const packKwh = parsePrimaryPackKwh(row.Battery);
  const incentive = parseIncentiveUsd(row["Vehicle Incentive"]);
  const slug = catalogSlug(row.OEM, row.Model, packKwh);

  const linked = opts.physicsTrucks.find((t) => {
    const oemOk = t.oem.toLowerCase().includes(row.OEM.toLowerCase().slice(0, 5))
      || row.OEM.toLowerCase().includes(t.oem.toLowerCase().slice(0, 5));
    const modelOk = t.modelHints.some((h) =>
      row.Model.toLowerCase().includes(h.toLowerCase()),
    );
    const packOk = packKwh == null || Math.abs(t.packKwh - packKwh) < 1;
    return oemOk && modelOk && packOk;
  });

  let kwhPerMiCombined: number | null = null;
  let kwhPerMiFullyLaden: number | null = null;
  let kwhPerMiDrayage: number | null = null;
  let annualCost: number | null = null;
  let emissions = null as CatalogVehicle["emissionsAnnual"];
  let energyEstimatePending = true;

  if (linked) {
    const duty = deriveDutyPair(linked.streetEfficiencyKwhPerMi);
    kwhPerMiCombined = duty.combined;
    kwhPerMiFullyLaden = duty.fullyLaden;
    kwhPerMiDrayage = duty.drayage;
    annualCost = annualEnergyCostUsd(duty.combined, DEFAULT_CA_INDUSTRIAL_USD_PER_KWH);
    emissions = annualEmissionsVsDiesel({ kwhPerMi: duty.combined });
    energyEstimatePending = false;
  }

  const assumptionsPayload = {
    rate: DEFAULT_CA_INDUSTRIAL_USD_PER_KWH,
    linked: linked?.slug ?? null,
    incentive,
    packKwh,
  };
  const assumptionsHash = createHash("sha256")
    .update(JSON.stringify(assumptionsPayload))
    .digest("hex")
    .slice(0, 16);

  return {
    slug,
    oem: row.OEM.trim(),
    model: row.Model.trim(),
    displayName: `${row.OEM.trim()} ${row.Model.trim()}`.trim(),
    vehicleClassLabel: classLabelFromGvwr(row.GVWR, row.Category),
    category: row.Category.trim(),
    technology: row["Technology Type"].trim(),
    packKwh,
    hvipIncentiveUsd: incentive,
    hvipVehicleUrl: row.URL.trim() || null,
    imageUrl: null,
    kwhPerMiCombined,
    kwhPerMiFullyLaden,
    kwhPerMiDrayage,
    peerKwhPerMiMin: opts.peerKwhPerMiMin,
    peerKwhPerMiMax: opts.peerKwhPerMiMax,
    annualEnergyCostUsd: annualCost,
    emissionsAnnual: emissions,
    physicsTruckSlug: linked?.slug ?? null,
    physicsTruckName: linked?.name ?? null,
    energyEstimatePending,
    assumptionsHash,
  };
}
```

Note: `createHash` requires Node. Keep this module used from ingest scripts and Convex `"use node"` actions only — **do not import `from-hvip-csv.ts` into client components**. For client-safe display, pass already-built `CatalogVehicle` docs from Convex queries.

If bundling into Convex action without `node:crypto`, replace hash with a simple string join hash in a `assumptionsHash` helper that works in both environments:

```ts
export function simpleAssumptionsHash(parts: string[]): string {
  let h = 0;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `a${Math.abs(h).toString(16)}`;
}
```

Prefer `simpleAssumptionsHash` in the final implementation so the same file can run in Convex actions without `"use node"` if desired. Update the builder to use it instead of `createHash`.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "/Volumes/M4 Application SSD/Projects/FleetVolt/apps/web" && pnpm test -- src/lib/catalog/from-hvip-csv.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/catalog/
git commit -m "feat(catalog): build CatalogVehicle rows from HVIP CSV"
```

---

### Task 3: Convex `catalogVehicles` schema + ingest

**Files:**
- Modify: `apps/web/convex/schema.ts`
- Create: `apps/web/convex/catalog/mutations.ts`
- Create: `apps/web/convex/catalog/queries.ts`
- Create: `apps/web/convex/catalog/ingest.ts`
- Create: `scripts/catalog_load.mjs`

- [ ] **Step 1: Add table to schema**

In `apps/web/convex/schema.ts`, after `truckConfigs`, add:

```ts
  catalogVehicles: defineTable({
    slug: v.string(),
    oem: v.string(),
    model: v.string(),
    displayName: v.string(),
    vehicleClassLabel: v.string(),
    category: v.string(),
    technology: v.string(),
    packKwh: v.union(v.number(), v.null()),
    hvipIncentiveUsd: v.union(v.number(), v.null()),
    hvipVehicleUrl: v.union(v.string(), v.null()),
    imageUrl: v.union(v.string(), v.null()),
    kwhPerMiCombined: v.union(v.number(), v.null()),
    kwhPerMiFullyLaden: v.union(v.number(), v.null()),
    kwhPerMiDrayage: v.union(v.number(), v.null()),
    peerKwhPerMiMin: v.union(v.number(), v.null()),
    peerKwhPerMiMax: v.union(v.number(), v.null()),
    annualEnergyCostUsd: v.union(v.number(), v.null()),
    emissionsAnnual: v.union(
      v.object({
        milesPerYear: v.number(),
        diesel: v.object({
          co2eT: v.number(),
          noxKg: v.number(),
          pm25Kg: v.number(),
        }),
        bev: v.object({
          co2eT: v.number(),
          noxKg: v.number(),
          pm25Kg: v.number(),
        }),
        avoided: v.object({
          co2eT: v.number(),
          noxKg: v.number(),
          pm25Kg: v.number(),
          pctCo2e: v.number(),
        }),
      }),
      v.null(),
    ),
    physicsTruckSlug: v.union(v.string(), v.null()),
    physicsTruckName: v.union(v.string(), v.null()),
    energyEstimatePending: v.boolean(),
    assumptionsHash: v.string(),
    provenance,
  })
    .index("by_slug", ["slug"])
    .index("by_oem", ["oem"])
    .index("by_category", ["category"]),
```

- [ ] **Step 2: Mutations + queries**

Create `apps/web/convex/catalog/mutations.ts`:

```ts
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const catalogRow = v.object({
  slug: v.string(),
  oem: v.string(),
  model: v.string(),
  displayName: v.string(),
  vehicleClassLabel: v.string(),
  category: v.string(),
  technology: v.string(),
  packKwh: v.union(v.number(), v.null()),
  hvipIncentiveUsd: v.union(v.number(), v.null()),
  hvipVehicleUrl: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
  kwhPerMiCombined: v.union(v.number(), v.null()),
  kwhPerMiFullyLaden: v.union(v.number(), v.null()),
  kwhPerMiDrayage: v.union(v.number(), v.null()),
  peerKwhPerMiMin: v.union(v.number(), v.null()),
  peerKwhPerMiMax: v.union(v.number(), v.null()),
  annualEnergyCostUsd: v.union(v.number(), v.null()),
  emissionsAnnual: v.union(
    v.object({
      milesPerYear: v.number(),
      diesel: v.object({
        co2eT: v.number(),
        noxKg: v.number(),
        pm25Kg: v.number(),
      }),
      bev: v.object({
        co2eT: v.number(),
        noxKg: v.number(),
        pm25Kg: v.number(),
      }),
      avoided: v.object({
        co2eT: v.number(),
        noxKg: v.number(),
        pm25Kg: v.number(),
        pctCo2e: v.number(),
      }),
    }),
    v.null(),
  ),
  physicsTruckSlug: v.union(v.string(), v.null()),
  physicsTruckName: v.union(v.string(), v.null()),
  energyEstimatePending: v.boolean(),
  assumptionsHash: v.string(),
});

export const upsertCatalogBatch = internalMutation({
  args: {
    rows: v.array(catalogRow),
    ingestedAt: v.number(),
  },
  returns: v.object({ upserted: v.number() }),
  handler: async (ctx, args) => {
    let upserted = 0;
    for (const row of args.rows) {
      const existing = await ctx.db
        .query("catalogVehicles")
        .withIndex("by_slug", (q) => q.eq("slug", row.slug))
        .unique();
      const doc = {
        ...row,
        provenance: {
          source: "hvip_csv",
          ingestedAt: args.ingestedAt,
        },
      };
      if (existing) {
        await ctx.db.patch(existing._id, doc);
      } else {
        await ctx.db.insert("catalogVehicles", doc);
      }
      upserted += 1;
    }
    return { upserted };
  },
});
```

Adjust `provenance` shape to match the existing `provenance` validator already imported/defined in `schema.ts` (same pattern as `trucks/mutations.ts`).

Create `apps/web/convex/catalog/queries.ts`:

```ts
import { v } from "convex/values";
import { query } from "../_generated/server";

export const list = query({
  args: {
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()), // tighten after codegen if preferred
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 250, 300);
    let rows;
    if (args.category) {
      rows = await ctx.db
        .query("catalogVehicles")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .take(limit);
    } else {
      rows = await ctx.db.query("catalogVehicles").take(limit);
    }
    return rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("catalogVehicles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});
```

Create `apps/web/convex/catalog/ingest.ts` mirroring `trucks/ingest.ts`: accept `rows` array, call `internal.catalog.mutations.upsertCatalogBatch`.

- [ ] **Step 3: Write `scripts/catalog_load.mjs`**

Mirror `scripts/trucks_load.mjs`:

1. Read `data/raw/HVIP Vehicle Data/eligible-hvip-vehicles-070826.csv` (utf-8-sig).
2. Read all `data/trucks/*.json`; build `physicsTrucks` with slug = filename without `.json`, `modelHints` from name tokens, `packKwh` from `nameplate_kwh`, street efficiency from `street_metadata`.
3. Compute peer min/max from linked trucks’ `typical` kWh/mi.
4. For each CSV row, call the same builder logic (either duplicate minimal JS in the script, or run via `tsx` importing `from-hvip-csv.ts`). Prefer:

```bash
# from apps/web
npx tsx ../../scripts/catalog_load.ts
```

If using `.mjs` only, inline parseIncentive / parsePack / link logic matching the TS tests.

5. Invoke Convex action `catalog/ingest:run` with the rows (same `npx convex run` pattern as trucks_load).

- [ ] **Step 4: Load data into dev**

With `npx convex dev` running:

```bash
cd "/Volumes/M4 Application SSD/Projects/FleetVolt/apps/web" && node ../../scripts/catalog_load.mjs
```

Expected: ~209 upserted (or slightly more if pack variants expand later); console shows linked count for physics trucks (~37 max).

- [ ] **Step 5: Commit**

```bash
git add apps/web/convex/schema.ts apps/web/convex/catalog/ scripts/catalog_load.mjs
git commit -m "feat(catalog): Convex catalogVehicles table and HVIP ingest"
```

---

### Task 4: EPA catalog efficiency card component

**Files:**
- Create: `apps/web/src/components/catalog/epa-catalog-efficiency-card.tsx`
- Create: `apps/web/src/lib/catalog/format.ts` (currency / percent helpers)

- [ ] **Step 1: Format helpers**

```ts
// apps/web/src/lib/catalog/format.ts
export function formatUsd(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatKwhPerMi(n: number | null): string {
  if (n == null) return "—";
  return n.toFixed(1);
}

export function formatPct(n: number | null): string {
  if (n == null) return "—";
  return `${Math.round(n * 100)}%`;
}
```

- [ ] **Step 2: Implement EPA card**

Create `apps/web/src/components/catalog/epa-catalog-efficiency-card.tsx` as a client or server component that accepts a `CatalogVehicle`-shaped prop (or Convex doc). Layout must match the design spec §3.1:

- Header band with `FLEETVOLT · ENERGY & ENVIRONMENT` and tech badge
- Identity strip
- Left: large `kwhPerMiCombined`, fully laden / drayage, kWh/100 mi via `kwhPer100Miles`
- Right: `annualEnergyCostUsd` + `hvipIncentiveUsd` stacked
- Compare bar using `peerKwhPerMiMin` / `Max` (hide section if either null)
- Environment table from `emissionsAnnual` (show “Energy estimate pending” callout if `energyEstimatePending`)
- Spec strip: pack, class, category, tech
- Fine print disclaimer

Use existing classes: `fv-mono-label`, `fv-kpi-cell`, border tokens `--color-line`, accent `--fv-blueprint-blue` / `--color-accent` sparingly. `data-testid="epa-catalog-efficiency-card"`.

When `energyEstimatePending`, still show HVIP $ and identity; hero metric shows “—” with pending note.

- [ ] **Step 3: Manual visual check**

Temporarily render the card on a page with a hard-coded sample matching the canvas SAMPLE (or skip to Task 5).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/catalog/ apps/web/src/lib/catalog/format.ts
git commit -m "feat(catalog): EPA-style catalog efficiency card"
```

---

### Task 5: Browse list (Concept A) + catalog routes + nav

**Files:**
- Create: `apps/web/src/components/catalog/catalog-vehicle-list.tsx`
- Create: `apps/web/src/app/catalog/page.tsx`
- Create: `apps/web/src/app/catalog/[slug]/page.tsx`
- Modify: `apps/web/src/components/nav/use-role-nav.ts`
- Optional: redirect note on `/unit` — do **not** delete `/unit` in this plan; add Catalog nav alongside Vehicles.

- [ ] **Step 1: Concept A list**

`catalog-vehicle-list.tsx`: grid of links to `/catalog/[slug]`. Each cell shows OEM/model, category/tech pills, pack, HVIP $, kWh/mi or “pending”. `data-testid="catalog-vehicle-list"`.

- [ ] **Step 2: Pages**

`catalog/page.tsx` (client):

```tsx
"use client";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CatalogVehicleList } from "@/components/catalog/catalog-vehicle-list";

export default function CatalogPage() {
  const vehicles = useQuery(api.catalog.queries.list, {});
  if (vehicles === undefined) return <div className="p-8">Loading catalog…</div>;
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-medium">HVIP vehicle catalog</h1>
      <p className="mt-2 text-sm text-[var(--fv-steel)]">
        California HVIP-eligible models. Open a card for the EPA-style energy label.
      </p>
      <div className="mt-6">
        <CatalogVehicleList vehicles={vehicles} />
      </div>
    </main>
  );
}
```

`catalog/[slug]/page.tsx`: `useQuery(api.catalog.queries.getBySlug, { slug })` → `EpaCatalogEfficiencyCard`. 404 empty state if null.

- [ ] **Step 3: Nav**

In `use-role-nav.ts`, add to Fleet Manager (and Driver if desired):

```ts
{ label: "Catalog", href: "/catalog", icon: "BookOpen" },
```

Ensure Sidebar icon map includes `BookOpen` (lucide).

- [ ] **Step 4: Smoke test**

```bash
# browser: http://127.0.0.1:3000/catalog
# open a linked tractor (e.g. eCascadia) and confirm EPA card fields
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/catalog/ apps/web/src/components/catalog/ apps/web/src/components/nav/use-role-nav.ts
git commit -m "feat(catalog): browse and detail routes for HVIP EPA cards"
```

---

### Task 6: Spec status + self-check

**Files:**
- Modify: `docs/superpowers/specs/2026-07-08-hvip-catalog-epa-truck-card-design.md` (status → Approved / Implemented-in-progress)

- [ ] **Step 1: Update spec status line** to `Approved 2026-07-08` and link this plan path.

- [ ] **Step 2: Verify success criteria from spec §10**

Checklist (manual):

1. kWh/mi dominant on detail card for linked trucks  
2. Fully laden / drayage shown  
3. Annual energy + HVIP stacked  
4. Environment table CO₂e / NOx / PM₂.₅ vs diesel @ 60k  
5. Fine print planning-only  
6. Unlinked HVIP rows show pending, not invented kWh/mi  

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-08-hvip-catalog-epa-truck-card-design.md
git commit -m "docs: mark HVIP EPA truck card spec approved"
```

---

## Spec coverage (self-review)

| Spec section | Task |
|--------------|------|
| §2 Locked decisions | Tasks 1, 4 |
| §3 EPA layout | Task 4 |
| §4 A–E secondary | Task 5 = A; B–E deferred (explicit non-goal) |
| §5 CatalogVehicle model | Tasks 1–3 |
| §6 Emissions @ 60k | Task 1 + 4 |
| §7 HVIP CSV ingest | Task 2–3 |
| §8 Placement `/catalog` | Task 5 |
| §9 Non-goals | Honored |
| §10 Success criteria | Task 6 |

**Deferred (follow-up plans):** FleetUnit wizard (B/E), image scrape, Phase 5 factor swap, workbench `TruckProfileSelect` → catalog link.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-08-hvip-catalog-epa-truck-card.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — run tasks in this session with checkpoints  

Which approach?
