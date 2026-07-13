import { create } from "zustand";
import {
  DEFAULT_WORKBENCH_MODE,
  WORKBENCH_MODE_CONFIG,
} from "../components/workbench/map-workbench/mode-config";
import { ROLE_LAYER_IDS } from "../components/workbench/map-workbench/role-layers";
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
import type { WorkbenchMapAsset } from "../components/workbench/map-workbench/layers/asset-marker-layer";

/** CaaS: freight overview until route is built; then same route map as driver/fleet. */
export type CaasMapPhase = "freight_overview" | "route_analysis";

/** Dual-corridor filter for road-traced freight (I-15 vs I-40). */
export type FreightViaFilter = "all" | "I-15" | "I-40";

/** CaaS choropleth drilldown: air districts → counties → zip markers. */
export type CaasGeoLevel = "air-district" | "county" | "zip";

export type MapWorkbenchState = {
  mode: WorkbenchMode;
  draft: WorkbenchPlanDraft;
  activeLayers: WorkbenchLayerId[];
  selectedAsset: WorkbenchSelection | null;
  routeGeometry: RouteGeometryResult | null;
  /** Live pins from Calculate (chargers/parking/POIs). Empty → canvas falls back to samples. */
  mapAssets: WorkbenchMapAsset[];
  resultCards: WorkbenchResultCard[];
  providerWarnings: string[];
  focusBounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
  lastAiSummary: string | null;
  /** CaaS-only map phase. Ignored for driver/fleet modes. */
  caasPhase: CaasMapPhase;
  /** Selected port code for popup + generator markers (CaaS overview). */
  selectedPortCode: string | null;
  /** I-15 / I-40 compare filter for freight corridors. */
  freightViaFilter: FreightViaFilter;
  /** Choropleth level for CaaS freight overview. */
  caasGeoLevel: CaasGeoLevel;
  reset: (mode?: WorkbenchMode) => void;
  applyDraftPatch: (patch: Partial<WorkbenchPlanDraft>) => void;
  toggleLayer: (layerId: WorkbenchLayerId) => void;
  setLayers: (layerIds: WorkbenchLayerId[]) => void;
  selectAsset: (selection: WorkbenchSelection | null) => void;
  setMapAssets: (assets: WorkbenchMapAsset[]) => void;
  setCaasPhase: (phase: CaasMapPhase) => void;
  setSelectedPortCode: (code: string | null) => void;
  setFreightViaFilter: (filter: FreightViaFilter) => void;
  setCaasGeoLevel: (level: CaasGeoLevel) => void;
  hydrateLayerProfile: (mode?: WorkbenchMode) => void;
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
  "ports",
  "freight-flow",
  "caas-zones",
]);

/** Full CaaS layer stack — kept on in both freight overview and route analysis. */
const CAAS_FULL_LAYERS: WorkbenchLayerId[] = [
  "ports",
  "freight-flow",
  "route",
  "chargers",
  "parking",
  "class8-gaps",
  "carriers",
  "geo-regions",
  "highways",
  "pois",
  "fleet-yards",
];

const LAYER_PROFILE_STORAGE_KEY = "fleetvolt_workbench_layer_profile_v1";

type LayerProfiles = Partial<Record<WorkbenchMode, WorkbenchLayerId[]>>;

function readLayerProfile(mode: WorkbenchMode): WorkbenchLayerId[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAYER_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LayerProfiles;
    const allowed = new Set(ROLE_LAYER_IDS[mode]);
    const saved = parsed[mode]?.filter((id) => allowed.has(id));
    return saved && saved.length > 0 ? sortLayersForMode(mode, saved) : null;
  } catch {
    return null;
  }
}

function writeLayerProfile(mode: WorkbenchMode, layers: WorkbenchLayerId[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LAYER_PROFILE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as LayerProfiles) : {};
    parsed[mode] = layers;
    window.localStorage.setItem(LAYER_PROFILE_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Private browsing and locked-down storage keep the in-memory profile.
  }
}

function boundsFromPlaces(
  origin?: WorkbenchPlace | null,
  destination?: WorkbenchPlace | null,
  coordinates?: Array<{ latitude: number; longitude: number }> | null,
): MapWorkbenchState["focusBounds"] {
  const points: Array<{ lat: number; lng: number }> = [];
  if (origin) points.push({ lat: origin.latitude, lng: origin.longitude });
  if (destination) {
    points.push({ lat: destination.latitude, lng: destination.longitude });
  }
  for (const c of coordinates ?? []) {
    if (Number.isFinite(c.latitude) && Number.isFinite(c.longitude)) {
      points.push({ lat: c.latitude, lng: c.longitude });
    }
  }
  if (points.length === 0) return null;

  let north = points[0]!.lat;
  let south = points[0]!.lat;
  let east = points[0]!.lng;
  let west = points[0]!.lng;
  for (const p of points) {
    north = Math.max(north, p.lat);
    south = Math.min(south, p.lat);
    east = Math.max(east, p.lng);
    west = Math.min(west, p.lng);
  }
  // Minimum pad so short corridors still zoom sensibly.
  const latPad = Math.max(0.12, (north - south) * 0.22);
  const lngPad = Math.max(0.12, (east - west) * 0.22);
  return {
    north: north + latPad,
    south: south - latPad,
    east: east + lngPad,
    west: west - lngPad,
  };
}

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
    // First visit: every icon set available to the role is visible. Returning
    // visits restore that role's last layer profile.
    activeLayers:
      readLayerProfile(mode) ??
      sortLayersForMode(
        mode,
        mode === "caas_gap_map" ? CAAS_FULL_LAYERS : ROLE_LAYER_IDS[mode],
      ),
    selectedAsset: null,
    routeGeometry: null,
    mapAssets: [],
    resultCards: [],
    providerWarnings: [],
    focusBounds: null,
    lastAiSummary: null,
    caasPhase:
      mode === "caas_gap_map"
        ? ("freight_overview" as CaasMapPhase)
        : ("route_analysis" as CaasMapPhase),
    selectedPortCode: null,
    freightViaFilter: "all" as FreightViaFilter,
    caasGeoLevel: "air-district" as CaasGeoLevel,
  };
}

function sortLayersForMode(
  mode: WorkbenchMode,
  layerIds: WorkbenchLayerId[],
): WorkbenchLayerId[] {
  // Prefer role toolbar order (full suite), fall back to mode defaults.
  const order = ROLE_LAYER_IDS[mode] ?? WORKBENCH_MODE_CONFIG[mode].defaultLayers;
  return [...layerIds].sort((a, b) => {
    const aIndex = order.indexOf(a);
    const bIndex = order.indexOf(b);

    if (aIndex === -1 && bIndex === -1) {
      return a.localeCompare(b);
    }
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
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

      writeLayerProfile(state.mode, nextLayers);
      return { activeLayers: nextLayers };
    });
  },
  setLayers: (layerIds) => {
    set((state) => {
      const activeLayers = sortLayersForMode(
        state.mode,
        layerIds.filter((layer) => ALLOWED_LAYERS.has(layer)),
      );
      writeLayerProfile(state.mode, activeLayers);
      return { activeLayers };
    });
  },
  hydrateLayerProfile: (mode = get().mode) => {
    const saved = readLayerProfile(mode);
    if (saved) set({ activeLayers: saved });
  },
  selectAsset: (selection) => {
    set((state) => {
      // Same asset again → deselect (marker is the open/close control).
      if (
        selection &&
        state.selectedAsset &&
        state.selectedAsset.id === selection.id &&
        state.selectedAsset.type === selection.type
      ) {
        return { selectedAsset: null };
      }
      return { selectedAsset: selection };
    });
  },
  setMapAssets: (assets) => {
    set({ mapAssets: assets });
  },
  setSelectedPortCode: (code) => {
    set({ selectedPortCode: code });
  },
  setFreightViaFilter: (filter) => {
    set({ freightViaFilter: filter });
  },
  setCaasGeoLevel: (level) => {
    set({ caasGeoLevel: level });
  },
  setCaasPhase: (phase) => {
    set((state) => {
      if (state.mode !== "caas_gap_map") return {};
      if (phase === "route_analysis") {
        const focusBounds = boundsFromPlaces(
          state.draft.origin,
          state.draft.destination,
          state.routeGeometry?.coordinates,
        );
        // Keep freight / geo / assets on — route analysis adds focus, it does not blank the map.
        return {
          caasPhase: phase,
          activeLayers: state.activeLayers,
          focusBounds,
        };
      }
      return {
        caasPhase: phase,
        focusBounds: null,
        activeLayers: state.activeLayers,
      };
    });
  },
  applyMapActions: (actions) => {
    for (const action of actions) {
      const patch = applyMapAction(get(), action);
      if (Object.keys(patch).length > 0) {
        if (patch.activeLayers) {
          writeLayerProfile(get().mode, patch.activeLayers);
        }
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

    const nextDraft = get().draft;
    const hasBothEndpoints = Boolean(nextDraft.origin && nextDraft.destination);
    const hasUsableGeometry = Boolean(
      result.routeGeometry?.coordinates &&
        result.routeGeometry.coordinates.length >= 2,
    );
    const patchCompletesRoute = Boolean(
      result.draftPatch?.origin && result.draftPatch?.destination,
    );
    // Only leave freight overview when AI produced a complete OD pair
    // (not origin-only, destination-only, or notes-only patches).
    const aiBuiltRoute =
      state.mode === "caas_gap_map" &&
      hasBothEndpoints &&
      (hasUsableGeometry || patchCompletesRoute);

    if (aiBuiltRoute && get().caasPhase === "freight_overview") {
      get().setCaasPhase("route_analysis");
    }

    const afterPhase = get();
    const inRouteAnalysis =
      afterPhase.mode === "caas_gap_map" &&
      afterPhase.caasPhase === "route_analysis";

    const nextLayers = result.activeLayers
      ? sortLayersForMode(
          afterPhase.mode,
          result.activeLayers.filter((layer) => ALLOWED_LAYERS.has(layer)),
        )
      : undefined;

    const routeFocus =
      inRouteAnalysis && (aiBuiltRoute || result.routeGeometry)
        ? boundsFromPlaces(
            afterPhase.draft.origin,
            afterPhase.draft.destination,
            result.routeGeometry?.coordinates ??
              afterPhase.routeGeometry?.coordinates,
          )
        : undefined;

    if (nextLayers) {
      writeLayerProfile(afterPhase.mode, nextLayers);
    }

    set({
      ...(cards ? { resultCards: cards } : {}),
      ...(result.routeGeometry ? { routeGeometry: result.routeGeometry } : {}),
      ...(nextLayers ? { activeLayers: nextLayers } : {}),
      ...(routeFocus ? { focusBounds: routeFocus } : {}),
      ...(warnings.length > 0 ? { providerWarnings: warnings } : {}),
      lastAiSummary: result.answerSummary ?? result.response ?? null,
    });
  },
}));
