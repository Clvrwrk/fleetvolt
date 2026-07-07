// Convex seed: the six California ports backing the /pulse map anchors
// (FLOW-02, D-10). Every row carries a fully-populated provenance object
// (DINT-01 / SRC-01) — no port can exist without {source, fetchedAt,
// usefulnessScore, matchMethod}.
//
// INVOCATION (idempotent — safe to re-run):
//   npx convex run seed/ports:seed
// or from the Convex dashboard: Functions → seed/ports:seed → Run.
//
// Idempotency: upsert is keyed by `code` via the by_code index, so re-running
// patches existing rows instead of duplicating them.
import { internalMutation } from "../_generated/server";
import type { ProvenanceSource } from "../lib/provenance";

// Ingest timestamp for this seed run (epoch ms). Applies to every row.
// A single call = a single fetchedAt so provenance stays consistent per run.
type SeedPort = {
  name: string;
  code: string;
  location: { lat: number; lng: number };
  annualTEU?: number;
  // Per-row provenance inputs (fetchedAt is stamped at run time).
  source: ProvenanceSource;
  year?: number;
  usefulnessScore: number;
  matchMethod: string;
};

// Provenance notes:
// - source "BTS_Port": ports whose throughput is grounded in BTS Port
//   Performance / Freight Statistics (measured public figures). POLA, POLB,
//   Oakland, San Diego are BTS-tracked container/cargo ports.
// - Port Hueneme (HUE) and the SF passenger/limited-cargo terminal are not
//   container-TEU BTS entries in the same series; sourced from the respective
//   port authority (labeled "ESTIMATE" for the throughput vintage — no measured
//   container-TEU figure is asserted for them here).
// - matchMethod "manual": lat/lng are hand-placed from the port authority
//   locations (not geocoded from an address string).
// - usefulnessScore is a DOCUMENTED PLACEHOLDER derived from the data-review
//   rubric's structural axes for a static point dataset (identity + location +
//   provenance present, but single-vintage and low temporal depth). Container
//   BTS ports score higher (measured throughput backing) than the estimate
//   rows. Wave 3 (07-05, DINT-03) OVERWRITES these with the authoritative
//   data-review-gate output run on the actual BTS port bytes — do NOT treat
//   these as final scores.
const PORTS: readonly SeedPort[] = [
  {
    name: "Port of Los Angeles",
    code: "POLA",
    location: { lat: 33.74, lng: -118.26 },
    annualTEU: 8_634_497, // POLA 2022 loaded+empty TEU (port authority / BTS)
    source: "BTS_Port",
    year: 2022,
    usefulnessScore: 7, // measured throughput-backed; single-vintage point
    matchMethod: "manual",
  },
  {
    name: "Port of Long Beach",
    code: "POLB",
    location: { lat: 33.75, lng: -118.2 },
    annualTEU: 9_133_657, // POLB 2022 TEU (port authority / BTS)
    source: "BTS_Port",
    year: 2022,
    usefulnessScore: 7,
    matchMethod: "manual",
  },
  {
    name: "Port of Oakland",
    code: "OAK",
    location: { lat: 37.8, lng: -122.32 },
    annualTEU: 2_337_215, // Oakland 2022 TEU (port authority / BTS)
    source: "BTS_Port",
    year: 2022,
    usefulnessScore: 7,
    matchMethod: "manual",
  },
  {
    name: "Port of San Diego",
    code: "SD",
    location: { lat: 32.69, lng: -117.18 },
    // San Diego is a break-bulk / vehicle port, not a major container-TEU port;
    // annualTEU intentionally omitted (no comparable container figure).
    source: "BTS_Port",
    year: 2022,
    usefulnessScore: 6, // BTS-tracked cargo, but not container-TEU comparable
    matchMethod: "manual",
  },
  {
    name: "Port of Hueneme",
    code: "HUE",
    location: { lat: 34.15, lng: -119.21 },
    // Specialized break-bulk (autos/produce) — sourced from the Oxnard Harbor
    // District port authority; no container-TEU series, throughput vintage is
    // an estimate rather than a BTS container measurement.
    source: "ESTIMATE",
    year: 2022,
    usefulnessScore: 5,
    matchMethod: "manual",
  },
  {
    name: "Port of San Francisco",
    code: "SF",
    location: { lat: 37.8, lng: -122.42 },
    // Primarily cruise/passenger + limited cargo today; port authority sourced,
    // throughput estimate (not a measured container-TEU BTS row).
    source: "ESTIMATE",
    year: 2022,
    usefulnessScore: 5,
    matchMethod: "manual",
  },
] as const;

/**
 * Idempotent upsert of the six CA ports. Keyed by `code`: existing rows are
 * patched, missing rows inserted. Returns the count inserted vs. patched.
 */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const fetchedAt = Date.now();
    let inserted = 0;
    let patched = 0;

    for (const p of PORTS) {
      const doc = {
        name: p.name,
        code: p.code,
        location: p.location,
        annualTEU: p.annualTEU,
        provenance: {
          source: p.source,
          year: p.year,
          fetchedAt,
          usefulnessScore: p.usefulnessScore,
          matchMethod: p.matchMethod,
        },
      };

      const existing = await ctx.db
        .query("ports")
        .withIndex("by_code", (q) => q.eq("code", p.code))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, doc);
        patched += 1;
      } else {
        await ctx.db.insert("ports", doc);
        inserted += 1;
      }
    }

    return { inserted, patched, total: PORTS.length };
  },
});
