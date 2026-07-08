import { create } from "zustand";
import {
  DEFAULT_WORKBENCH_MODE,
  WORKBENCH_MODE_CONFIG,
} from "../components/workbench/map-workbench/mode-config";
import type {
  RouteGeometryResult,
  WorkbenchAiResult,
  WorkbenchLayerId,
  WorkbenchMapAction,
  WorkbenchMode,
  WorkbenchPlace,
  WorkbenchPlanDraft,
  WorkbenchResultCard,
  WorkbenchSelection,
} from "../components/workbench/map-workbench/types";

export type MapWorkbenchState = {
  mode: WorkbenchMode;
  draft: WorkbenchPlanDraft;
  activeLayers: WorkbenchLayerId[];
  selectedAsset: WorkbenchSelection | null;
  routeGeometry: RouteGeometryResult | null;
  resultCards: WorkbenchResultCard[];
  providerWarnings: string[];
  focusBounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
  lastAiSummary: string | null;
  reset: (mode?: WorkbenchMode) => void;
  applyDraftPatch: (patch: Partial<WorkbenchPlanDraft>) => void;
  toggleLayer: (layerId: WorkbenchLayerId) => void;
  setLayers: (layerIds: WorkbenchLayerId[]) => void;
  selectAsset: (selection: WorkbenchSelection | null) => void;
  applyMapActions: (actions: WorkbenchMapAction[]) => void;
  applyAiResult: (result: WorkbenchAiResult) => void;
};

const ALLOWED_LAYERS = new Set<WorkbenchLayerId>([
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

function cloneDraft(draft: WorkbenchPlanDraft): WorkbenchPlanDraft {
  const cloned: WorkbenchPlanDraft = { ...draft };

  if (draft.origin) {
    cloned.origin = { ...draft.origin };
  }
  if (draft.destination) {
    cloned.destination = { ...draft.destination };
  }
  if (draft.waypoints) {
    cloned.waypoints = draft.waypoints.map((waypoint) => ({ ...waypoint }));
  }
  if (draft.metadata) {
    cloned.metadata = { ...draft.metadata };
  }

  return cloned;
}

function initialStateForMode(mode: WorkbenchMode) {
  const config = WORKBENCH_MODE_CONFIG[mode];

  return {
    mode,
    draft: cloneDraft(config.defaultDraft),
    activeLayers: [...config.defaultLayers],
    selectedAsset: null,
    routeGeometry: null,
    resultCards: [],
    providerWarnings: [],
    focusBounds: null,
    lastAiSummary: null,
  };
}

function sortLayersForMode(
  mode: WorkbenchMode,
  layerIds: WorkbenchLayerId[],
): WorkbenchLayerId[] {
  const defaultOrder = WORKBENCH_MODE_CONFIG[mode].defaultLayers;
  return [...layerIds].sort((a, b) => {
    const aIndex = defaultOrder.indexOf(a);
    const bIndex = defaultOrder.indexOf(b);

    if (aIndex === -1 && bIndex === -1) {
      return a.localeCompare(b);
    }
    if (aIndex === -1) {
      return 1;
    }
    if (bIndex === -1) {
      return -1;
    }
    return aIndex - bIndex;
  });
}

function asPlace(place: WorkbenchPlace): WorkbenchPlace {
  return {
    ...place,
    kind: place.kind,
    source: place.source,
  };
}

function applyMapAction(
  state: MapWorkbenchState,
  action: WorkbenchMapAction,
): Partial<MapWorkbenchState> {
  switch (action.type) {
    case "set_origin":
      return {
        draft: {
          ...state.draft,
          origin: asPlace(action.place),
        },
      };
    case "set_destination":
      return {
        draft: {
          ...state.draft,
          destination: asPlace(action.place),
        },
      };
    case "toggle_layer": {
      if (!ALLOWED_LAYERS.has(action.layer)) {
        return {};
      }
      const isActive = state.activeLayers.includes(action.layer);
      if (action.enabled && !isActive) {
        return {
          activeLayers: sortLayersForMode(state.mode, [
            ...state.activeLayers,
            action.layer,
          ]),
        };
      }
      if (!action.enabled && isActive) {
        return {
          activeLayers: state.activeLayers.filter((id) => id !== action.layer),
        };
      }
      return {};
    }
    case "set_layers": {
      const next = action.layers.filter((layer) => ALLOWED_LAYERS.has(layer));
      if (next.length === 0) return {};
      return { activeLayers: sortLayersForMode(state.mode, next) };
    }
    case "focus_bounds":
      return { focusBounds: { ...action.bounds } };
    case "select_asset": {
      const selection = action.selection;
      if (!selection?.id || !selection.layerId) return {};
      if (!ALLOWED_LAYERS.has(selection.layerId)) return {};
      return {
        selectedAsset: {
          id: selection.id,
          type: selection.type,
          label: selection.label,
          layerId: selection.layerId,
          latitude: selection.latitude,
          longitude: selection.longitude,
          metadata: selection.metadata,
        },
      };
    }
    default:
      return {};
  }
}

export const useMapWorkbenchStore = create<MapWorkbenchState>((set, get) => ({
  ...initialStateForMode(DEFAULT_WORKBENCH_MODE),
  reset: (mode = DEFAULT_WORKBENCH_MODE) => {
    set(initialStateForMode(mode));
  },
  applyDraftPatch: (patch) => {
    set((state) => ({
      draft: {
        ...state.draft,
        ...patch,
      },
    }));
  },
  toggleLayer: (layerId) => {
    set((state) => {
      const isActive = state.activeLayers.includes(layerId);
      const nextLayers = isActive
        ? state.activeLayers.filter((activeLayer) => activeLayer !== layerId)
        : sortLayersForMode(state.mode, [...state.activeLayers, layerId]);

      return { activeLayers: nextLayers };
    });
  },
  setLayers: (layerIds) => {
    set((state) => ({
      activeLayers: sortLayersForMode(
        state.mode,
        layerIds.filter((layer) => ALLOWED_LAYERS.has(layer)),
      ),
    }));
  },
  selectAsset: (selection) => {
    set({ selectedAsset: selection });
  },
  applyMapActions: (actions) => {
    for (const action of actions) {
      const patch = applyMapAction(get(), action);
      if (Object.keys(patch).length > 0) {
        set(patch);
      }
    }
  },
  applyAiResult: (result) => {
    const state = get();
    if (result.mode && result.mode !== state.mode) {
      // Ignore cross-mode AI results to avoid corrupting the active workbench.
      return;
    }

    if (result.draftPatch) {
      set({
        draft: {
          ...state.draft,
          ...result.draftPatch,
        },
      });
    }

    if (result.mapActions?.length) {
      get().applyMapActions(result.mapActions);
    }

    const cards = result.cards?.length
      ? result.cards
      : result.resultCards?.length
        ? result.resultCards
        : undefined;

    const warnings = [
      ...(result.providerWarnings ?? []),
      ...(result.error ? [result.error] : []),
    ];

    set({
      ...(cards ? { resultCards: cards } : {}),
      ...(result.routeGeometry ? { routeGeometry: result.routeGeometry } : {}),
      ...(result.activeLayers
        ? {
            activeLayers: sortLayersForMode(
              get().mode,
              result.activeLayers.filter((layer) => ALLOWED_LAYERS.has(layer)),
            ),
          }
        : {}),
      ...(warnings.length > 0 ? { providerWarnings: warnings } : {}),
      lastAiSummary: result.answerSummary ?? result.response ?? null,
    });
  },
}));
