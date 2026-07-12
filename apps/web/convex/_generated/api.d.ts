/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as brief from "../brief.js";
import type * as caas_mutations from "../caas/mutations.js";
import type * as caas_queries from "../caas/queries.js";
import type * as carriers_corridorCity from "../carriers/corridorCity.js";
import type * as carriers_ingest from "../carriers/ingest.js";
import type * as carriers_mutations from "../carriers/mutations.js";
import type * as carriers_queries from "../carriers/queries.js";
import type * as catalog_enrich from "../catalog/enrich.js";
import type * as catalog_enrichQueries from "../catalog/enrichQueries.js";
import type * as catalog_ingest from "../catalog/ingest.js";
import type * as catalog_mutations from "../catalog/mutations.js";
import type * as catalog_queries from "../catalog/queries.js";
import type * as chargers_class8 from "../chargers/class8.js";
import type * as chargers_classify from "../chargers/classify.js";
import type * as chargers_ingest from "../chargers/ingest.js";
import type * as chargers_mutations from "../chargers/mutations.js";
import type * as chargers_queries from "../chargers/queries.js";
import type * as driver_mutations from "../driver/mutations.js";
import type * as driver_queries from "../driver/queries.js";
import type * as exports_exportCsv from "../exports/exportCsv.js";
import type * as exports_exportJson from "../exports/exportJson.js";
import type * as exports_exportPdf from "../exports/exportPdf.js";
import type * as exports_exportTemplate from "../exports/exportTemplate.js";
import type * as exports_exports from "../exports/exports.js";
import type * as faf_aadtSample from "../faf/aadtSample.js";
import type * as faf_buildCorridors from "../faf/buildCorridors.js";
import type * as faf_corridorInternal from "../faf/corridorInternal.js";
import type * as faf_corridorMutations from "../faf/corridorMutations.js";
import type * as faf_ingestActuals from "../faf/ingestActuals.js";
import type * as faf_lookups from "../faf/lookups.js";
import type * as faf_mutations from "../faf/mutations.js";
import type * as faf_queries from "../faf/queries.js";
import type * as faf_westCoastFlows from "../faf/westCoastFlows.js";
import type * as faf_zeCorridorSpecs from "../faf/zeCorridorSpecs.js";
import type * as fleet_mutations from "../fleet/mutations.js";
import type * as fleet_queries from "../fleet/queries.js";
import type * as generators_ingest from "../generators/ingest.js";
import type * as generators_mutations from "../generators/mutations.js";
import type * as generators_queries from "../generators/queries.js";
import type * as geo_choropleth from "../geo/choropleth.js";
import type * as geo_ingest from "../geo/ingest.js";
import type * as geo_ingestAirDistricts from "../geo/ingestAirDistricts.js";
import type * as geo_ingestZcta from "../geo/ingestZcta.js";
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
import type * as http from "../http.js";
import type * as lib_csvChunk from "../lib/csvChunk.js";
import type * as lib_haversine from "../lib/haversine.js";
import type * as lib_provenance from "../lib/provenance.js";
import type * as lib_spatial from "../lib/spatial.js";
import type * as observability_mutations from "../observability/mutations.js";
import type * as observability_queries from "../observability/queries.js";
import type * as parking_ingest from "../parking/ingest.js";
import type * as parking_mutations from "../parking/mutations.js";
import type * as physics_chargeCurve from "../physics/chargeCurve.js";
import type * as physics_chargingPlanner from "../physics/chargingPlanner.js";
import type * as physics_constants from "../physics/constants.js";
import type * as physics_detourValidator from "../physics/detourValidator.js";
import type * as physics_feasibility from "../physics/feasibility.js";
import type * as physics_inputsHash from "../physics/inputsHash.js";
import type * as physics_kpiAggregator from "../physics/kpiAggregator.js";
import type * as physics_orchestrator from "../physics/orchestrator.js";
import type * as physics_overrides from "../physics/overrides.js";
import type * as physics_physicsEngine from "../physics/physicsEngine.js";
import type * as physics_portDrayage from "../physics/portDrayage.js";
import type * as physics_segmentBuilder from "../physics/segmentBuilder.js";
import type * as physics_simulate from "../physics/simulate.js";
import type * as physics_socIntegrator from "../physics/socIntegrator.js";
import type * as physics_speedResolver from "../physics/speedResolver.js";
import type * as physics_types from "../physics/types.js";
import type * as physics_weather from "../physics/weather.js";
import type * as planner from "../planner.js";
import type * as pois_classify from "../pois/classify.js";
import type * as pois_ingest from "../pois/ingest.js";
import type * as pois_mutations from "../pois/mutations.js";
import type * as pois_queries from "../pois/queries.js";
import type * as ports from "../ports.js";
import type * as report from "../report.js";
import type * as routes_cache from "../routes/cache.js";
import type * as routes_cachePolicy from "../routes/cachePolicy.js";
import type * as routes_catalog from "../routes/catalog.js";
import type * as routes_catalogPolicy from "../routes/catalogPolicy.js";
import type * as routes_enrichment from "../routes/enrichment.js";
import type * as routes_enrichmentPolicy from "../routes/enrichmentPolicy.js";
import type * as routes_enrichmentRepository from "../routes/enrichmentRepository.js";
import type * as routes_enrichmentSources from "../routes/enrichmentSources.js";
import type * as seed_ports from "../seed/ports.js";
import type * as spatial from "../spatial.js";
import type * as spatial_reindex from "../spatial/reindex.js";
import type * as trucks_ingest from "../trucks/ingest.js";
import type * as trucks_mutations from "../trucks/mutations.js";
import type * as trucks_queries from "../trucks/queries.js";
import type * as userData_mutations from "../userData/mutations.js";
import type * as userData_queries from "../userData/queries.js";
import type * as userFilters from "../userFilters.js";
import type * as users_queries from "../users/queries.js";
import type * as workbench_actions from "../workbench/actions.js";
import type * as workbench_ai from "../workbench/ai.js";
import type * as workbench_queries from "../workbench/queries.js";
import type * as workbench_routePlanningSkill from "../workbench/routePlanningSkill.js";
import type * as workbench_runs from "../workbench/runs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  brief: typeof brief;
  "caas/mutations": typeof caas_mutations;
  "caas/queries": typeof caas_queries;
  "carriers/corridorCity": typeof carriers_corridorCity;
  "carriers/ingest": typeof carriers_ingest;
  "carriers/mutations": typeof carriers_mutations;
  "carriers/queries": typeof carriers_queries;
  "catalog/enrich": typeof catalog_enrich;
  "catalog/enrichQueries": typeof catalog_enrichQueries;
  "catalog/ingest": typeof catalog_ingest;
  "catalog/mutations": typeof catalog_mutations;
  "catalog/queries": typeof catalog_queries;
  "chargers/class8": typeof chargers_class8;
  "chargers/classify": typeof chargers_classify;
  "chargers/ingest": typeof chargers_ingest;
  "chargers/mutations": typeof chargers_mutations;
  "chargers/queries": typeof chargers_queries;
  "driver/mutations": typeof driver_mutations;
  "driver/queries": typeof driver_queries;
  "exports/exportCsv": typeof exports_exportCsv;
  "exports/exportJson": typeof exports_exportJson;
  "exports/exportPdf": typeof exports_exportPdf;
  "exports/exportTemplate": typeof exports_exportTemplate;
  "exports/exports": typeof exports_exports;
  "faf/aadtSample": typeof faf_aadtSample;
  "faf/buildCorridors": typeof faf_buildCorridors;
  "faf/corridorInternal": typeof faf_corridorInternal;
  "faf/corridorMutations": typeof faf_corridorMutations;
  "faf/ingestActuals": typeof faf_ingestActuals;
  "faf/lookups": typeof faf_lookups;
  "faf/mutations": typeof faf_mutations;
  "faf/queries": typeof faf_queries;
  "faf/westCoastFlows": typeof faf_westCoastFlows;
  "faf/zeCorridorSpecs": typeof faf_zeCorridorSpecs;
  "fleet/mutations": typeof fleet_mutations;
  "fleet/queries": typeof fleet_queries;
  "generators/ingest": typeof generators_ingest;
  "generators/mutations": typeof generators_mutations;
  "generators/queries": typeof generators_queries;
  "geo/choropleth": typeof geo_choropleth;
  "geo/ingest": typeof geo_ingest;
  "geo/ingestAirDistricts": typeof geo_ingestAirDistricts;
  "geo/ingestZcta": typeof geo_ingestZcta;
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
  http: typeof http;
  "lib/csvChunk": typeof lib_csvChunk;
  "lib/haversine": typeof lib_haversine;
  "lib/provenance": typeof lib_provenance;
  "lib/spatial": typeof lib_spatial;
  "observability/mutations": typeof observability_mutations;
  "observability/queries": typeof observability_queries;
  "parking/ingest": typeof parking_ingest;
  "parking/mutations": typeof parking_mutations;
  "physics/chargeCurve": typeof physics_chargeCurve;
  "physics/chargingPlanner": typeof physics_chargingPlanner;
  "physics/constants": typeof physics_constants;
  "physics/detourValidator": typeof physics_detourValidator;
  "physics/feasibility": typeof physics_feasibility;
  "physics/inputsHash": typeof physics_inputsHash;
  "physics/kpiAggregator": typeof physics_kpiAggregator;
  "physics/orchestrator": typeof physics_orchestrator;
  "physics/overrides": typeof physics_overrides;
  "physics/physicsEngine": typeof physics_physicsEngine;
  "physics/portDrayage": typeof physics_portDrayage;
  "physics/segmentBuilder": typeof physics_segmentBuilder;
  "physics/simulate": typeof physics_simulate;
  "physics/socIntegrator": typeof physics_socIntegrator;
  "physics/speedResolver": typeof physics_speedResolver;
  "physics/types": typeof physics_types;
  "physics/weather": typeof physics_weather;
  planner: typeof planner;
  "pois/classify": typeof pois_classify;
  "pois/ingest": typeof pois_ingest;
  "pois/mutations": typeof pois_mutations;
  "pois/queries": typeof pois_queries;
  ports: typeof ports;
  report: typeof report;
  "routes/cache": typeof routes_cache;
  "routes/cachePolicy": typeof routes_cachePolicy;
  "routes/catalog": typeof routes_catalog;
  "routes/catalogPolicy": typeof routes_catalogPolicy;
  "routes/enrichment": typeof routes_enrichment;
  "routes/enrichmentPolicy": typeof routes_enrichmentPolicy;
  "routes/enrichmentRepository": typeof routes_enrichmentRepository;
  "routes/enrichmentSources": typeof routes_enrichmentSources;
  "seed/ports": typeof seed_ports;
  spatial: typeof spatial;
  "spatial/reindex": typeof spatial_reindex;
  "trucks/ingest": typeof trucks_ingest;
  "trucks/mutations": typeof trucks_mutations;
  "trucks/queries": typeof trucks_queries;
  "userData/mutations": typeof userData_mutations;
  "userData/queries": typeof userData_queries;
  userFilters: typeof userFilters;
  "users/queries": typeof users_queries;
  "workbench/actions": typeof workbench_actions;
  "workbench/ai": typeof workbench_ai;
  "workbench/queries": typeof workbench_queries;
  "workbench/routePlanningSkill": typeof workbench_routePlanningSkill;
  "workbench/runs": typeof workbench_runs;
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
  workOSAuthKit: import("@convex-dev/workos-authkit/_generated/component.js").ComponentApi<"workOSAuthKit">;
};
