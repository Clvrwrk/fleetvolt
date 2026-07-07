// Charger ingest ACTION (P12-07) — LIVE-fetches California DC-fast chargers
// from AFDC (developer.nlr.gov + NLR_API_KEY), classifies each with the
// Class-8 capability gate (≥350 kW AND MD/HD), and upserts them into Convex via
// batched internalMutations that spatial-index every row (12-02).
//
// WHY AN ACTION (RESEARCH / DATA-SOURCES-VERIFICATION): the heavy outbound
// fetch (~15MB / ~2,867 CA dc_fast stations) needs the 10-min action budget and
// network access (mutations/queries cannot fetch). NLR's nearest.json
// sub-endpoint 404s, so we pull the full CA v1.json set and do radius filtering
// client-side downstream. Writes go through upsertChargerBatch in 500-row
// chunks (each ~2.9MB — under the 5MiB arg cap + 1s mutation cap).
//
// Idempotent: upsert keyed by stationId (AFDC id). Re-running patches. One
// fetchedAt stamped here, threaded through every mutation call.
//
// usefulnessScore = the data-review-gate rubric OUTPUT on the AFDC bytes
// (DINT-03), NOT a catalog guess. Rationale recorded in 12-04-SUMMARY.md:
//   identity/keys present (id, lat/lng, connectors, network)   +2
//   location precise (GPS lat/lng, geocode_status)             +1
//   temporal freshness (date_last_confirmed / updated_at)      +1
//   measured public federal source (AFDC/DOE via NLR)          +2
//   full connector detail + provenance (method:"measured")     +1
//   coverage/completeness (all CA dc_fast, maximum_vehicle_class) +1
//   = 8/10  (docked 2: many null per-connector power_kw; no MCS
//            vehicle-class field beyond maximum_vehicle_class)
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { chunk } from "../lib/csvChunk";
import {
  isClass8Capable,
  stationMaxPowerKw,
  normalizeConnectors,
  isMcsCapable,
  type AfdcChargingUnit,
} from "./classify";

const AFDC_URL = "https://developer.nlr.gov/api/alt-fuel-stations/v1.json";
const USEFULNESS_SCORE = 8;
const BATCH_SIZE = 500;

// Minimal shape of an AFDC fuel_station we consume (the feed has ~80 fields).
interface AfdcStation {
  id: number | string;
  station_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ev_connector_types?: string[] | null;
  ev_network?: string | null;
  access_code?: string | null;
  status_code?: string | null;
  maximum_vehicle_class?: string | null;
  ev_dc_fast_num?: number | null;
  date_last_confirmed?: string | null;
  ev_charging_units?: AfdcChargingUnit[] | null;
}

export const run = action({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.NLR_API_KEY;
    if (!apiKey) {
      throw new Error(
        "NLR_API_KEY is not set in the Convex deployment env. " +
          "Set it with: npx convex env set NLR_API_KEY <value> (never log the value).",
      );
    }

    const url =
      `${AFDC_URL}?fuel_type=ELEC&state=CA&ev_charging_level=dc_fast` +
      `&api_key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(
        `AFDC fetch failed: HTTP ${resp.status} ${resp.statusText} (developer.nlr.gov)`,
      );
    }
    const body = (await resp.json()) as {
      total_results?: number;
      fuel_stations?: AfdcStation[];
    };
    const stations = body.fuel_stations ?? [];
    if (stations.length === 0) {
      throw new Error(
        "AFDC returned zero stations — refusing to proceed (no fabricated rows). " +
          "Check NLR_API_KEY / endpoint availability.",
      );
    }

    const fetchedAt = Date.now();
    const year = new Date(fetchedAt).getFullYear();

    // Map + classify every station. Skip rows without coordinates (cannot be
    // spatial-indexed) — count them so the SUMMARY is honest.
    let skippedNoCoords = 0;
    const rows = [];
    for (const s of stations) {
      if (
        typeof s.latitude !== "number" ||
        typeof s.longitude !== "number" ||
        !Number.isFinite(s.latitude) ||
        !Number.isFinite(s.longitude)
      ) {
        skippedNoCoords += 1;
        continue;
      }
      const maxPowerKw = stationMaxPowerKw(s.ev_charging_units);
      const connectorTypes = normalizeConnectors(s.ev_connector_types);
      rows.push({
        stationId: String(s.id),
        name: s.station_name ?? undefined,
        location: { lat: s.latitude, lng: s.longitude },
        powerKw: maxPowerKw,
        connectorTypes,
        operator: s.ev_network ?? undefined,
        accessCode: s.access_code ?? undefined,
        statusCode: s.status_code ?? undefined,
        maxVehicleClass: s.maximum_vehicle_class ?? undefined,
        evDcFastNum: s.ev_dc_fast_num ?? undefined,
        isClass8Capable: isClass8Capable(maxPowerKw, s.maximum_vehicle_class),
        isMcsCapable: isMcsCapable(connectorTypes),
        dateLastConfirmed: s.date_last_confirmed ?? undefined,
        connectors: s.ev_charging_units ?? undefined,
      });
    }

    let inserted = 0;
    let patched = 0;
    let class8 = 0;
    for (const batch of chunk(rows, BATCH_SIZE)) {
      const res = await ctx.runMutation(
        internal.chargers.mutations.upsertChargerBatch,
        { rows: batch, fetchedAt, year, usefulnessScore: USEFULNESS_SCORE },
      );
      inserted += res.inserted;
      patched += res.patched;
      class8 += res.class8;
    }

    const result = {
      totalFetched: stations.length,
      ingested: rows.length,
      skippedNoCoords,
      inserted,
      patched,
      class8Capable: class8,
      fetchedAt,
    };
    console.log("chargers/ingest:run", JSON.stringify(result));
    return result;
  },
});
