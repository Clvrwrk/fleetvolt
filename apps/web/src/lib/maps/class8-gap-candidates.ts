import type { WorkbenchMapAsset } from "@/components/workbench/map-workbench/layers/asset-marker-layer";

type Point = { lat: number; lng: number };

type SiteRow = {
  name?: unknown;
  type?: unknown;
  location?: unknown;
  numberOfSpots?: unknown;
  hgv?: unknown;
  distanceM?: unknown;
};

export type CaasGapOpportunityEvidence = {
  route?: {
    midpoint?: Point | null;
    origin?: Point | null;
    destination?: Point | null;
    approximateMiles?: unknown;
  } | null;
  gap?: {
    classification?: unknown;
    class8WithinCorridor?: unknown;
    closestClass8DistanceM?: unknown;
    nearestClass8DistanceLabel?: unknown;
  } | null;
  hotspot?: {
    parking?: { parking?: unknown[]; totalSpots?: unknown } | null;
    pois?: { pois?: unknown[] } | null;
    score?: { score?: unknown; method?: unknown; source?: unknown } | null;
    whatsMissing?: { mobileEnergyOpportunity?: unknown; noClass8Charging?: unknown } | null;
  } | null;
  mobilePositioning?: {
    recommended?: unknown;
    priority?: unknown;
    point?: Point | null;
    recommendedPowerKw?: unknown;
    summary?: unknown;
  } | null;
  source?: { function?: unknown } | null;
};

function point(value: unknown): Point | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const lat = row.lat ?? row.latitude;
  const lng = row.lng ?? row.lon ?? row.longitude;
  return typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng)
    ? { lat, lng }
    : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function haversineMiles(a: Point | null, b: Point | null): number | null {
  if (!a || !b) return null;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const q =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return (2 * 6_371_000 * Math.asin(Math.sqrt(q))) / 1609.344;
}

function title(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function siteType(row: SiteRow, source: "parking" | "poi" | "midpoint"): string {
  if (source === "midpoint") return "Modeled corridor midpoint";
  if (source === "parking") return row.hgv === true ? "HGV truck parking / staging" : "Parking / staging candidate";
  return title(row.type, "roadside amenity").replaceAll("_", " ");
}

function siteCandidates(evidence: CaasGapOpportunityEvidence) {
  const parking = evidence.hotspot?.parking?.parking ?? [];
  const pois = evidence.hotspot?.pois?.pois ?? [];
  const prioritizedPois = [...pois].sort((a, b) => {
    const rank = (value: unknown) => {
      const kind = title((value as SiteRow | null)?.type, "");
      if (kind === "truck_stop") return 0;
      if (kind === "rest_area") return 1;
      if (kind === "fuel") return 2;
      return 3;
    };
    return rank(a) - rank(b);
  });

  const rows: Array<{ row: SiteRow; source: "parking" | "poi" | "midpoint"; location: Point }> = [];
  for (const raw of parking) {
    const row = raw as SiteRow;
    const location = point(row.location);
    if (location) rows.push({ row, source: "parking", location });
  }
  for (const raw of prioritizedPois) {
    const row = raw as SiteRow;
    const location = point(row.location);
    if (location) rows.push({ row, source: "poi", location });
  }
  if (rows.length === 0) {
    const location = point(evidence.mobilePositioning?.point) ?? point(evidence.route?.midpoint);
    if (location) rows.push({ row: {}, source: "midpoint", location });
  }
  return rows.slice(0, 3);
}

export function buildClass8GapCandidates(
  evidence: CaasGapOpportunityEvidence | null | undefined,
): WorkbenchMapAsset[] {
  if (!evidence) return [];
  const classification = title(evidence.gap?.classification, "unclassified");
  const mobileOpportunity = evidence.hotspot?.whatsMissing?.mobileEnergyOpportunity === true;
  const noClass8Charging = evidence.hotspot?.whatsMissing?.noClass8Charging === true;
  const recommended = evidence.mobilePositioning?.recommended === true;
  const class8Count = number(evidence.gap?.class8WithinCorridor) ?? 0;
  const routeMiles =
    number(evidence.route?.approximateMiles) ??
    haversineMiles(
      point(evidence.route?.origin),
      point(evidence.route?.destination),
    );
  // Existing gap analysis counts qualifying chargers across a few sampled
  // points. A small cluster near one end can mark a long corridor "covered"
  // without proving useful capacity, trailer access, or energy-window siting.
  const thinLongCorridorCoverage =
    classification === "covered" &&
    routeMiles !== null &&
    routeMiles >= 100;

  if (!recommended && !mobileOpportunity && classification === "covered" && !thinLongCorridorCoverage) return [];

  const closestLabel = title(
    evidence.gap?.nearestClass8DistanceLabel,
    number(evidence.gap?.closestClass8DistanceM) === null
      ? "No verified Class 8 station in the analyzed search"
      : `${((number(evidence.gap?.closestClass8DistanceM) ?? 0) / 1609.344).toFixed(1)} mi straight-line`,
  );
  const modeledPower = number(evidence.mobilePositioning?.recommendedPowerKw);
  const recommendedPower = thinLongCorridorCoverage
    ? 1000
    : modeledPower !== null && modeledPower > 0
      ? modeledPower
      : 500;
  const priority = title(evidence.mobilePositioning?.priority, classification === "true-gap" ? "high" : "review");
  const candidates = siteCandidates(evidence);
  const displayClassification = thinLongCorridorCoverage
    ? "capacity-review"
    : classification;

  return candidates.map(({ row, source, location }, index) => {
    const baseName = title(row.name, source === "midpoint" ? "Modeled corridor staging point" : "Unlabeled freight dwell site");
    const spots = number(row.numberOfSpots);
    const anchor = siteType(row, source);
    const sourceConfidence = source === "midpoint"
      ? "Low — modeled point; physical site not selected"
      : "Medium — mapped dwell asset; access not field-verified";
    const whyGap = thinLongCorridorCoverage
      ? `Only ${class8Count} verified Class 8 charger(s) appear across this ${Math.round(routeMiles ?? 0)}-mile sampled corridor. That count does not verify useful capacity, trailer access, uptime, or placement inside the Tejon energy window.`
      : class8Count === 0 || noClass8Charging
      ? `No verified Class 8-capable charger serves the analyzed corridor window; nearest evidence: ${closestLabel}.`
      : `Class 8 hardware exists in the broader corridor, but modeled freight dwell still indicates a capacity or timing gap at this window.`;

    return {
      id: `gap-candidate-${index}-${location.lat.toFixed(4)}-${location.lng.toFixed(4)}`,
      type: "class8-gap",
      layerId: "class8-gaps",
      label: `Mobile charge candidate — ${baseName}`,
      latitude: location.lat,
      longitude: location.lng,
      subtitle: `${anchor} · ${priority} priority`,
      metric: "GAP",
      metadata: {
        classification: displayClassification,
        siteType: anchor,
        confidence: sourceConfidence,
        optimalArrivalSoc: "20–40% modeled arrival window",
        dwellWindow: "30–90 minutes target dwell",
        whyHere: `${anchor}${spots ? ` with ${spots} mapped spaces` : ""} provides a freight dwell/staging hypothesis near the route energy window.`,
        whyGap,
        chargerEvidence: `${class8Count} verified Class 8 charger(s) inside the analyzed corridor radius; nearest: ${closestLabel}.`,
        recommendedPower: `${recommendedPower} kW mobile bridge`,
        provenance: `${title(evidence.source?.function, "FleetVolt route opportunity model")} + ${source === "midpoint" ? "route midpoint" : source === "parking" ? "parking dataset" : "POI dataset"}`,
        verification: "Trailer circulation, site permission, utility capacity, and live charger status require field validation.",
        status: "Modeled siting hypothesis — not a verified deployment site",
        carrierHref: `/caas?view=summary&carriers=1&lat=${location.lat.toFixed(3)}&lng=${location.lng.toFixed(3)}`,
      },
    } satisfies WorkbenchMapAsset;
  });
}
