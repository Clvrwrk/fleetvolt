// Pure OSM tag -> pois.type classifier (P12-14).
//
// NO Convex imports — a pure function so it unit-tests fast (node --test) and is
// reused by the ingest mutation (pois/mutations.ts). This is the SINGLE
// precedence spec; data/ingest/osm/extract_pois.py mirrors it EXACTLY so the
// Python extractor and the Convex classifier can never drift (T-12-07b). If you
// change the precedence here, change it there too — extract.test.ts guards the
// TS side.
//
// PRECEDENCE (most-specific first):
//   1. amenity=fuel                                -> fuel
//   2. amenity=parking AND (hgv=yes OR access=hgv) -> truck_parking
//   3. highway in {services, rest_area}           -> rest_area
//   4. shop=convenience                           -> convenience
//   5. amenity=fast_food                          -> fast_food
//   else                                          -> null (not a target POI)
//
// Rationale: a fuel station that is ALSO a convenience store classifies as
// `fuel` (the most specific truck-relevant amenity). A plain amenity=parking
// with no hgv/access=hgv tag is NOT truck_parking (returns null) so generic car
// parks are never over-counted as truck parking (T-12-07d).

export type PoiType =
  | "truck_parking"
  | "rest_area"
  | "fuel"
  | "convenience"
  | "fast_food";

/** Map a raw OSM tag bag to exactly one PoiType, or null when it matches none. */
export function classifyPoi(tags: Record<string, string>): PoiType | null {
  const amenity = tags.amenity;
  if (amenity === "fuel") return "fuel";
  if (amenity === "parking" && (tags.hgv === "yes" || tags.access === "hgv")) {
    return "truck_parking";
  }
  if (tags.highway === "services" || tags.highway === "rest_area") {
    return "rest_area";
  }
  if (tags.shop === "convenience") return "convenience";
  if (amenity === "fast_food") return "fast_food";
  return null;
}

/** The OSM tag string(s) that caused a match — recorded in provenance.inputs[]. */
export function matchedTag(tags: Record<string, string>, type: PoiType): string {
  switch (type) {
    case "fuel":
      return "amenity=fuel";
    case "truck_parking":
      return tags.hgv === "yes" ? "amenity=parking,hgv=yes" : "amenity=parking,access=hgv";
    case "rest_area":
      return `highway=${tags.highway}`;
    case "convenience":
      return "shop=convenience";
    case "fast_food":
      return "amenity=fast_food";
  }
}
