"use client";

import {
  Component,
  useEffect,
  useId,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { Check, Loader2, MapPin, Navigation, Search } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import {
  ensurePlacesSessionToken,
  parseManualCoordinate,
  resolveGooglePlaceDetails,
  searchGooglePlaces,
  type GooglePlaceSuggestion,
} from "@/lib/maps/google-places";
import type { WorkbenchPlace, WorkbenchPlaceKind } from "../types";

/**
 * Convex useQuery throws into the nearest error boundary when a function is
 * missing or fails. Catch here so place search degrades to Google/manual only
 * instead of crashing the whole workbench.
 */
class SoftQueryBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[PlaceInput] local asset search unavailable:", error.message, info.componentStack);
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

type FleetVoltAssetSuggestion = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  kind: WorkbenchPlaceKind;
  source: "fleetvolt";
  sourceTable: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

type ManualSuggestion = WorkbenchPlace & { source: "manual" };

type PlaceSuggestion = FleetVoltAssetSuggestion | GooglePlaceSuggestion | ManualSuggestion;

type PlaceInputProps = {
  label: string;
  value?: WorkbenchPlace | null;
  onChange: (place: WorkbenchPlace | null) => void;
  placeholder?: string;
  fleetId?: string;
  className?: string;
};

const SOURCE_BADGE_CLASSES: Record<string, string> = {
  fleetvolt: "border-[var(--fv-signal-green)]/30 bg-[var(--fv-signal-green)]/10 text-[var(--fv-signal-green)]",
  google: "border-[var(--fv-accent)]/30 bg-[var(--fv-accent)]/10 text-[var(--fv-accent)]",
  manual: "border-amber-500/30 bg-amber-500/10 text-amber-700",
};

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function suggestionKey(suggestion: PlaceSuggestion) {
  if (suggestion.source === "google") return suggestion.id;
  if (suggestion.source === "manual") return suggestion.id ?? suggestion.label;
  return `${suggestion.sourceTable}:${suggestion.id}`;
}

function suggestionSourceLabel(suggestion: PlaceSuggestion) {
  if (suggestion.source === "google") return "Google Places";
  if (suggestion.source === "manual") return "Manual coordinates";
  return "FleetVolt asset";
}

function suggestionKindLabel(suggestion: PlaceSuggestion) {
  if (suggestion.source === "google") return "address/place";
  return suggestion.kind.replaceAll("-", " ");
}

function suggestionDescription(suggestion: PlaceSuggestion) {
  if (suggestion.source === "manual") {
    return `${suggestion.latitude.toFixed(5)}, ${suggestion.longitude.toFixed(5)}`;
  }
  return suggestion.description;
}

function normalizeFleetVoltSuggestion(suggestion: FleetVoltAssetSuggestion): WorkbenchPlace {
  return {
    id: suggestion.id,
    label: suggestion.label,
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
    kind: suggestion.kind,
    source: "fleetvolt",
    address: suggestion.description,
    metadata: {
      ...(suggestion.metadata ?? {}),
      sourceTable: suggestion.sourceTable,
      sourceLabel: "FleetVolt asset",
    },
  };
}

function isAmbiguousSelection(suggestion: PlaceSuggestion, suggestions: PlaceSuggestion[]) {
  if (suggestion.source === "manual") return false;
  const normalized = suggestion.label.trim().toLowerCase();
  const nearMatches = suggestions.filter((candidate) => {
    const candidateLabel = candidate.label.trim().toLowerCase();
    return candidateLabel === normalized || candidateLabel.includes(normalized) || normalized.includes(candidateLabel);
  });
  return nearMatches.length > 1;
}

function useLocalPlaceAssets(trimmedInput: string, fleetId?: string) {
  return useQuery(
    api.workbench.queries.searchPlaceAssets,
    trimmedInput.length >= 2 ? { query: trimmedInput, limit: 7, fleetId } : "skip",
  ) as FleetVoltAssetSuggestion[] | undefined;
}

function PlaceInputBody({
  label,
  value,
  onChange,
  placeholder = "Search ports, yards, chargers, addresses, or lat,lng",
  fleetId,
  className,
  localAssetsEnabled,
}: PlaceInputProps & { localAssetsEnabled: boolean }) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const [inputValue, setInputValue] = useState(value?.label ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [googleSuggestions, setGoogleSuggestions] = useState<GooglePlaceSuggestion[]>([]);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PlaceSuggestion | null>(null);
  const [sessionToken, setSessionToken] =
    useState<google.maps.places.AutocompleteSessionToken | null>(null);
  const debouncedInput = useDebouncedValue(inputValue, 250);
  const trimmedInput = debouncedInput.trim();

  const localAssets = useLocalPlaceAssets(
    localAssetsEnabled ? trimmedInput : "",
    fleetId,
  );

  useEffect(() => {
    if (value?.label && value.label !== inputValue && !isOpen) {
      const timeoutId = window.setTimeout(() => setInputValue(value.label), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [inputValue, isOpen, value?.label]);

  useEffect(() => {
    let cancelled = false;

    async function runPlacesSearch() {
      if (trimmedInput.length < 3) {
        setGoogleSuggestions([]);
        return;
      }

      if (!sessionToken) {
        const token = await ensurePlacesSessionToken();
        if (!cancelled) setSessionToken(token);
        return;
      }

      setIsLoadingGoogle(true);
      const results = await searchGooglePlaces({
        input: trimmedInput,
        sessionToken,
      });
      if (!cancelled) {
        setGoogleSuggestions(results);
        setIsLoadingGoogle(false);
      }
    }

    void runPlacesSearch();
    return () => {
      cancelled = true;
    };
  }, [sessionToken, trimmedInput]);

  const manualCoordinate = useMemo(() => parseManualCoordinate(inputValue), [inputValue]);

  const suggestions = useMemo<PlaceSuggestion[]>(() => {
    const merged: PlaceSuggestion[] = [];
    merged.push(...(localAssets ?? []));
    merged.push(...googleSuggestions);
    if (manualCoordinate) merged.push(manualCoordinate as ManualSuggestion);
    return merged.slice(0, 12);
  }, [googleSuggestions, localAssets, manualCoordinate]);

  const helperText = pendingConfirmation
    ? `Confirm ${pendingConfirmation.label} — multiple similar matches were found.`
    : "FleetVolt assets are shown first, then Google Places and manual coordinates.";

  async function selectSuggestion(suggestion: PlaceSuggestion, confirmed = false) {
    if (!confirmed && isAmbiguousSelection(suggestion, suggestions)) {
      setPendingConfirmation(suggestion);
      return;
    }

    let place: WorkbenchPlace | null = null;
    if (suggestion.source === "google") {
      place = await resolveGooglePlaceDetails(suggestion, sessionToken);
      setSessionToken(await ensurePlacesSessionToken());
    } else if (suggestion.source === "manual") {
      place = suggestion;
      setSessionToken(await ensurePlacesSessionToken());
    } else {
      place = normalizeFleetVoltSuggestion(suggestion);
    }

    if (!place) return;
    onChange(place);
    setInputValue(place.label);
    setIsOpen(false);
    setPendingConfirmation(null);
  }

  return (
    <div className={cn("relative space-y-1.5", className)}>
      <label htmlFor={inputId} className="block text-xs font-semibold text-[var(--fv-steel)]">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fv-steel)]" />
        <input
          id={inputId}
          type="text"
          value={inputValue}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          className="min-h-11 w-full rounded-xl border border-black/10 bg-white py-2 pl-9 pr-9 text-sm text-[var(--fv-graphite)] shadow-sm outline-none transition placeholder:text-[var(--fv-steel)]/70 focus:border-[var(--fv-accent)] focus:ring-2 focus:ring-[var(--fv-accent)]/20"
          onChange={(event) => {
            setInputValue(event.target.value);
            setIsOpen(true);
            setPendingConfirmation(null);
          }}
          onFocus={() => setIsOpen(true)}
        />
        {isLoadingGoogle ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-[var(--fv-steel)]" />
        ) : value ? (
          <Check className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fv-signal-green)]" />
        ) : (
          <MapPin className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fv-steel)]" />
        )}
      </div>

      <p className="text-[10px] leading-4 text-[var(--fv-steel)]">{helperText}</p>

      {isOpen && (suggestions.length > 0 || trimmedInput.length >= 2) ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-2xl border border-black/10 bg-white p-1 shadow-xl"
        >
          {suggestions.length === 0 ? (
            <div className="px-3 py-3 text-xs text-[var(--fv-steel)]">
              No local assets yet. Try an address, business name, or manual coordinates like 33.77,-118.19.
            </div>
          ) : (
            suggestions.map((suggestion) => {
              const key = suggestionKey(suggestion);
              const isPending = Boolean(pendingConfirmation && suggestionKey(pendingConfirmation) === key);
              return (
                <button
                  key={key}
                  type="button"
                  role="option"
                  aria-selected={isPending}
                  className={cn(
                    "w-full rounded-xl px-3 py-2 text-left transition hover:bg-[var(--fv-canvas)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--fv-accent)]",
                    isPending && "bg-amber-50",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void selectSuggestion(suggestion, isPending)}
                >
                  <span className="flex items-start gap-2">
                    <Navigation className="mt-0.5 size-3.5 shrink-0 text-[var(--fv-steel)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--fv-graphite)]">
                        {suggestion.label}
                      </span>
                      <span className="block truncate text-xs text-[var(--fv-steel)]">
                        {suggestionDescription(suggestion)}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                            SOURCE_BADGE_CLASSES[suggestion.source],
                          )}
                        >
                          {suggestionSourceLabel(suggestion)}
                        </span>
                        <span className="rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[10px] font-semibold text-[var(--fv-steel)]">
                          {suggestionKindLabel(suggestion)}
                        </span>
                        {isPending ? (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            Click again to confirm
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

export function PlaceInput(props: PlaceInputProps) {
  return (
    <SoftQueryBoundary
      fallback={<PlaceInputBody {...props} localAssetsEnabled={false} />}
    >
      <PlaceInputBody {...props} localAssetsEnabled />
    </SoftQueryBoundary>
  );
}
