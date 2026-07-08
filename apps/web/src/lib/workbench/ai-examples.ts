import type {
  WorkbenchAiResult,
  WorkbenchMode,
  WorkbenchPlace,
} from "@/components/workbench/map-workbench/types";

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

function bounds(a: WorkbenchPlace, b: WorkbenchPlace) {
  return {
    north: Math.max(a.latitude, b.latitude) + 0.35,
    south: Math.min(a.latitude, b.latitude) - 0.35,
    east: Math.max(a.longitude, b.longitude) + 0.35,
    west: Math.min(a.longitude, b.longitude) - 0.35,
  };
}

/** Deterministic map-first examples used when Convex AI is unavailable. */
export function localWorkbenchAiExample(
  message: string,
  mode: WorkbenchMode,
): WorkbenchAiResult | null {
  const lower = message.toLowerCase();

  if (
    mode === "driver_day_plan" &&
    (lower.includes("polb") || lower.includes("barstow") || lower.includes("day plan") || lower.includes("draft"))
  ) {
    return {
      id: `wbai_local_driver_${Date.now()}`,
      mode,
      answerSummary:
        "Drafted a POLB → Barstow day-plan route and enabled charger/parking layers. Prose is secondary — use the cards and map actions.",
      draftPatch: {
        origin: POLB,
        destination: BARSTOW,
        vehicleClass: "Class 8 drayage",
        notes: "AI draft: POLB → Barstow day plan",
        metadata: { truckSlug: "ecascadia_438", roundTrips: 2, source: "local-ai-example" },
      },
      mapActions: [
        { type: "set_origin", place: POLB },
        { type: "set_destination", place: BARSTOW },
        { type: "set_layers", layers: ["route", "chargers", "parking", "pois"] },
        { type: "focus_bounds", bounds: bounds(POLB, BARSTOW) },
      ],
      cards: [
        {
          id: "ai-driver-route-draft",
          title: "Route draft applied",
          summary:
            "Origin and destination set to POLB → Barstow. Run Calculate day plan for physics-backed feasibility and charge stops.",
          mode,
          severity: "success",
          layerId: "route",
          metrics: { origin: POLB.label, destination: BARSTOW.label, roundTrips: 2 },
        },
        {
          id: "ai-driver-charger-layer",
          title: "Charger layer ready",
          summary:
            "Class-8 charger and parking layers are active. Site access details stay labeled unavailable unless sourced.",
          mode,
          severity: "info",
          layerId: "chargers",
        },
      ],
      queriesRun: [
        {
          name: "local/ai:example",
          args: { message, mode },
          resultSummary: "Client deterministic driver route draft",
        },
      ],
      fallback: true,
      model: "local-example",
      providerWarnings: [
        "Google route geometry is advisory until Class-8 truck routing validation is connected.",
      ],
    };
  }

  if (
    mode === "fleet_contract_plan" &&
    (lower.includes("oakland") || lower.includes("tracy") || lower.includes("contract") || lower.includes("assumption"))
  ) {
    return {
      id: `wbai_local_fleet_${Date.now()}`,
      mode,
      answerSummary:
        "Applied Oakland → Tracy contract assumptions and enabled yard/charger layers. Run Calculate for trucks/drivers.",
      draftPatch: {
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
          source: "local-ai-example",
        },
      },
      mapActions: [
        { type: "set_origin", place: OAKLAND },
        { type: "set_destination", place: TRACY },
        { type: "set_layers", layers: ["route", "chargers", "fleet-yards", "pois", "highways"] },
        { type: "focus_bounds", bounds: bounds(OAKLAND, TRACY) },
      ],
      cards: [
        {
          id: "ai-fleet-assumptions",
          title: "Contract assumptions applied",
          summary:
            "Port/origin, inland destination, and schedule assumptions are drafted. Run Calculate contract plan for trucks/drivers and charge events.",
          mode,
          severity: "success",
          layerId: "route",
          metrics: {
            containersPerDay: 12,
            gateHours: "6–17",
            formula: "trucks = ceil(containers/day ÷ trips/truck/day)",
          },
        },
      ],
      queriesRun: [
        {
          name: "local/ai:example",
          args: { message, mode },
          resultSummary: "Client deterministic fleet assumptions",
        },
      ],
      fallback: true,
      model: "local-example",
      providerWarnings: [
        "Fleet sizing numbers require Calculate; AI only drafts assumptions and layers.",
      ],
    };
  }

  if (
    mode === "caas_gap_map" &&
    (lower.includes("gap") || lower.includes("carrier") || lower.includes("toggle") || lower.includes("layer"))
  ) {
    return {
      id: `wbai_local_caas_${Date.now()}`,
      mode,
      answerSummary:
        "Enabled Class-8 gap and carrier layers for the opportunity map. Select origin/destination for route gap cards.",
      mapActions: [
        { type: "toggle_layer", layer: "class8-gaps", enabled: true },
        { type: "toggle_layer", layer: "carriers", enabled: true },
        {
          type: "set_layers",
          layers: ["geo-regions", "class8-gaps", "carriers", "parking", "freight-flow", "caas-zones"],
        },
      ],
      cards: [
        {
          id: "ai-caas-layers",
          title: "Gap and carrier layers on",
          summary:
            "Class-8 gaps and carriers are visible. Detour time and CO₂ remain labeled unavailable unless provider data exists.",
          mode,
          severity: "success",
          layerId: "class8-gaps",
          metrics: { detourTime: "unavailable", co2: "unavailable" },
        },
      ],
      queriesRun: [
        {
          name: "local/ai:example",
          args: { message, mode },
          resultSummary: "Client deterministic CaaS layer toggles",
        },
      ],
      fallback: true,
      model: "local-example",
    };
  }

  return null;
}
