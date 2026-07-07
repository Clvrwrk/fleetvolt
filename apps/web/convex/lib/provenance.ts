// Shared provenance validator (DINT-01 / SRC-01).
//
// This ONE validator is reused on every data table in schema.ts, which makes
// "no record without provenance" a TYPE-LEVEL invariant: you cannot insert a
// ports/highwaySegments/freightFlows/hotspots/marketSizing row without a fully
// populated { source, fetchedAt, usefulnessScore, matchMethod } object. Both
// ingest actions (Wave 3) and the provenance-contract unit test assert against
// the single runtime helper `assertProvenance` below, so there is exactly one
// enforcement path.
import { Infer, v } from "convex/values";

/** The nine allowed provenance sources; SIMULATED/ESTIMATE discriminate
 *  synthetic values from measured ones (SRC-04). */
export const PROVENANCE_SOURCES = [
  "FAF5",
  "Caltrans_AADT",
  "Caltrans_PeMS",
  "FHWA_Parking",
  "FMCSA",
  "BTS_Port",
  "POLB_Carriers",
  "SIMULATED",
  "ESTIMATE",
] as const;

export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number];

/** Reusable Convex object validator embedded on every data table. */
export const provenance = v.object({
  source: v.union(
    v.literal("FAF5"),
    v.literal("Caltrans_AADT"),
    v.literal("Caltrans_PeMS"),
    v.literal("FHWA_Parking"),
    v.literal("FMCSA"),
    v.literal("BTS_Port"),
    v.literal("POLB_Carriers"),
    v.literal("SIMULATED"),
    v.literal("ESTIMATE"),
  ),
  year: v.optional(v.number()), // dataset vintage
  fetchedAt: v.number(), // epoch ms of ingest
  // 0-10, the OUTPUT of the data-review-gate rubric run on the actual bytes
  // (DINT-03) — never the catalog's asserted pre-score.
  usefulnessScore: v.number(),
  matchMethod: v.string(), // e.g. "FAF_region_join", "geocoded", "manual"
});

/** TypeScript type inferred directly from the validator (single source of truth). */
export type Provenance = Infer<typeof provenance>;

const SOURCE_SET: ReadonlySet<string> = new Set(PROVENANCE_SOURCES);

/**
 * Runtime enforcement shared by ingest actions and the provenance-contract test.
 * Throws if any of the four required fields is missing/wrong-typed, if `source`
 * is not one of the nine literals, or if `usefulnessScore` is outside 0..10.
 */
export function assertProvenance(value: unknown): asserts value is Provenance {
  if (typeof value !== "object" || value === null) {
    throw new Error("provenance: expected an object");
  }
  const p = value as Record<string, unknown>;

  if (typeof p.source !== "string" || !SOURCE_SET.has(p.source)) {
    throw new Error(
      `provenance.source must be one of ${PROVENANCE_SOURCES.join(", ")}; got ${String(
        p.source,
      )}`,
    );
  }
  if (typeof p.fetchedAt !== "number" || !Number.isFinite(p.fetchedAt)) {
    throw new Error("provenance.fetchedAt must be a finite number (epoch ms)");
  }
  if (typeof p.usefulnessScore !== "number" || !Number.isFinite(p.usefulnessScore)) {
    throw new Error("provenance.usefulnessScore must be a finite number");
  }
  if (p.usefulnessScore < 0 || p.usefulnessScore > 10) {
    throw new Error(
      `provenance.usefulnessScore must be in 0..10; got ${p.usefulnessScore}`,
    );
  }
  if (typeof p.matchMethod !== "string" || p.matchMethod.length === 0) {
    throw new Error("provenance.matchMethod must be a non-empty string");
  }
  if (p.year !== undefined && typeof p.year !== "number") {
    throw new Error("provenance.year, when present, must be a number");
  }
}
