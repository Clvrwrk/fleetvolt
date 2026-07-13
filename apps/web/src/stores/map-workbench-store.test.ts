import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  DEFAULT_WORKBENCH_MODE,
  WORKBENCH_MODE_CONFIG,
} from "../components/workbench/map-workbench/mode-config";
import { useMapWorkbenchStore } from "./map-workbench-store";

describe("useMapWorkbenchStore", () => {
  beforeEach(() => {
    useMapWorkbenchStore.getState().reset();
  });

  it("starts with deterministic driver defaults", () => {
    const state = useMapWorkbenchStore.getState();

    assert.equal(state.mode, DEFAULT_WORKBENCH_MODE);
    assert.deepEqual(state.activeLayers, [
      "route",
      "chargers",
      "parking",
      "pois",
    ]);
    assert.deepEqual(state.draft, WORKBENCH_MODE_CONFIG.driver_day_plan.defaultDraft);
    assert.equal(state.selectedAsset, null);
    assert.equal(state.routeGeometry, null);
    assert.deepEqual(state.resultCards, []);
    assert.deepEqual(state.providerWarnings, []);
  });

  it("resets mode-specific defaults", () => {
    useMapWorkbenchStore.getState().reset("fleet_contract_plan");

    const state = useMapWorkbenchStore.getState();
    assert.equal(state.mode, "fleet_contract_plan");
    assert.deepEqual(
      state.activeLayers,
      WORKBENCH_MODE_CONFIG.fleet_contract_plan.defaultLayers,
    );
    assert.deepEqual(state.draft, WORKBENCH_MODE_CONFIG.fleet_contract_plan.defaultDraft);
  });

  it("uses CaaS gap map defaults", () => {
    useMapWorkbenchStore.getState().reset("caas_gap_map");

    const state = useMapWorkbenchStore.getState();
    assert.equal(state.mode, "caas_gap_map");
    assert.equal(state.caasPhase, "freight_overview");
    assert.equal(state.caasGeoLevel, "air-district");
    assert.ok(state.activeLayers.includes("freight-flow"));
    assert.ok(state.activeLayers.includes("geo-regions"));
    assert.ok(state.activeLayers.includes("ports"));
    assert.ok(state.activeLayers.includes("chargers"));
    assert.ok(state.activeLayers.includes("carriers"));
  });

  it("CaaS route analysis fits corridor and keeps statewide overlays", () => {
    useMapWorkbenchStore.getState().reset("caas_gap_map");
    useMapWorkbenchStore.getState().applyDraftPatch({
      origin: {
        id: "polb",
        label: "Port of Long Beach",
        latitude: 33.7542,
        longitude: -118.2165,
        kind: "port",
        source: "fleetvolt",
      },
      destination: {
        id: "otay",
        label: "Otay Mesa",
        latitude: 32.555,
        longitude: -116.938,
        kind: "manual",
        source: "manual",
      },
    });
    useMapWorkbenchStore.getState().setCaasPhase("route_analysis");

    const state = useMapWorkbenchStore.getState();
    assert.equal(state.caasPhase, "route_analysis");
    assert.ok(state.activeLayers.includes("route"));
    assert.ok(state.activeLayers.includes("class8-gaps"));
    assert.ok(state.activeLayers.includes("geo-regions"));
    assert.ok(state.activeLayers.includes("freight-flow"));
    assert.ok(state.activeLayers.includes("chargers"));
    assert.ok(state.activeLayers.includes("parking"));
    assert.ok(state.activeLayers.includes("carriers"));
    assert.ok(state.focusBounds);
    assert.ok(state.focusBounds!.south < 32.555);
    assert.ok(state.focusBounds!.north > 33.7542);
  });

  it("toggles layers without mutating default mode config", () => {
    const store = useMapWorkbenchStore.getState();

    store.toggleLayer("parking");
    assert.deepEqual(useMapWorkbenchStore.getState().activeLayers, [
      "route",
      "chargers",
      "pois",
    ]);

    useMapWorkbenchStore.getState().toggleLayer("parking");
    assert.deepEqual(useMapWorkbenchStore.getState().activeLayers, [
      "route",
      "chargers",
      "parking",
      "pois",
    ]);
    assert.deepEqual(WORKBENCH_MODE_CONFIG.driver_day_plan.defaultLayers, [
      "route",
      "chargers",
      "parking",
      "pois",
    ]);
  });

  it("applies draft patches while preserving existing fields", () => {
    const origin = {
      id: "polb",
      label: "Port of Long Beach",
      latitude: 33.7542,
      longitude: -118.2165,
      kind: "port" as const,
      source: "fleetvolt" as const,
    };
    const destination = {
      label: "Cajon Pass",
      latitude: 34.3133,
      longitude: -117.4747,
      kind: "address" as const,
      source: "manual" as const,
    };

    useMapWorkbenchStore.getState().applyDraftPatch({
      origin,
      vehicleClass: "Class 8 drayage",
    });
    useMapWorkbenchStore.getState().applyDraftPatch({ destination });

    assert.deepEqual(useMapWorkbenchStore.getState().draft, {
      origin,
      destination,
      vehicleClass: "Class 8 drayage",
    });
  });

  it("selects and clears assets", () => {
    const selection = {
      id: "charger-1",
      type: "charger" as const,
      label: "Depot Charger 1",
      layerId: "chargers" as const,
      latitude: 33.8,
      longitude: -118.1,
      metadata: { plugs: 6 },
    };

    useMapWorkbenchStore.getState().selectAsset(selection);
    assert.deepEqual(useMapWorkbenchStore.getState().selectedAsset, selection);

    useMapWorkbenchStore.getState().selectAsset(null);
    assert.equal(useMapWorkbenchStore.getState().selectedAsset, null);
  });

  it("toggles the same asset off on second select", () => {
    const selection = {
      id: "charger-2",
      type: "charger" as const,
      label: "Ontario plaza",
      layerId: "chargers" as const,
      latitude: 34.05,
      longitude: -117.65,
    };

    useMapWorkbenchStore.getState().selectAsset(selection);
    assert.equal(useMapWorkbenchStore.getState().selectedAsset?.id, "charger-2");

    useMapWorkbenchStore.getState().selectAsset(selection);
    assert.equal(useMapWorkbenchStore.getState().selectedAsset, null);
  });

  it("applies AI map actions and cards without inventing metrics", () => {
    const origin = {
      id: "polb",
      label: "Port of Long Beach",
      latitude: 33.7542,
      longitude: -118.2165,
      kind: "port" as const,
      source: "fleetvolt" as const,
    };
    const destination = {
      label: "Barstow",
      latitude: 34.8958,
      longitude: -117.0173,
      kind: "manual" as const,
      source: "manual" as const,
    };

    useMapWorkbenchStore.getState().applyAiResult({
      id: "wbai_test",
      mode: "driver_day_plan",
      answerSummary: "Drafted POLB → Barstow.",
      draftPatch: { origin, destination, notes: "AI draft" },
      mapActions: [
        { type: "set_origin", place: origin },
        { type: "set_destination", place: destination },
        { type: "set_layers", layers: ["route", "chargers", "parking"] },
        {
          type: "focus_bounds",
          bounds: { north: 35, south: 33, east: -117, west: -119 },
        },
      ],
      cards: [
        {
          id: "ai-card",
          title: "Route draft",
          summary: "Origin and destination set.",
          severity: "success",
          layerId: "route",
        },
      ],
      queriesRun: [],
      fallback: false,
      providerWarnings: ["Google route geometry is advisory."],
    });

    const state = useMapWorkbenchStore.getState();
    assert.equal(state.draft.origin?.label, "Port of Long Beach");
    assert.equal(state.draft.destination?.label, "Barstow");
    assert.deepEqual(state.activeLayers, ["route", "chargers", "parking"]);
    assert.equal(state.resultCards[0]?.id, "ai-card");
    assert.equal(state.lastAiSummary, "Drafted POLB → Barstow.");
    assert.deepEqual(state.focusBounds, {
      north: 35,
      south: 33,
      east: -117,
      west: -119,
    });
    assert.ok(state.providerWarnings.some((w) => /advisory/i.test(w)));
  });

  it("ignores unknown AI map action types", () => {
    useMapWorkbenchStore.getState().applyAiResult({
      id: "wbai_bad",
      mode: "driver_day_plan",
      answerSummary: "Ignored bad action",
      mapActions: [{ type: "drop_table" } as never],
      cards: [],
      queriesRun: [],
      fallback: true,
    });

    assert.deepEqual(useMapWorkbenchStore.getState().activeLayers, [
      "route",
      "chargers",
      "parking",
      "pois",
    ]);
  });

  it("does not leave CaaS freight overview on origin-only AI draft", () => {
    useMapWorkbenchStore.getState().reset("caas_gap_map");
    assert.equal(useMapWorkbenchStore.getState().caasPhase, "freight_overview");

    useMapWorkbenchStore.getState().applyAiResult({
      id: "wbai_origin_only",
      mode: "caas_gap_map",
      answerSummary: "Set origin only",
      draftPatch: {
        origin: {
          id: "polb",
          label: "Port of Long Beach",
          latitude: 33.7542,
          longitude: -118.2165,
          kind: "port",
          source: "fleetvolt",
        },
        notes: "notes-only should not advance phase",
      },
      mapActions: [],
      cards: [],
      queriesRun: [],
      fallback: true,
    });

    assert.equal(useMapWorkbenchStore.getState().caasPhase, "freight_overview");
  });

  it("advances CaaS to route analysis when AI drafts both endpoints", () => {
    useMapWorkbenchStore.getState().reset("caas_gap_map");

    useMapWorkbenchStore.getState().applyAiResult({
      id: "wbai_full_route",
      mode: "caas_gap_map",
      answerSummary: "Drafted POLB → Barstow",
      draftPatch: {
        origin: {
          id: "polb",
          label: "Port of Long Beach",
          latitude: 33.7542,
          longitude: -118.2165,
          kind: "port",
          source: "fleetvolt",
        },
        destination: {
          label: "Barstow",
          latitude: 34.8958,
          longitude: -117.0173,
          kind: "manual",
          source: "manual",
        },
      },
      mapActions: [],
      cards: [],
      queriesRun: [],
      fallback: true,
    });

    assert.equal(useMapWorkbenchStore.getState().caasPhase, "route_analysis");
  });
});
