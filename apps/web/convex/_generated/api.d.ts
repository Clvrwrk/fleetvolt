/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as carriers_corridorCity from "../carriers/corridorCity.js";
import type * as carriers_ingest from "../carriers/ingest.js";
import type * as carriers_mutations from "../carriers/mutations.js";
import type * as carriers_queries from "../carriers/queries.js";
import type * as chargers_classify from "../chargers/classify.js";
import type * as chargers_ingest from "../chargers/ingest.js";
import type * as chargers_mutations from "../chargers/mutations.js";
import type * as chargers_queries from "../chargers/queries.js";
import type * as faf_ingestActuals from "../faf/ingestActuals.js";
import type * as faf_lookups from "../faf/lookups.js";
import type * as faf_mutations from "../faf/mutations.js";
import type * as faf_queries from "../faf/queries.js";
import type * as geo_ingest from "../geo/ingest.js";
import type * as geo_mutations from "../geo/mutations.js";
import type * as geo_queries from "../geo/queries.js";
import type * as geo_rollup from "../geo/rollup.js";
import type * as highways_ingest from "../highways/ingest.js";
import type * as highways_mutations from "../highways/mutations.js";
import type * as highways_queries from "../highways/queries.js";
import type * as hotspots_compute from "../hotspots/compute.js";
import type * as hotspots_mutations from "../hotspots/mutations.js";
import type * as hotspots_queries from "../hotspots/queries.js";
import type * as hotspots_score from "../hotspots/score.js";
import type * as lib_csvChunk from "../lib/csvChunk.js";
import type * as lib_haversine from "../lib/haversine.js";
import type * as lib_provenance from "../lib/provenance.js";
import type * as lib_spatial from "../lib/spatial.js";
import type * as parking_ingest from "../parking/ingest.js";
import type * as parking_mutations from "../parking/mutations.js";
import type * as pois_classify from "../pois/classify.js";
import type * as pois_ingest from "../pois/ingest.js";
import type * as pois_mutations from "../pois/mutations.js";
import type * as pois_queries from "../pois/queries.js";
import type * as ports from "../ports.js";
import type * as report from "../report.js";
import type * as seed_ports from "../seed/ports.js";
import type * as spatial from "../spatial.js";
import type * as userFilters from "../userFilters.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "carriers/corridorCity": typeof carriers_corridorCity;
  "carriers/ingest": typeof carriers_ingest;
  "carriers/mutations": typeof carriers_mutations;
  "carriers/queries": typeof carriers_queries;
  "chargers/classify": typeof chargers_classify;
  "chargers/ingest": typeof chargers_ingest;
  "chargers/mutations": typeof chargers_mutations;
  "chargers/queries": typeof chargers_queries;
  "faf/ingestActuals": typeof faf_ingestActuals;
  "faf/lookups": typeof faf_lookups;
  "faf/mutations": typeof faf_mutations;
  "faf/queries": typeof faf_queries;
  "geo/ingest": typeof geo_ingest;
  "geo/mutations": typeof geo_mutations;
  "geo/queries": typeof geo_queries;
  "geo/rollup": typeof geo_rollup;
  "highways/ingest": typeof highways_ingest;
  "highways/mutations": typeof highways_mutations;
  "highways/queries": typeof highways_queries;
  "hotspots/compute": typeof hotspots_compute;
  "hotspots/mutations": typeof hotspots_mutations;
  "hotspots/queries": typeof hotspots_queries;
  "hotspots/score": typeof hotspots_score;
  "lib/csvChunk": typeof lib_csvChunk;
  "lib/haversine": typeof lib_haversine;
  "lib/provenance": typeof lib_provenance;
  "lib/spatial": typeof lib_spatial;
  "parking/ingest": typeof parking_ingest;
  "parking/mutations": typeof parking_mutations;
  "pois/classify": typeof pois_classify;
  "pois/ingest": typeof pois_ingest;
  "pois/mutations": typeof pois_mutations;
  "pois/queries": typeof pois_queries;
  ports: typeof ports;
  report: typeof report;
  "seed/ports": typeof seed_ports;
  spatial: typeof spatial;
  userFilters: typeof userFilters;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  geospatial: import("@convex-dev/geospatial/_generated/component.js").ComponentApi<"geospatial">;
};
