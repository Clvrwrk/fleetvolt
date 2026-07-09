/**
 * Workbench AI action — wraps grounded planner discipline and returns
 * map-first WorkbenchAiResult (draft patches, map actions, cards).
 *
 * Prose is secondary. Query errors are humanized (no raw Convex paths).
 */

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";

type WorkbenchMode = "driver_day_plan" | "fleet_contract_plan" | "caas_gap_map";
type PlannerRole = "driver" | "fleet_manager" | "caas";

type WorkbenchPlace = {
  id?: string;
  label: string;
  latitude: number;
  longitude: number;
  kind: string;
  source: string;
  address?: string;
  metadata?: Record<string, unknown>;
};

type WorkbenchLayerId =
  | "route"
  | "chargers"
  | "parking"
  | "pois"
  | "fleet-yards"
  | "highways"
  | "geo-regions"
  | "class8-gaps"
  | "carriers"
  | "freight-flow"
  | "caas-zones";

type WorkbenchMapAction =
  | { type: "set_origin"; place: WorkbenchPlace }
  | { type: "set_destination"; place: WorkbenchPlace }
  | { type: "toggle_layer"; layer: WorkbenchLayerId; enabled: boolean }
  | {
      type: "focus_bounds";
      bounds: { north: number; south: number; east: number; west: number };
    }
  | {
      type: "select_asset";
      selection: {
        id: string;
        type: string;
        label: string;
        layerId: WorkbenchLayerId;
        latitude?: number;
        longitude?: number;
        metadata?: Record<string, unknown>;
      };
    }
  | { type: "set_layers"; layers: WorkbenchLayerId[] };

type WorkbenchResultCard = {
  id: string;
  title: string;
  summary: string;
  mode?: WorkbenchMode;
  severity?: "info" | "success" | "warning" | "critical";
  layerId?: WorkbenchLayerId;
  metrics?: Record<string, number | string | null>;
};

type WorkbenchAiQueryRun = {
  name: string;
  args: Record<string, unknown>;
  resultSummary: string;
};

export type WorkbenchAiResult = {
  id: string;
  mode: WorkbenchMode;
  answerSummary: string;
  draftPatch?: {
    origin?: WorkbenchPlace | null;
    destination?: WorkbenchPlace | null;
    waypoints?: WorkbenchPlace[];
    vehicleClass?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
  };
  mapActions: WorkbenchMapAction[];
  cards: WorkbenchResultCard[];
  queriesRun: WorkbenchAiQueryRun[];
  fallback: boolean;
  error?: string | null;
  model?: string;
  providerWarnings?: string[];
};

const LAYER_IDS = new Set<WorkbenchLayerId>([
  "route",
  "chargers",
  "parking",
  "pois",
  "fleet-yards",
  "highways",
  "geo-regions",
  "class8-gaps",
  "carriers",
  "freight-flow",
  "caas-zones",
]);

const POLB: WorkbenchPlace = {
  id: "polb",
  label: "Port of Long Beach",
  latitude: 33.7542,
  longitude: -118.2165,
  kind: "port",
  source: "fleetvolt",
};

const BARSTOW: WorkbenchPlace = {
  label: "Barstow",
  latitude: 34.8958,
  longitude: -117.0173,
  kind: "manual",
  source: "manual",
};

const OAKLAND: WorkbenchPlace = {
  label: "Port of Oakland",
  latitude: 37.7955,
  longitude: -122.2793,
  kind: "port",
  source: "fleetvolt",
};

const TRACY: WorkbenchPlace = {
  label: "Tracy",
  latitude: 37.7397,
  longitude: -121.4252,
  kind: "manual",
  source: "manual",
};

function modeToRole(mode: WorkbenchMode): PlannerRole {
  if (mode === "fleet_contract_plan") return "fleet_manager";
  if (mode === "caas_gap_map") return "caas";
  return "driver";
}

function isLayerId(value: string): value is WorkbenchLayerId {
  return LAYER_IDS.has(value as WorkbenchLayerId);
}

function humanizeInternalPath(text: string): string {
  return text
    .replace(/[a-zA-Z0-9_./-]+:[a-zA-Z0-9_]+/g, "a data lookup")
    .replace(/convex\/[^\s]+/gi, "the planning service")
    .replace(/apps\/web\/[^\s]+/gi, "the planning service");
}

function boundsForPlaces(a: WorkbenchPlace, b: WorkbenchPlace) {
  return {
    north: Math.max(a.latitude, b.latitude) + 0.35,
    south: Math.min(a.latitude, b.latitude) - 0.35,
    east: Math.max(a.longitude, b.longitude) + 0.35,
    west: Math.min(a.longitude, b.longitude) - 0.35,
  };
}

function detectExampleIntent(message: string, mode: WorkbenchMode): "driver" | "fleet" | "caas" | null {
  const lower = message.toLowerCase();
  if (
    mode === "driver_day_plan" &&
    (lower.includes("day plan") ||
      lower.includes("polb") ||
      lower.includes("barstow") ||
      lower.includes("route draft") ||
      lower.includes("charge"))
  ) {
    return "driver";
  }
  if (
    mode === "fleet_contract_plan" &&
    (lower.includes("contract") ||
      lower.includes("containers") ||
      lower.includes("assumption") ||
      lower.includes("trucks required") ||
      lower.includes("oakland"))
  ) {
    return "fleet";
  }
  if (
    mode === "caas_gap_map" &&
    (lower.includes("gap") ||
      lower.includes("carrier") ||
      lower.includes("toggle") ||
      lower.includes("opportunity") ||
      lower.includes("layer"))
  ) {
    return "caas";
  }
  return null;
}

function buildDriverExample(message: string): WorkbenchAiResult {
  const draftPatch = {
    origin: POLB,
    destination: BARSTOW,
    vehicleClass: "Class 8 drayage",
    notes: "AI draft: POLB → Barstow day plan",
    metadata: {
      truckSlug: "ecascadia_438",
      roundTrips: 2,
      source: "workbench/ai:driver_example",
    },
  };
  const mapActions: WorkbenchMapAction[] = [
    { type: "set_origin", place: POLB },
    { type: "set_destination", place: BARSTOW },
    { type: "set_layers", layers: ["route", "chargers", "parking", "pois"] },
    { type: "toggle_layer", layer: "chargers", enabled: true },
    { type: "focus_bounds", bounds: boundsForPlaces(POLB, BARSTOW) },
  ];
  const cards: WorkbenchResultCard[] = [
    {
      id: "ai-driver-route-draft",
      title: "Route draft applied",
      summary:
        "Origin and destination set to POLB → Barstow. Run Calculate day plan for physics-backed feasibility and charge stops.",
      mode: "driver_day_plan",
      severity: "success",
      layerId: "route",
      metrics: { origin: POLB.label, destination: BARSTOW.label, roundTrips: 2 },
    },
    {
      id: "ai-driver-charger-layer",
      title: "Charger layer ready",
      summary:
        "Class-8 charger and parking layers are active. Site access details stay labeled unavailable unless sourced.",
      mode: "driver_day_plan",
      severity: "info",
      layerId: "chargers",
    },
  ];
  return {
    id: `wbai_driver_${Date.now()}`,
    mode: "driver_day_plan",
    answerSummary:
      "Drafted a POLB → Barstow day-plan route and enabled charger/parking layers. Prose is secondary — use the cards and map actions.",
    draftPatch,
    mapActions,
    cards,
    queriesRun: [
      {
        name: "workbench/ai:example",
        args: { message, mode: "driver_day_plan" },
        resultSummary: "Deterministic driver route draft (no fabricated energy numbers)",
      },
    ],
    fallback: false,
    model: "workbench-example",
    providerWarnings: [
      "Google route geometry is advisory until Class-8 truck routing validation is connected.",
    ],
  };
}

function buildFleetExample(message: string): WorkbenchAiResult {
  const draftPatch = {
    origin: OAKLAND,
    destination: TRACY,
    vehicleClass: "Class 8 fleet",
    notes: "AI draft: Oakland → Tracy contract assumptions",
    metadata: {
      truckSlug: "ecascadia_438",
      containersPerDay: 12,
      gateStartHour: 6,
      gateEndHour: 17,
      shiftHours: 10,
      source: "workbench/ai:fleet_example",
    },
  };
  const mapActions: WorkbenchMapAction[] = [
    { type: "set_origin", place: OAKLAND },
    { type: "set_destination", place: TRACY },
    {
      type: "set_layers",
      layers: ["route", "chargers", "fleet-yards", "pois", "highways"],
    },
    { type: "focus_bounds", bounds: boundsForPlaces(OAKLAND, TRACY) },
  ];
  const cards: WorkbenchResultCard[] = [
    {
      id: "ai-fleet-assumptions",
      title: "Contract assumptions applied",
      summary:
        "Port/origin, inland destination, and schedule assumptions are drafted. Run Calculate contract plan for trucks/drivers and charge events.",
      mode: "fleet_contract_plan",
      severity: "success",
      layerId: "route",
      metrics: {
        containersPerDay: 12,
        gateHours: "6–17",
        formula: "trucks = ceil(containers/day ÷ trips/truck/day)",
      },
    },
    {
      id: "ai-fleet-layers",
      title: "Fleet layers ready",
      summary:
        "Route, chargers, fleet yards, POIs, and highways are active for contract scoping.",
      mode: "fleet_contract_plan",
      severity: "info",
      layerId: "fleet-yards",
    },
  ];
  return {
    id: `wbai_fleet_${Date.now()}`,
    mode: "fleet_contract_plan",
    answerSummary:
      "Applied Oakland → Tracy contract assumptions and fleet map layers. Cards lead; prose is secondary.",
    draftPatch,
    mapActions,
    cards,
    queriesRun: [
      {
        name: "workbench/ai:example",
        args: { message, mode: "fleet_contract_plan" },
        resultSummary: "Deterministic fleet contract draft (no fabricated fleet counts)",
      },
    ],
    fallback: false,
    model: "workbench-example",
    providerWarnings: [
      "Fleet sizing numbers require Calculate contract plan — AI does not invent truck/driver counts.",
    ],
  };
}

function buildCaasExample(message: string): WorkbenchAiResult {
  const mapActions: WorkbenchMapAction[] = [
    {
      type: "set_layers",
      layers: [
        "ports",
        "freight-flow",
        "geo-regions",
        "class8-gaps",
        "carriers",
        "parking",
        "caas-zones",
      ],
    },
    { type: "toggle_layer", layer: "class8-gaps", enabled: true },
    { type: "toggle_layer", layer: "carriers", enabled: true },
    // Keep west-coast freight overview — do not zoom to CONUS for layer toggles.
    {
      type: "focus_bounds",
      bounds: { north: 42.2, south: 31.8, east: -114.0, west: -125.0 },
    },
  ];
  const cards: WorkbenchResultCard[] = [
    {
      id: "ai-caas-layers",
      title: "Gap and carrier layers toggled",
      summary:
        "Class-8 gap and carrier layers are on. Select origin + destination for route gap analysis, or click a geo region to drill down.",
      mode: "caas_gap_map",
      severity: "success",
      layerId: "class8-gaps",
      metrics: {
        layers: "class8-gaps + carriers",
        detourTime: "unavailable unless provider data exists",
      },
    },
    {
      id: "ai-caas-next",
      title: "Next: route endpoints",
      summary:
        "True vs detour-solvable gap classification runs when both endpoints are set. Detour/CO2 stay labeled unavailable if not sourced.",
      mode: "caas_gap_map",
      severity: "info",
      layerId: "carriers",
    },
  ];
  return {
    id: `wbai_caas_${Date.now()}`,
    mode: "caas_gap_map",
    answerSummary:
      "Toggled Class-8 gap and carrier layers on the opportunity map. Cards and map actions lead; prose is secondary.",
    draftPatch: {
      notes: "AI: focus gap + carrier layers",
      metadata: { source: "workbench/ai:caas_example" },
    },
    mapActions,
    cards,
    queriesRun: [
      {
        name: "workbench/ai:example",
        args: { message, mode: "caas_gap_map" },
        resultSummary: "Deterministic CaaS layer toggles (no fabricated gap counts)",
      },
    ],
    fallback: false,
    model: "workbench-example",
    providerWarnings: [
      "US-wide CaaS map uses geoRegion centroid/bbox MVP; polygon geometries are deferred.",
    ],
  };
}

function cardsFromPlannerAnswer(
  mode: WorkbenchMode,
  answer: string,
  visualizationType: string,
): WorkbenchResultCard[] {
  const summary = answer
    .replace(/^#+\s*/gm, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
  const short = summary.slice(0, 280) || "Grounded planner response ready.";
  const layer: WorkbenchLayerId =
    mode === "caas_gap_map"
      ? "class8-gaps"
      : mode === "fleet_contract_plan"
        ? "route"
        : "chargers";
  return [
    {
      id: `ai-planner-${mode}`,
      title:
        visualizationType === "heatmap"
          ? "Gap / heatmap insight"
          : visualizationType === "route_map"
            ? "Route insight"
            : "Planning insight",
      summary: short,
      mode,
      severity: "info",
      layerId: layer,
    },
  ];
}

function mapActionsFromMode(mode: WorkbenchMode): WorkbenchMapAction[] {
  if (mode === "caas_gap_map") {
    return [
      { type: "toggle_layer", layer: "class8-gaps", enabled: true },
      { type: "toggle_layer", layer: "carriers", enabled: true },
    ];
  }
  if (mode === "fleet_contract_plan") {
    return [
      { type: "toggle_layer", layer: "route", enabled: true },
      { type: "toggle_layer", layer: "chargers", enabled: true },
      { type: "toggle_layer", layer: "fleet-yards", enabled: true },
    ];
  }
  return [
    { type: "toggle_layer", layer: "route", enabled: true },
    { type: "toggle_layer", layer: "chargers", enabled: true },
    { type: "toggle_layer", layer: "parking", enabled: true },
  ];
}

function sanitizeMapActions(actions: unknown): WorkbenchMapAction[] {
  if (!Array.isArray(actions)) return [];
  const out: WorkbenchMapAction[] = [];
  for (const raw of actions) {
    if (!raw || typeof raw !== "object") continue;
    const action = raw as Record<string, unknown>;
    const type = action.type;
    if (type === "toggle_layer" && typeof action.layer === "string" && isLayerId(action.layer)) {
      out.push({
        type: "toggle_layer",
        layer: action.layer,
        enabled: action.enabled !== false,
      });
      continue;
    }
    if (type === "set_layers" && Array.isArray(action.layers)) {
      const layers = action.layers.filter(
        (layer): layer is WorkbenchLayerId => typeof layer === "string" && isLayerId(layer),
      );
      if (layers.length > 0) out.push({ type: "set_layers", layers });
      continue;
    }
    if (
      (type === "set_origin" || type === "set_destination") &&
      action.place &&
      typeof action.place === "object"
    ) {
      const place = action.place as Record<string, unknown>;
      if (
        typeof place.label === "string" &&
        typeof place.latitude === "number" &&
        typeof place.longitude === "number"
      ) {
        const normalized: WorkbenchPlace = {
          id: typeof place.id === "string" ? place.id : undefined,
          label: place.label,
          latitude: place.latitude,
          longitude: place.longitude,
          kind: typeof place.kind === "string" ? place.kind : "manual",
          source: typeof place.source === "string" ? place.source : "manual",
          address: typeof place.address === "string" ? place.address : undefined,
        };
        out.push(
          type === "set_origin"
            ? { type: "set_origin", place: normalized }
            : { type: "set_destination", place: normalized },
        );
      }
    }
  }
  return out;
}

const placeValidator = v.object({
  id: v.optional(v.string()),
  label: v.string(),
  latitude: v.number(),
  longitude: v.number(),
  kind: v.string(),
  source: v.string(),
  address: v.optional(v.string()),
  metadata: v.optional(v.any()),
});

const mapActionValidator = v.union(
  v.object({ type: v.literal("set_origin"), place: placeValidator }),
  v.object({ type: v.literal("set_destination"), place: placeValidator }),
  v.object({
    type: v.literal("toggle_layer"),
    layer: v.string(),
    enabled: v.boolean(),
  }),
  v.object({
    type: v.literal("focus_bounds"),
    bounds: v.object({
      north: v.number(),
      south: v.number(),
      east: v.number(),
      west: v.number(),
    }),
  }),
  v.object({
    type: v.literal("select_asset"),
    selection: v.object({
      id: v.string(),
      type: v.string(),
      label: v.string(),
      layerId: v.string(),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      metadata: v.optional(v.any()),
    }),
  }),
  v.object({ type: v.literal("set_layers"), layers: v.array(v.string()) }),
);

const cardValidator = v.object({
  id: v.string(),
  title: v.string(),
  summary: v.string(),
  mode: v.optional(
    v.union(
      v.literal("driver_day_plan"),
      v.literal("fleet_contract_plan"),
      v.literal("caas_gap_map"),
    ),
  ),
  severity: v.optional(
    v.union(
      v.literal("info"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("critical"),
    ),
  ),
  layerId: v.optional(v.string()),
  metrics: v.optional(v.record(v.string(), v.union(v.number(), v.string(), v.null()))),
});

const workbenchAiResultValidator = v.object({
  id: v.string(),
  mode: v.union(
    v.literal("driver_day_plan"),
    v.literal("fleet_contract_plan"),
    v.literal("caas_gap_map"),
  ),
  answerSummary: v.string(),
  draftPatch: v.optional(
    v.object({
      origin: v.optional(v.union(placeValidator, v.null())),
      destination: v.optional(v.union(placeValidator, v.null())),
      waypoints: v.optional(v.array(placeValidator)),
      vehicleClass: v.optional(v.string()),
      notes: v.optional(v.string()),
      metadata: v.optional(v.any()),
    }),
  ),
  mapActions: v.array(mapActionValidator),
  cards: v.array(cardValidator),
  queriesRun: v.array(
    v.object({
      name: v.string(),
      args: v.any(),
      resultSummary: v.string(),
    }),
  ),
  fallback: v.boolean(),
  error: v.optional(v.union(v.string(), v.null())),
  model: v.optional(v.string()),
  providerWarnings: v.optional(v.array(v.string())),
});

/**
 * Map-first AI for the workbench. Prefer deterministic mode examples for
 * common prompts; otherwise wrap planWithAi and project into WorkbenchAiResult.
 */
export const workbenchPlanWithAi = action({
  args: {
    message: v.string(),
    mode: v.union(
      v.literal("driver_day_plan"),
      v.literal("fleet_contract_plan"),
      v.literal("caas_gap_map"),
    ),
    context: v.optional(v.string()),
  },
  returns: workbenchAiResultValidator,
  handler: async (ctx, { message, mode, context }): Promise<WorkbenchAiResult> => {
    const trimmed = message.trim();
    if (!trimmed) {
      return {
        id: `wbai_empty_${Date.now()}`,
        mode,
        answerSummary: "Enter a short planning command to update the map and cards.",
        mapActions: [],
        cards: [
          {
            id: "ai-empty",
            title: "Waiting for a command",
            summary:
              "Try: “Draft POLB to Barstow day plan”, “Apply Oakland contract assumptions”, or “Toggle gap and carrier layers”.",
            mode,
            severity: "info",
          },
        ],
        queriesRun: [],
        fallback: true,
        error: null,
        model: "workbench-empty",
      };
    }

    const example = detectExampleIntent(trimmed, mode);
    if (example === "driver") return buildDriverExample(trimmed);
    if (example === "fleet") return buildFleetExample(trimmed);
    if (example === "caas") return buildCaasExample(trimmed);

    try {
      const plannerResult = await ctx.runAction(api.planner.planWithAi, {
        message: trimmed,
        role: modeToRole(mode),
        context,
      });

      const answerSummary = humanizeInternalPath(
        (plannerResult.answer ?? "")
          .replace(/^#+\s*/gm, "")
          .split("\n")
          .map((line: string) => line.trim())
          .filter(Boolean)[0] ?? "Grounded planning response ready.",
      ).slice(0, 320);

      const queriesRun: WorkbenchAiQueryRun[] = (plannerResult.queries_run ?? []).map(
        (run: { name: string; args: Record<string, unknown>; result_summary: string }) => ({
          name: run.name,
          args: run.args,
          resultSummary: humanizeInternalPath(run.result_summary),
        }),
      );

      const errorFromQueries = queriesRun.find((run) =>
        run.resultSummary.toLowerCase().startsWith("error:"),
      )?.resultSummary;

      return {
        id: `wbai_${Date.now()}`,
        mode,
        answerSummary,
        draftPatch: undefined,
        mapActions: mapActionsFromMode(mode),
        cards: cardsFromPlannerAnswer(
          mode,
          humanizeInternalPath(plannerResult.answer ?? ""),
          plannerResult.visualization?.type ?? "text",
        ),
        queriesRun,
        fallback: Boolean(plannerResult.fallback),
        error: errorFromQueries
          ? humanizeInternalPath(errorFromQueries.replace(/^ERROR:\s*/i, ""))
          : null,
        model: plannerResult.model,
        providerWarnings: [
          "AI cards summarize grounded query results; map geometry still requires Calculate or route endpoints.",
        ],
      };
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const human = humanizeInternalPath(raw).slice(0, 200);
      return {
        id: `wbai_err_${Date.now()}`,
        mode,
        answerSummary: "I couldn't complete that planning command right now.",
        mapActions: [],
        cards: [
          {
            id: "ai-error",
            title: "Planning command unavailable",
            summary: human,
            mode,
            severity: "critical",
          },
        ],
        queriesRun: [],
        fallback: true,
        error: human,
        model: "fallback",
      };
    }
  },
});

/** Allowlisted action types for client validation helpers / tests */
export function isAllowedMapActionType(type: string): boolean {
  return (
    type === "set_origin" ||
    type === "set_destination" ||
    type === "toggle_layer" ||
    type === "focus_bounds" ||
    type === "select_asset" ||
    type === "set_layers"
  );
}

export { sanitizeMapActions };
