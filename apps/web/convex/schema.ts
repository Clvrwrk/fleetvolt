// Convex schema — FleetVolt converged data + spatial layer.
//
// Phase 7 shipped the six /pulse tables (ports, highwaySegments, freightFlows,
// hotspots, marketSizing, userFilters). Phase 12 (P12-01) CONVERGES the PostGIS
// simulator tables + the aspirational Supabase field shapes INTO this ONE
// schema — additively. The six Phase-7 tables + their indexes are preserved
// byte-compatibly so /pulse (ports.ts, userFilters.ts) keeps compiling.
//
// Every DATA table embeds the SHARED `provenance` validator from ./lib/provenance,
// so no data record can exist without {source, fetchedAt, usefulnessScore,
// matchMethod} (DINT-01 / SRC-01, P12-02). userFilters is the only exempt
// table — it holds anonymous view state, not data.
//
// P12-03: field names are borrowed from the Supabase design, but Supabase-only
// constructs (organization_id, created_by / auth.users FKs, RLS) are DROPPED —
// auth/multi-tenancy is deferred to WorkOS.
// POINT tables (chargers, carriers, parking, pois) carry location{lat,lng} for
// the geospatial nearest() layer (12-02) + haversine fallback. LINE tables
// (highwaySegments, corridors, nhfnSegments) keep bbox + simplify-js path
// (Convex ~1MB doc guard, PITFALLS #11).
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { provenance } from "./lib/provenance";

export default defineSchema({
  // Port anchors: POLA/POLB/HUE/OAK/SF/SD. Rendered as AdvancedMarkers (Wave 2).
  ports: defineTable({
    name: v.string(),
    code: v.string(), // POLA/POLB/HUE/OAK/SF/SD
    location: v.object({ lat: v.number(), lng: v.number() }),
    annualTEU: v.optional(v.number()),
    metrics: v.optional(v.any()),
    provenance,
  }).index("by_code", ["code"]),

  highwaySegments: defineTable({
    segmentId: v.string(), // Caltrans/FAF route id
    route: v.string(), // "I-710","I-110","I-5","US-101"
    // simplify-js-thinned lat/lng polyline (Convex ~1MB doc guard, PITFALLS #11)
    path: v.array(v.object({ lat: v.number(), lng: v.number() })),
    aadt: v.optional(v.number()),
    // truck AADT kept DISTINCT from aadt — never conflate FAF vs PeMS (PITFALLS #7)
    truckAADT: v.optional(v.number()),
    bbox: v.object({
      minLat: v.number(),
      minLng: v.number(),
      maxLat: v.number(),
      maxLng: v.number(),
    }),
    provenance,
  })
    .index("by_route", ["route"])
    .index("by_segmentId", ["segmentId"]),

  freightFlows: defineTable({
    segmentId: v.string(), // FK -> highwaySegments.segmentId
    periodStart: v.number(),
    periodEnd: v.number(),
    granularity: v.union(
      v.literal("year"),
      v.literal("month"),
      v.literal("hour"),
    ),
    tons: v.optional(v.number()), // FAF annual tonnage (explicit unit)
    volume: v.number(), // normalized -> width (Phase 8)
    congestion: v.number(), // 0..1 -> R/Y/G (Phase 8)
    provenance,
  })
    .index("by_segment_period", ["segmentId", "periodStart"])
    .index("by_period", ["periodStart"]),

  // Seeded in P7, rendered P9.
  hotspots: defineTable({
    kind: v.union(
      v.literal("parking"),
      v.literal("congestion"),
      v.literal("truckingHQ"),
      v.literal("solarCharger"),
      // P12-11/P12-12 (12-08): MODELED truck-dwell/demand hotspots. The score
      // is a composite proxy (parking capacity + 5-axle truckAADT + FAF flow +
      // carrier concentration) — never observed dwell. Additive to the Phase-7
      // kind union.
      v.literal("modeledDwell"),
    ),
    location: v.object({ lat: v.number(), lng: v.number() }),
    title: v.string(),
    dimensions: v.array(
      v.object({ label: v.string(), value: v.string() }),
    ),
    meta: v.optional(v.any()),
    // P12-12 (12-08): the MODELED composite demand score in [0,1] (optional so
    // Phase-7 hotspots stay valid) + the per-proxy normalized components that
    // produced it (audit trail). provenance.method:"modeled" + inputs[] label
    // it honestly; overclaiming observed dwell is prohibited.
    score: v.optional(v.number()),
    scoreInputs: v.optional(v.any()),
    provenance,
  })
    .index("by_kind", ["kind"]),

  // Seeded in P7, rendered P9. provenance.source MUST be "ESTIMATE" — these
  // figures are estimates with a methodology basis, never measured (PITFALLS #9).
  marketSizing: defineTable({
    tier: v.union(v.literal("TAM"), v.literal("SAM"), v.literal("SOM")),
    regionPolygon: v.array(v.object({ lat: v.number(), lng: v.number() })),
    valueUSD: v.number(),
    label: v.string(),
    provenance,
  }).index("by_tier", ["tier"]),

  // D-07: anonymous, NOT WorkOS-keyed in P7. `filterKey` is a localStorage UUID
  // (or "anonymous" singleton). Rekey to a WorkOS subject id in Phase 10.
  // No provenance — this is view state, not data.
  userFilters: defineTable({
    filterKey: v.string(),
    timeMode: v.union(v.literal("5yr"), v.literal("1yr"), v.literal("live")),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    overlays: v.object({
      tam: v.boolean(),
      sam: v.boolean(),
      som: v.boolean(),
    }),
    selectedPort: v.optional(v.string()), // P7 port selector state
    selectedFlowPath: v.optional(v.string()),
  }).index("by_key", ["filterKey"]),

  // ── Phase 12 converged POINT tables (geo-anchored, location{lat,lng}) ──────

  // AFDC chargers (P12-07). location backs BOTH the geospatial-component
  // nearest() (12-02) and the hand-rolled haversine fallback.
  chargers: defineTable({
    stationId: v.string(), // AFDC id, stable key
    name: v.optional(v.string()),
    location: v.object({ lat: v.number(), lng: v.number() }),
    powerKw: v.number(),
    connectorTypes: v.array(v.string()),
    operator: v.optional(v.string()),
    accessCode: v.optional(v.string()),
    statusCode: v.optional(v.string()),
    maxVehicleClass: v.optional(
      v.union(v.literal("LD"), v.literal("MD"), v.literal("HD")),
    ),
    evDcFastNum: v.optional(v.number()),
    // P12-07: max power_kw>=350 AND maxVehicleClass in MD/HD
    isClass8Capable: v.boolean(),
    isMcsCapable: v.optional(v.boolean()),
    dateLastConfirmed: v.optional(v.string()),
    connectors: v.optional(v.any()), // full per-connector detail
    provenance,
  })
    .index("by_stationId", ["stationId"])
    .index("by_class8", ["isClass8Capable"]),

  // POLB carrier registry (P12-09). location optional — geocode may fail;
  // 12-05 backfills it. corridorCity is the outreach tag. carrierKey (stable
  // hash of normalized name+address) is the idempotent-upsert key (P12-09).
  carriers: defineTable({
    carrierKey: v.optional(v.string()),
    name: v.string(),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zip: v.optional(v.string()),
    location: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    corridorCity: v.optional(v.string()),
    geocodeStatus: v.optional(v.string()),
    provenance,
  })
    .index("by_carrierKey", ["carrierKey"])
    .index("by_corridorCity", ["corridorCity"])
    .index("by_city", ["city"]),

  // NATD truck-stop parking (P12-06 / P12-11 proxy). numberOfSpots is the
  // P12-12 capacity proxy. parkingKey (stable NATD hash) backs the idempotent
  // upsert (12-07).
  parking: defineTable({
    parkingKey: v.optional(v.string()),
    name: v.optional(v.string()),
    location: v.object({ lat: v.number(), lng: v.number() }),
    numberOfSpots: v.optional(v.number()),
    hgv: v.optional(v.boolean()),
    provenance,
  }).index("by_parkingKey", ["parkingKey"]),

  // OSM POIs (P12-14). tags holds the raw OSM tag bag. osmKey =
  // "<elementType>/<osmId>" backs the idempotent upsert (12-07).
  pois: defineTable({
    type: v.union(
      v.literal("truck_parking"),
      v.literal("rest_area"),
      v.literal("fuel"),
      v.literal("convenience"),
      v.literal("fast_food"),
    ),
    osmKey: v.optional(v.string()),
    name: v.optional(v.string()),
    location: v.object({ lat: v.number(), lng: v.number() }),
    tags: v.optional(v.any()), // raw OSM tags
    provenance,
  })
    .index("by_type", ["type"])
    .index("by_osmKey", ["osmKey"]),

  // ── Phase 12 converged LINE + reference + rollup tables ────────────────────

  // Corridors (from Supabase corridors, drop org/auth). path is
  // simplify-js-thinned (Convex ~1MB doc guard); bbox for coarse filtering.
  corridors: defineTable({
    corridorKey: v.string(),
    name: v.string(),
    origin: v.object({ lat: v.number(), lng: v.number() }),
    dest: v.object({ lat: v.number(), lng: v.number() }),
    path: v.array(v.object({ lat: v.number(), lng: v.number() })),
    distanceMiles: v.optional(v.number()),
    bbox: v.object({
      minLat: v.number(),
      minLng: v.number(),
      maxLat: v.number(),
      maxLng: v.number(),
    }),
    nhfnCompliance: v.optional(v.boolean()),
    provenance,
  }).index("by_corridorKey", ["corridorKey"]),

  // Major traffic generators (intermodal / rail / port facilities) from CalTrans CSV.
  trafficGenerators: defineTable({
    generatorId: v.string(),
    name: v.string(),
    assoc: v.string(),
    address: v.string(),
    city: v.string(),
    zip: v.string(),
    district: v.string(),
    county: v.string(),
    location: v.object({ lat: v.number(), lng: v.number() }),
    portCode: v.optional(v.string()),
    provenance,
  })
    .index("by_generatorId", ["generatorId"])
    .index("by_portCode", ["portCode"])
    .index("by_county", ["county"]),

  // Road-traced freight overview corridors (Google via-waypoints + CalTrans AADT sample).
  freightCorridors: defineTable({
    corridorKey: v.string(),
    name: v.string(),
    originPortCode: v.string(),
    destLabel: v.string(),
    viaRouteLabel: v.string(),
    compareGroup: v.optional(v.string()),
    origin: v.object({ lat: v.number(), lng: v.number() }),
    dest: v.object({ lat: v.number(), lng: v.number() }),
    path: v.array(v.object({ lat: v.number(), lng: v.number() })),
    distanceMiles: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    intensity: v.number(),
    tier: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("heavy"),
    ),
    color: v.string(),
    directionHint: v.string(),
    truckAadtStats: v.optional(
      v.object({
        min: v.number(),
        max: v.number(),
        mean: v.number(),
        p90: v.number(),
        sampleCount: v.number(),
      }),
    ),
    bbox: v.object({
      minLat: v.number(),
      minLng: v.number(),
      maxLat: v.number(),
      maxLng: v.number(),
    }),
    provenance,
  })
    .index("by_corridorKey", ["corridorKey"])
    .index("by_compareGroup", ["compareGroup"])
    .index("by_originPort", ["originPortCode"]),

  // BTS National Highway Freight Network segments (from nhfn_network).
  nhfnSegments: defineTable({
    segmentId: v.string(),
    path: v.array(v.object({ lat: v.number(), lng: v.number() })),
    phfsFlag: v.optional(v.boolean()),
    corridorType: v.optional(v.string()),
    state: v.optional(v.string()),
    bbox: v.object({
      minLat: v.number(),
      minLng: v.number(),
      maxLat: v.number(),
      maxLng: v.number(),
    }),
    provenance,
  }).index("by_segmentId", ["segmentId"]),

  // Elevation profiles (from elevation_profiles). routeHash is a SHA256 cache key.
  elevationProfiles: defineTable({
    routeHash: v.string(),
    corridorKey: v.optional(v.string()),
    profile: v.array(
      v.object({ distM: v.number(), elevM: v.number() }),
    ),
    provenance,
  }).index("by_routeHash", ["routeHash"]),

  // Truck configs (from truck_configs; eCascadia/T680E presets).
  //
  // P14-TRUCKS: enriched with real-world STREET metadata for every Class 6-8 EV
  // truck — street efficiency (kWh/mi, fully laden ~80k+ lbs GCW port/drayage),
  // rated range, battery-health-optimized miles-per-charge, battery-health
  // operating guidance, and the street-data provenance/confidence. All new
  // fields are OPTIONAL and ADDITIVE — the existing physics fields stay intact
  // so the simulator's energy model is unaffected.
  truckConfigs: defineTable({
    name: v.string(),
    oemModel: v.optional(v.string()),
    isPreset: v.boolean(),
    batteryUsableKwh: v.optional(v.number()),
    curbWeightLbs: v.optional(v.number()),
    cdA: v.optional(v.number()),
    rollingResistanceCoeff: v.optional(v.number()),
    regenEfficiency: v.optional(v.number()),
    auxKwBase: v.optional(v.number()),
    maxChargeRateKw: v.optional(v.number()),
    params: v.optional(v.any()),
    // ── P14-TRUCKS street metadata (additive, all optional) ─────────────────
    vehicleClass: v.optional(
      v.union(v.literal(6), v.literal(7), v.literal(8)),
    ),
    axleConfig: v.optional(v.string()), // "4x2", "6x4", "6x2"
    batteryNameplateKwh: v.optional(v.number()),
    batteryChemistry: v.optional(v.string()), // "LFP", "NMC", etc.
    // Fully laden (~80k+ lbs GCW) port/drayage street efficiency in kWh/mi.
    streetEfficiencyKwhPerMi: v.optional(
      v.object({ min: v.number(), max: v.number(), typical: v.number() }),
    ),
    // OEM-rated range envelope (miles) under typical/max conditions.
    ratedRangeMiles: v.optional(
      v.object({ typical: v.number(), max: v.number() }),
    ),
    // Battery-health-optimized recommended miles per charge cycle.
    recommendedMilesPerCharge: v.optional(
      v.object({ healthMin: v.number(), healthMax: v.number() }),
    ),
    // Battery-health operating guidance: daily charge target, operating SoC
    // window, max depth-of-discharge, and notes.
    batteryHealthGuidance: v.optional(
      v.object({
        dailyChargeTargetPct: v.number(),
        operatingWindowMinPct: v.number(),
        operatingWindowMaxPct: v.number(),
        dodMaxPct: v.number(),
        notes: v.string(),
      }),
    ),
    // Street-data source labels (e.g. "PepsiCo pilot", "CARB BEDT avg").
    streetDataSources: v.optional(v.array(v.string())),
    // Confidence in the street data: high/medium/low.
    streetDataConfidence: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    ),
    provenance,
  }).index("by_name", ["name"]),

  // HVIP-eligible vehicle catalog (EPA-style energy card). Rows are built from
  // the official California HVIP CSV + optional physics-truck links from
  // data/trucks/*.json. provenance.source is ESTIMATE (derived catalog), with
  // matchMethod:"hvip_csv" + method:"extracted" for honest lineage.
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
    /** Extra product photos from HVIP detail scrape (Firecrawl). */
    galleryUrls: v.optional(v.array(v.string())),
    scrapedAt: v.optional(v.number()),
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

  // Simulations — results now live in Convex (Phase 13 fulfilled the Phase-12
  // metadata-only split). inputsHash is the dedup/cache key. The `results`
  // field holds the full SimulateResponse JSON.
  simulations: defineTable({
    inputsHash: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    corridorKey: v.optional(v.string()),
    truckConfigName: v.optional(v.string()),
    physicsVersion: v.optional(v.string()),
    chargerVersion: v.optional(v.string()),
    inputs: v.optional(v.any()),
    results: v.optional(v.any()),
    durationMs: v.optional(v.number()),
    provenance,
  })
    .index("by_inputsHash", ["inputsHash"])
    .index("by_status", ["status"]),

  // ── Phase 12 FAF freight-out-of-port tables (P12-03, freightOD spine) ──────
  //
  // FAF5 zone-to-zone OUTBOUND OD flows. STRUCTURALLY DISTINCT from the
  // segment-keyed `freightFlows` above: freightOD is keyed by origin/dest FAF
  // ZONES (not highway segments) — never conflate FAF OD with PeMS/segment
  // flows (Phase-7 PITFALLS #7). This ingest is dms_orig="061" (LA-Long Beach
  // port zone) → dmsDest, aggregated by (year, dmsDest, dmsMode, sctg2).
  freightOD: defineTable({
    year: v.number(), // actual-year column vintage (2018..2024)
    dmsOrig: v.string(), // FAF origin zone id; "061" = LA-Long Beach (this ingest)
    dmsDest: v.string(), // FAF destination zone id
    dmsMode: v.optional(v.string()), // "1"=truck, "2"=rail, "3"=water, ...
    sctg2: v.optional(v.string()), // 2-digit SCTG commodity code
    // FAF annual tonnage in THOUSAND tons (ktons) — explicit unit, never
    // conflate with PeMS/segment tonnage (PITFALLS #7). Summed across matching
    // raw FAF rows for the (year,dest,mode,sctg2) key.
    tonsKtons: v.optional(v.number()),
    // FAF annual value in MILLIONS of USD, as loaded from the value_<year>
    // columns (constant-dollar series; current_value_* left unloaded) — summed
    // across matching raw rows for the key.
    valueUSD: v.optional(v.number()),
    provenance,
  })
    .index("by_year", ["year"])
    .index("by_orig_year", ["dmsOrig", "year"])
    .index("by_dest", ["dmsDest"])
    // Fully-selective composite for idempotent upsert: the ingest key is
    // (dmsOrig, year, dmsDest, dmsMode, sctg2). Without dest/mode/sctg2 in the
    // index, an upsert lookup on by_orig_year collects tens of thousands of
    // same-origin rows and trips Convex's 32k-doc read limit at scale.
    .index("by_key", ["dmsOrig", "year", "dmsDest", "dmsMode", "sctg2"]),

  // FAF zone reference (metadata + CFS↔FAF crosswalk). "061" = LA-Long Beach.
  fafZones: defineTable({
    zoneId: v.string(),
    name: v.string(),
    state: v.optional(v.string()),
    provenance,
  }).index("by_zoneId", ["zoneId"]),

  // FAF mode reference (dms_mode label: 1=Truck, 2=Rail, 3=Water, ...).
  fafModes: defineTable({
    modeId: v.string(),
    label: v.string(),
    provenance,
  }).index("by_modeId", ["modeId"]),

  // FAF SCTG2 commodity reference (2-digit code → label).
  fafCommodities: defineTable({
    sctg2: v.string(),
    label: v.string(),
    provenance,
  }).index("by_sctg2", ["sctg2"]),

  // Geo rollup: US -> State -> County (P12-13, Census FIPS/TIGER). SCAFFOLD —
  // populated in 12-08. P-ROLES: airDistrict + zipCodes added for CaaS
  // deployment-zone geographic context (additive — existing rows stay valid).
  geoRegions: defineTable({
    level: v.union(
      v.literal("nation"),
      v.literal("state"),
      v.literal("county"),
    ),
    fips: v.string(),
    name: v.string(),
    parentFips: v.optional(v.string()),
    centroid: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    bbox: v.optional(
      v.object({
        minLat: v.number(),
        minLng: v.number(),
        maxLat: v.number(),
        maxLng: v.number(),
      }),
    ),
    aggregateScore: v.optional(v.number()),
    airDistrict: v.optional(v.string()),
    zipCodes: v.optional(v.array(v.string())),
    provenance,
  })
    .index("by_level", ["level"])
    .index("by_fips", ["fips"])
    .index("by_parent", ["parentFips"]),

  // Census TIGER ZCTA5 (2020 vintage, tl_2022_us_zcta520) — CA only.
  // Simplified exterior rings for CaaS ZIP choropleth (fill ≤50%).
  geoZcta: defineTable({
    zcta: v.string(),
    name: v.string(),
    centroid: v.object({ lat: v.number(), lng: v.number() }),
    bbox: v.object({
      minLat: v.number(),
      minLng: v.number(),
      maxLat: v.number(),
      maxLng: v.number(),
    }),
    /** Simplified exterior ring (open; UI closes). Cap ~48 pts at ingest. */
    ring: v.array(v.object({ lat: v.number(), lng: v.number() })),
    aggregateScore: v.optional(v.number()),
    countyFips: v.optional(v.string()),
    airDistrict: v.optional(v.string()),
    provenance,
  })
    .index("by_zcta", ["zcta"])
    .index("by_county", ["countyFips"]),

  // ── Driver profiles (P-DRIVER) ──────────────────────────────────────────────
  //
  // Captures the FULL set of preferences a driver uses for physics calculations:
  // truck slug (→ truckConfigs), payload, weather preset, port drayage, charging
  // SoC targets, and optional physics overrides (±20% OEM bounds enforced in
  // convex/physics/overrides.ts). Also captures carrier association (→ carriers
  // by carrierKey) and home terminal location for carrier-finder queries.
  //
  // No auth yet — driverId is a stable anonymous ID (localStorage UUID or
  // WorkOS subject once Phase 10 lands). No provenance — this is user
  // preference state, not ingested data.
  driverProfiles: defineTable({
    driverId: v.string(),
    displayName: v.string(),
    email: v.optional(v.string()),
    associatedCarrierKey: v.optional(v.string()),
    preferredTruckSlug: v.optional(v.string()),
    defaultPayloadLbs: v.optional(v.number()),
    defaultWeatherPreset: v.optional(
      v.union(
        v.literal("ideal"),
        v.literal("hot"),
        v.literal("cold"),
        v.literal("headwind"),
      ),
    ),
    portDrayageEnabled: v.optional(v.boolean()),
    chargingPreferences: v.optional(
      v.object({
        soc_trigger_pct: v.number(),
        soc_floor_pct: v.number(),
        target_soc_pct: v.number(),
        min_arrival_soc_pct: v.number(),
      }),
    ),
    physicsOverrides: v.optional(
      v.object({
        C_rr: v.optional(v.number()),
        drag_coefficient: v.optional(v.number()),
        usable_kwh: v.optional(v.number()),
        aux_kw_base: v.optional(v.number()),
        regen_efficiency: v.optional(v.number()),
      }),
    ),
    homeTerminal: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
        label: v.optional(v.string()),
      }),
    ),
    preferredCorridorKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_driverId", ["driverId"])
    .index("by_email", ["email"]),

  // ── Three-user-role platform (P-ROLES) ─────────────────────────────────────
  //
  // userAccounts unifies all three role types (driver, fleet_manager, caas).
  // userId is a stable anonymous ID (localStorage UUID or WorkOS subject once
  // Phase 10 lands). For drivers, this links to driverProfiles.driverId. For
  // fleet managers and CaaS companies, it links to fleetCompanies/caasCompanies
  // via the role-specific tables.
  userAccounts: defineTable({
    userId: v.string(),
    role: v.union(
      v.literal("driver"),
      v.literal("fleet_manager"),
      v.literal("caas"),
    ),
    email: v.optional(v.string()),
    displayName: v.string(),
    companyName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // ── Fleet Manager tables (P-ROLES) ────────────────────────────────────────

  fleetCompanies: defineTable({
    fleetId: v.string(),
    name: v.string(),
    dotNumber: v.optional(v.string()),
    address: v.optional(v.string()),
    location: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_fleetId", ["fleetId"])
    .index("by_name", ["name"]),

  fleetDrivers: defineTable({
    fleetId: v.string(),
    driverId: v.string(),
    driverName: v.string(),
    assignedTruckSlug: v.optional(v.string()),
    assignedLotId: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    createdAt: v.number(),
  })
    .index("by_fleetId", ["fleetId"])
    .index("by_driverId", ["driverId"]),

  fleetParkingLots: defineTable({
    lotId: v.string(),
    fleetId: v.string(),
    name: v.string(),
    address: v.optional(v.string()),
    location: v.object({ lat: v.number(), lng: v.number() }),
    amenities: v.array(v.string()),
    capacityTrucks: v.number(),
    existingChargers: v.optional(v.number()),
    chargerKw: v.optional(v.number()),
    powerAvailable: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_fleetId", ["fleetId"])
    .index("by_lotId", ["lotId"]),

  fleetRoutes: defineTable({
    routeId: v.string(),
    fleetId: v.string(),
    name: v.string(),
    originLotId: v.optional(v.string()),
    destLotId: v.optional(v.string()),
    waypoints: v.array(v.object({ lat: v.number(), lng: v.number() })),
    distanceMiles: v.optional(v.number()),
    assignedDriverIds: v.array(v.string()),
    assignedTruckSlugs: v.array(v.string()),
    schedule: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_fleetId", ["fleetId"])
    .index("by_routeId", ["routeId"]),

  // ── CaaS (Charging-as-a-Service) tables (P-ROLES) ──────────────────────────

  caasCompanies: defineTable({
    caasId: v.string(),
    name: v.string(),
    serviceArea: v.optional(
      v.object({
        states: v.array(v.string()),
        counties: v.array(v.string()),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_caasId", ["caasId"])
    .index("by_name", ["name"]),

  caasDeploymentZones: defineTable({
    zoneId: v.string(),
    caasId: v.string(),
    name: v.string(),
    level: v.union(
      v.literal("nation"),
      v.literal("state"),
      v.literal("county"),
      v.literal("air_district"),
      v.literal("zip"),
    ),
    fips: v.optional(v.string()),
    airDistrict: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    centroid: v.object({ lat: v.number(), lng: v.number() }),
    radiusM: v.number(),
    modeledDwellScore: v.optional(v.number()),
    freightFlowKtons: v.optional(v.number()),
    carrierCount: v.optional(v.number()),
    parkingCapacity: v.optional(v.number()),
    existingChargers: v.optional(v.number()),
    class8ChargerGap: v.optional(v.boolean()),
    recommendedPowerKw: v.optional(v.number()),
    priority: v.optional(
      v.union(
        v.literal("high"),
        v.literal("medium"),
        v.literal("low"),
      ),
    ),
    createdAt: v.number(),
  })
    .index("by_caasId", ["caasId"])
    .index("by_zoneId", ["zoneId"])
    .index("by_level", ["level"])
    .index("by_priority", ["caasId", "priority"]),

  // ── FleetVolt-owned user activity + observability (P16-AUTH-DATA) ──────────
  // WorkOS authenticates people. FleetVolt owns product data: role/profile,
  // site errors, user query history, query response errors, user fleets, and
  // user-built routes. These tables are intentionally app-scoped and indexed by
  // WorkOS userId so any authenticated person can use the product without an
  // invite gate.

  siteErrors: defineTable({
    errorId: v.string(),
    userId: v.optional(v.string()),
    route: v.optional(v.string()),
    url: v.optional(v.string()),
    component: v.optional(v.string()),
    severity: v.union(v.literal("info"), v.literal("warn"), v.literal("error"), v.literal("fatal")),
    message: v.string(),
    stack: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_errorId", ["errorId"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_route_createdAt", ["route", "createdAt"])
    .index("by_severity_createdAt", ["severity", "createdAt"]),

  userQueryHistory: defineTable({
    queryId: v.string(),
    userId: v.string(),
    role: v.optional(v.union(v.literal("driver"), v.literal("fleet_manager"), v.literal("caas"))),
    message: v.string(),
    response: v.optional(v.string()),
    visualizationType: v.optional(v.string()),
    status: v.union(v.literal("success"), v.literal("error")),
    errorMessage: v.optional(v.string()),
    queriesRun: v.optional(v.array(v.any())),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_queryId", ["queryId"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  queryResponseErrors: defineTable({
    errorId: v.string(),
    queryId: v.optional(v.string()),
    userId: v.optional(v.string()),
    functionName: v.optional(v.string()),
    args: v.optional(v.any()),
    errorMessage: v.string(),
    errorKind: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_errorId", ["errorId"])
    .index("by_queryId", ["queryId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  userFleets: defineTable({
    userId: v.string(),
    fleetId: v.string(),
    name: v.string(),
    companyName: v.optional(v.string()),
    dotNumber: v.optional(v.string()),
    homeBase: v.optional(v.object({ lat: v.number(), lng: v.number(), label: v.optional(v.string()) })),
    vehicleCount: v.optional(v.number()),
    driverCount: v.optional(v.number()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_fleetId", ["fleetId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  userRoutes: defineTable({
    userId: v.string(),
    routeId: v.string(),
    fleetId: v.optional(v.string()),
    name: v.string(),
    origin: v.object({ label: v.string(), lat: v.optional(v.number()), lng: v.optional(v.number()) }),
    destination: v.object({ label: v.string(), lat: v.optional(v.number()), lng: v.optional(v.number()) }),
    waypoints: v.array(v.object({ lat: v.number(), lng: v.number(), label: v.optional(v.string()) })),
    assignedDriverIds: v.optional(v.array(v.string())),
    assignedTruckSlugs: v.optional(v.array(v.string())),
    status: v.union(v.literal("draft"), v.literal("planned"), v.literal("active"), v.literal("completed"), v.literal("archived")),
    schedule: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_routeId", ["routeId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"])
    .index("by_fleetId", ["fleetId"]),

  // Persistent provider geometry. PTV rows are authoritative for 90 days;
  // enrichment snapshots intentionally live outside this table so they can
  // refresh without purchasing another route pull.
  routeGeometries: defineTable({
    requestHash: v.string(),
    provider: v.union(
      v.literal("ptv"),
      v.literal("google"),
      v.literal("valhalla"),
      v.literal("mock"),
    ),
    origin: v.object({ latitude: v.number(), longitude: v.number() }),
    destination: v.object({ latitude: v.number(), longitude: v.number() }),
    waypoints: v.array(
      v.object({ latitude: v.number(), longitude: v.number() }),
    ),
    coordinates: v.array(
      v.object({ latitude: v.number(), longitude: v.number() }),
    ),
    distanceMeters: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    encodedPolyline: v.optional(v.string()),
    warnings: v.array(v.string()),
    providerMetadata: v.optional(v.any()),
    pulledAt: v.number(),
    expiresAt: v.number(),
    refreshLeaseUntil: v.optional(v.number()),
    refreshState: v.union(
      v.literal("fresh"),
      v.literal("refreshing"),
      v.literal("failed"),
    ),
    lastRefreshAttemptAt: v.optional(v.number()),
    lastRefreshError: v.optional(v.string()),
    accessCount: v.number(),
    refreshCount: v.number(),
    lastAccessedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_requestHash", ["requestHash"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_refreshState", ["refreshState"]),

  // Independently freshened route intelligence. The requestHash references the
  // authoritative road geometry above; snapshots never duplicate or mutate the
  // 90-day provider geometry lifecycle.
  routeEnrichments: defineTable({
    requestHash: v.string(),
    snapshot: v.optional(v.any()),
    computedAt: v.number(),
    expiresAt: v.number(),
    refreshLeaseUntil: v.optional(v.number()),
    refreshState: v.union(
      v.literal("fresh"),
      v.literal("refreshing"),
      v.literal("failed"),
    ),
    lastRefreshAttemptAt: v.optional(v.number()),
    lastRefreshError: v.optional(v.string()),
    accessCount: v.number(),
    refreshCount: v.number(),
    lastAccessedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_requestHash", ["requestHash"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_refreshState", ["refreshState"]),

  // Last successful map-workbench Calculate runs (driver / fleet / caas).
  // Used to restore route geometry + draft on "Start Day Plan" for returning users.
  workbenchRuns: defineTable({
    userId: v.string(),
    mode: v.union(
      v.literal("driver_day_plan"),
      v.literal("fleet_contract_plan"),
      v.literal("caas_gap_map"),
    ),
    origin: v.object({
      label: v.string(),
      latitude: v.number(),
      longitude: v.number(),
      kind: v.optional(v.string()),
      source: v.optional(v.string()),
      id: v.optional(v.string()),
    }),
    destination: v.object({
      label: v.string(),
      latitude: v.number(),
      longitude: v.number(),
      kind: v.optional(v.string()),
      source: v.optional(v.string()),
      id: v.optional(v.string()),
    }),
    routeGeometry: v.optional(v.any()),
    resultCards: v.optional(v.any()),
    providerWarnings: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_userId_mode_createdAt", ["userId", "mode", "createdAt"]),

  // ── Geo enrichment: air districts + zip codes on geoRegions (P-ROLES) ──────
  // geoRegions gains optional airDistrict + zipCodes fields so CaaS deployment
  // zones can reference finer-grained geographic context than nation/state/county.
  // All additive — existing rows stay valid.
});
