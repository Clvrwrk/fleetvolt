// Corridor-city normalization (P12-09 / P12-10c) — PURE, no Convex imports.
//
// normalizeCorridorCity(city) maps a raw registry city string to one of the
// canonical POLB→San-Bernardino corridor-city cluster names (the flagship
// "companies to target" clusters), or null for any city OUTSIDE the corridor
// set. That null-vs-name result is a CLEAN PARTITION: in-corridor carriers get a
// canonical tag (counted toward the flagship ~685 in-corridor total), everything
// else is explicitly out-of-corridor — so the corridor density can never be
// silently inflated by fuzzy matches (T-12-05d).
//
// The canonical set is the flagship VERIFIED cluster names
// (FLAGSHIP-QUERY-VERIFIED.md): the eight named headline clusters
// (Long Beach, Wilmington, Carson, Gardena, Compton, Ontario, City of Industry,
// Chino) plus the four inland corridor endpoints called out in the plan
// (San Bernardino, Rancho Cucamonga, Fontana, Rialto). The eight headline
// clusters reproduce the flagship distribution byte-exact from the raw registry
// city text (127/74/68/54/52/49/39/34), which is why corridor-city density is
// answerable even though address→lat/lng geocoding is deferred (12-05 geocode).

/** The canonical corridor-city cluster names (flagship parity target). */
export const CORRIDOR_CITIES = [
  "Long Beach",
  "Wilmington",
  "Carson",
  "Gardena",
  "Compton",
  "Ontario",
  "City of Industry",
  "Chino",
  "San Bernardino",
  "Rancho Cucamonga",
  "Fontana",
  "Rialto",
] as const;

export type CorridorCity = (typeof CORRIDOR_CITIES)[number];

// Lookup keyed by the normalized form of each canonical name + common variants.
// Normalization: lower-case, collapse whitespace, strip a trailing state suffix
// (", CA" / " CA" / " CA."), strip surrounding punctuation. "Industry" is the
// incorporated name many registries use for "City of Industry".
const _VARIANTS: Record<string, CorridorCity> = {
  "long beach": "Long Beach",
  wilmington: "Wilmington",
  carson: "Carson",
  gardena: "Gardena",
  compton: "Compton",
  ontario: "Ontario",
  "city of industry": "City of Industry",
  industry: "City of Industry",
  chino: "Chino",
  "san bernardino": "San Bernardino",
  "rancho cucamonga": "Rancho Cucamonga",
  fontana: "Fontana",
  rialto: "Rialto",
};

/** Normalize a raw city string to its canonical comparison key. */
function normKey(city: string): string {
  return city
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    // strip a trailing ", CA" / " CA" / " CA." state suffix
    .replace(/[,]?\s*ca\.?$/i, "")
    .replace(/[.]+$/g, "")
    .trim();
}

/**
 * Map a raw city string to its canonical corridor-city cluster name, or null if
 * the city is outside the POLB→SB corridor set. Case- and whitespace-insensitive;
 * tolerates a trailing state suffix ("Long Beach, CA").
 */
export function normalizeCorridorCity(city: string | null | undefined): CorridorCity | null {
  if (city == null) return null;
  const key = normKey(city);
  if (key.length === 0) return null;
  return _VARIANTS[key] ?? null;
}
