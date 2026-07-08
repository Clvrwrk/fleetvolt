// Shared provenance validator (DINT-01 / SRC-01).
//
// This ONE validator is reused on every data table in schema.ts, which makes
// "no record without provenance" a TYPE-LEVEL invariant: you cannot insert a
// ports/highwaySegments/freightFlows/hotspots/marketSizing (or any Phase-12
// data) row without a fully populated { source, fetchedAt, usefulnessScore,
// matchMethod } object. Both ingest actions (Wave 3) and the
// provenance-contract unit test assert against the single runtime helper
// `assertProvenance` below, so there is exactly one enforcement path.
//
// Phase 12 (P12-01): source count grew from nine to THIRTEEN — AFDC (chargers),
// OSM (POI extraction), Census (geo rollup FIPS/TIGER), NATD (truck-stop
// parking + alt-fuel corridors) were added for the converged data+spatial
// layer. Two OPTIONAL fields — `method` and `inputs` — are the modeled-
// provenance extension (P12-12): a modeled hotspot score can honestly record
// method:"modeled" plus the proxy `inputs` it was derived from, without
// weakening any of the four existing required-field rules.
import { Infer, v } from "convex/values";

/** The allowed provenance sources; SIMULATED/ESTIMATE discriminate
 *  synthetic values from measured ones (SRC-04). AFDC/OSM/Census/NATD were
 *  added in Phase 12 (P12-01) for the converged data+spatial layer.
 *  CARB (California Air Resources Board) added in P-ROLES for air-district
 *  geo enrichment. */
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
  "AFDC",
  "OSM",
  "Census",
  "NATD",
  "CARB",
] as const;

export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number];

/** The five allowed provenance methods (P12-12). Optional; when present it
 *  records HOW a value was produced so modeled data cannot masquerade as
 *  measured. */
export const PROVENANCE_METHODS = [
  "measured",
  "modeled",
  "geocoded",
  "extracted",
  "estimate",
] as const;

export type ProvenanceMethod = (typeof PROVENANCE_METHODS)[number];

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
    v.literal("AFDC"),
    v.literal("OSM"),
    v.literal("Census"),
    v.literal("NATD"),
    v.literal("CARB"),
  ),
  year: v.optional(v.number()), // dataset vintage
  fetchedAt: v.number(), // epoch ms of ingest
  // 0-10, the OUTPUT of the data-review-gate rubric run on the actual bytes
  // (DINT-03) — never the catalog's asserted pre-score.
  usefulnessScore: v.number(),
  matchMethod: v.string(), // e.g. "FAF_region_join", "geocoded", "manual"
  // P12-12 modeled-provenance extension (OPTIONAL). `method` records HOW the
  // value was produced; `inputs` lists the proxy signals a modeled value was
  // derived from (e.g. ["NATD_parking","Caltrans_5axle","FAF_flow"]).
  method: v.optional(
    v.union(
      v.literal("measured"),
      v.literal("modeled"),
      v.literal("geocoded"),
      v.literal("extracted"),
      v.literal("estimate"),
    ),
  ),
  inputs: v.optional(v.array(v.string())),
});

/** TypeScript type inferred directly from the validator (single source of truth). */
export type Provenance = Infer<typeof provenance>;

const SOURCE_SET: ReadonlySet<string> = new Set(PROVENANCE_SOURCES);
const METHOD_SET: ReadonlySet<string> = new Set(PROVENANCE_METHODS);

/**
 * Runtime enforcement shared by ingest actions and the provenance-contract test.
 * Throws if any of the four required fields is missing/wrong-typed, if `source`
 * is not one of the thirteen literals, or if `usefulnessScore` is outside 0..10.
 * When the OPTIONAL `method`/`inputs` fields are present they are validated too
 * (method one of the five literals; inputs an array of strings), but they never
 * weaken the required-field rules.
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
  if (p.method !== undefined) {
    if (typeof p.method !== "string" || !METHOD_SET.has(p.method)) {
      throw new Error(
        `provenance.method, when present, must be one of ${PROVENANCE_METHODS.join(
          ", ",
        )}; got ${String(p.method)}`,
      );
    }
  }
  if (p.inputs !== undefined) {
    if (
      !Array.isArray(p.inputs) ||
      !p.inputs.every((entry) => typeof entry === "string")
    ) {
      throw new Error(
        "provenance.inputs, when present, must be an array of strings",
      );
    }
  }
}
