import { create } from "zustand";
import {
  DEFAULT_WORKBENCH_MODE,
  WORKBENCH_MODE_CONFIG,
} from "../components/workbench/map-workbench/mode-config";
import type {
  RouteGeometryResult,
  WorkbenchLayerId,
  WorkbenchMode,
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
  reset: (mode?: WorkbenchMode) => void;
  applyDraftPatch: (patch: Partial<WorkbenchPlanDraft>) => void;
  toggleLayer: (layerId: WorkbenchLayerId) => void;
  selectAsset: (selection: WorkbenchSelection | null) => void;
};

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

export const useMapWorkbenchStore = create<MapWorkbenchState>((set) => ({
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
  selectAsset: (selection) => {
    set({ selectedAsset: selection });
  },
}));
