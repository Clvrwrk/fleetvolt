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
    assert.deepEqual(state.activeLayers, [
      "route",
      "chargers",
      "fleet-yards",
      "pois",
      "highways",
    ]);
    assert.deepEqual(state.draft, WORKBENCH_MODE_CONFIG.fleet_contract_plan.defaultDraft);
  });

  it("uses CaaS gap map defaults", () => {
    useMapWorkbenchStore.getState().reset("caas_gap_map");

    const state = useMapWorkbenchStore.getState();
    assert.equal(state.mode, "caas_gap_map");
    assert.deepEqual(state.activeLayers, [
      "geo-regions",
      "class8-gaps",
      "carriers",
      "parking",
      "freight-flow",
      "caas-zones",
    ]);
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
});
