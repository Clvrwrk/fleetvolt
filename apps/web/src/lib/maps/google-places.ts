import type { WorkbenchPlace } from "@/components/workbench/map-workbench/types";

export type GooglePlaceSuggestion = {
  id: string;
  label: string;
  description?: string;
  placeId: string;
  source: "google";
};

export type GooglePlaceSearchOptions = {
  input: string;
  sessionToken?: google.maps.places.AutocompleteSessionToken | null;
  bias?: google.maps.LatLngBoundsLiteral;
  region?: string;
  language?: string;
};

export const DEFAULT_WORKBENCH_PLACE_BIAS: google.maps.LatLngBoundsLiteral = {
  north: 38.75,
  south: 32.45,
  east: -114.05,
  west: -124.65,
};

let autocompleteService: google.maps.places.AutocompleteService | null = null;
let placesService: google.maps.places.PlacesService | null = null;
let placesServiceDiv: HTMLDivElement | null = null;

function hasGoogleMapsPlaces(): boolean {
  return typeof window !== "undefined" && Boolean(window.google?.maps?.places);
}

async function ensurePlacesLibrary(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (hasGoogleMapsPlaces()) return true;

  const importLibrary = window.google?.maps?.importLibrary;
  if (!importLibrary) return false;

  try {
    await importLibrary("places");
    return hasGoogleMapsPlaces();
  } catch {
    return false;
  }
}

export function createPlacesSessionToken(): google.maps.places.AutocompleteSessionToken | null {
  if (!hasGoogleMapsPlaces()) return null;
  return new google.maps.places.AutocompleteSessionToken();
}

export async function ensurePlacesSessionToken(): Promise<google.maps.places.AutocompleteSessionToken | null> {
  const ready = await ensurePlacesLibrary();
  if (!ready) return null;
  return new google.maps.places.AutocompleteSessionToken();
}

function getAutocompleteService(): google.maps.places.AutocompleteService | null {
  if (!hasGoogleMapsPlaces()) return null;
  autocompleteService ??= new google.maps.places.AutocompleteService();
  return autocompleteService;
}

function getPlacesService(): google.maps.places.PlacesService | null {
  if (!hasGoogleMapsPlaces()) return null;
  if (!placesServiceDiv) {
    placesServiceDiv = document.createElement("div");
  }
  placesService ??= new google.maps.places.PlacesService(placesServiceDiv);
  return placesService;
}

export async function searchGooglePlaces({
  input,
  sessionToken,
  bias = DEFAULT_WORKBENCH_PLACE_BIAS,
  region = "us",
  language = "en",
}: GooglePlaceSearchOptions): Promise<GooglePlaceSuggestion[]> {
  const trimmed = input.trim();
  if (trimmed.length < 3) return [];

  const ready = await ensurePlacesLibrary();
  const service = ready ? getAutocompleteService() : null;
  if (!service) return [];

  return await new Promise((resolve) => {
    service.getPlacePredictions(
      {
        input: trimmed,
        bounds: bias,
        componentRestrictions: { country: "us" },
        region,
        language,
        sessionToken: sessionToken ?? undefined,
        types: ["geocode", "establishment"],
      },
      (predictions, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
          resolve([]);
          return;
        }

        resolve(
          predictions.slice(0, 6).map((prediction) => ({
            id: `google:${prediction.place_id}`,
            label: prediction.structured_formatting?.main_text || prediction.description,
            description: prediction.description,
            placeId: prediction.place_id,
            source: "google" as const,
          })),
        );
      },
    );
  });
}

export async function resolveGooglePlaceDetails(
  suggestion: Pick<GooglePlaceSuggestion, "label" | "description" | "placeId">,
  sessionToken?: google.maps.places.AutocompleteSessionToken | null,
): Promise<WorkbenchPlace | null> {
  const ready = await ensurePlacesLibrary();
  const service = ready ? getPlacesService() : null;
  if (!service) return null;

  return await new Promise((resolve) => {
    service.getDetails(
      {
        placeId: suggestion.placeId,
        fields: ["place_id", "name", "formatted_address", "geometry.location", "types"],
        sessionToken: sessionToken ?? undefined,
      },
      (place, status) => {
        const location = place?.geometry?.location;
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place || !location) {
          resolve(null);
          return;
        }

        resolve({
          id: place.place_id ?? suggestion.placeId,
          label: place.name || suggestion.label,
          latitude: location.lat(),
          longitude: location.lng(),
          kind: "address",
          source: "google",
          address: place.formatted_address ?? suggestion.description,
          metadata: {
            placeId: place.place_id ?? suggestion.placeId,
            types: place.types ?? [],
            sourceLabel: "Google Places",
          },
        });
      },
    );
  });
}

export function parseManualCoordinate(input: string): WorkbenchPlace | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return {
    id: `manual:${latitude.toFixed(6)},${longitude.toFixed(6)}`,
    label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    latitude,
    longitude,
    kind: "manual",
    source: "manual",
    metadata: {
      sourceLabel: "Manual coordinates",
      rawInput: input,
    },
  };
}
