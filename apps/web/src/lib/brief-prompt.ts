// Brief prompt builder — PURE functions, no Convex imports, no fetch.
//
// buildBriefPrompt(reportPayload) → {systemPrompt, userPrompt}
//   The system prompt contains the honesty rules from 15-AI-SPEC §3:
//   - score is MODELED (never "observed dwell")
//   - every number must come from the report data
//   - detour/CO2 are NOT computed
//   - Data Disclosure section is mandatory
//   The system prompt ends with "GROUNDING DATA:" + JSON.stringify(reportPayload).
//
// buildFallbackBrief(reportPayload) → string
//   Assembles a template brief from the report fields. Clearly labeled
//   "Template brief (LLM unavailable)" at the top. Still grounded (uses only
//   report data fields), lacks narrative quality.

import {
  FLEETVOLT_REPORT_NARRATIVE_CONTRACT,
  FLEETVOLT_REPORT_STANDARD_VERSION,
} from "../../report-standard/fleetvolt-route-report-v1";

// The four proxy input names — inlined for the prompt (matching
// convex/hotspots/score.ts HOTSPOT_SCORE_INPUTS).
const PROXY_INPUTS = [
  "NATD_parking_capacity",
  "Caltrans_5axle_truckAADT",
  "FAF_zone061_flow",
  "POLB_carrier_concentration",
] as const;

interface ReportPayload {
  location?: { lat: number; lng: number };
  radiusM?: number;
  carriers?: Array<{ name?: string; city?: string | null; corridorCity?: string | null; distanceM?: number }>;
  parking?: { count?: number; totalSpots?: number; parking?: unknown[] };
  pois?: { total?: number; byType?: Record<string, number> };
  chargers?: {
    class8WithinRadius?: number;
    closestClass8DistanceM?: number | null;
    fiveClosest?: unknown[];
    class8Chargers?: unknown[];
  };
  score?: {
    score?: number;
    method?: string;
    inputs?: string[];
    components?: { parking?: number; truck?: number; faf?: number; carrier?: number } | null;
    source?: string;
    title?: string | null;
  };
  freightContext?: {
    origin?: string;
    year?: number;
    totalKtons?: number;
    truckKtons?: number;
    truckValueUSD?: number;
  };
  whatsMissing?: {
    mobileEnergyOpportunity?: boolean;
    opportunityThreshold?: number;
    noClass8Charging?: boolean;
    noParkingCapacity?: boolean;
    noCarriersInRadius?: boolean;
    deferredToPhase13?: { detourCost?: string; environmentalBenefit?: string };
  };
}

const SYSTEM_PROMPT_PREFIX = `${FLEETVOLT_REPORT_NARRATIVE_CONTRACT}

APPLICATION SCOPE
Generate the hotspot section of a FleetVolt route report. This compact response is governed by FleetVolt Route Report Standard v${FLEETVOLT_REPORT_STANDARD_VERSION}; it is not a replacement for the complete ten-part route report.

CRITICAL HONESTY RULES:
1. The hotspot score is MODELED, not observed. Never say "observed", "measured", or "actual dwell data". Always say "modeled" or "estimated".
2. Every number in your brief MUST come from the provided report data. Do NOT invent numbers, estimates, or figures not present in the data.
3. If a data field is absent or zero, state that honestly — do not extrapolate.
4. The score is a composite of four proxies: NATD parking capacity, CalTrans 5-axle truck AADT, FAF zone-061 flow, and POLB carrier concentration. Name them when explaining why the hotspot exists.
5. Detour cost and environmental benefit are NOT computed — do not cite them as numbers. If relevant, say they require further analysis.
6. End the brief with a "Data Disclosure" line stating the score is modeled from public proxy data, not observed dwell telematics.

COMPACT HOTSPOT STRUCTURE:
## Board Answer
[2–3 sentences: what this hotspot is, its score, and the headline opportunity]

## Evidence Chain
[Explain the demand drivers using the four proxy inputs + freight context. Reference specific numbers from the data: carrier count, parking spots, AADT proxy component, FAF flow magnitude.]

## Favorability Assessment
[Assess how favorable this is for a mobile-energy deployment. Key signal: whatsMissing.mobileEnergyOpportunity — high modeled demand + zero Class-8 charging = strong opportunity. Reference the charger gap (class8WithinRadius) and what charging infrastructure exists or is missing.]

## Recommended Next Steps
[2–3 actionable items grounded in the data: e.g. "Target the N carriers within radius for outreach", "Assess depot charging feasibility given zero en-route Class-8 charging", "Validate parking capacity of N spots on-site"]

## Open Gates for the Full Route Report
[List route geometry, equal-work diesel-versus-BEV emissions, charger/trailer validation, field evidence, contact, and route-use facts that remain Not verified or Research required.]

## Data Disclosure
[One line: "Hotspot score is modeled from NATD parking capacity, CalTrans truck AADT, FAF freight flow, and POLB carrier concentration data. Not observed dwell telematics. Charging data from AFDC."]

GROUNDING DATA (the report payload — use ONLY these numbers):`;

export function buildBriefPrompt(reportPayload: unknown): {
  systemPrompt: string;
  userPrompt: string;
} {
  const payloadJson = JSON.stringify(reportPayload, null, 2);
  const systemPrompt = `${SYSTEM_PROMPT_PREFIX}\n${payloadJson}`;
  const userPrompt =
    `Generate the FleetVolt v${FLEETVOLT_REPORT_STANDARD_VERSION} compact hotspot brief.`;
  return { systemPrompt, userPrompt };
}

export function buildFallbackBrief(reportPayload: unknown): string {
  const r = (reportPayload as ReportPayload) ?? {};
  const score = r.score?.score ?? 0;
  const carrierCount = r.carriers?.length ?? 0;
  const totalSpots = r.parking?.totalSpots ?? 0;
  const class8WithinRadius = r.chargers?.class8WithinRadius ?? 0;
  const mobileEnergyOpportunity = r.whatsMissing?.mobileEnergyOpportunity ?? false;
  const truckKtons = r.freightContext?.truckKtons ?? 0;
  const truckValueUSD = r.freightContext?.truckValueUSD ?? 0;
  const freightOrigin = r.freightContext?.origin ?? "061";
  const freightYear = r.freightContext?.year ?? 2023;
  const parkingSites = r.parking?.count ?? 0;
  const title = r.score?.title ?? "Unnamed hotspot";

  const lines: string[] = [];
  lines.push("# Template Brief (LLM unavailable)");
  lines.push("");
  lines.push(`**Hotspot:** ${title} (modeled)`);
  lines.push("");
  lines.push("## Board Answer");
  lines.push(
    `This hotspot has a modeled demand score of ${score.toFixed(3)}, with ${carrierCount} carriers within radius, ${totalSpots} total parking spots, and ${class8WithinRadius} Class-8-capable chargers in radius.`,
  );
  lines.push("");
  lines.push("## Evidence Chain");
  lines.push(
    `The score is modeled from four public proxy inputs: ${PROXY_INPUTS.join(", ")}.`,
  );
  lines.push(
    `Freight context (FAF zone ${freightOrigin}, ${freightYear}): ${truckKtons.toFixed(1)}k truck ktons, $${(truckValueUSD / 1000).toFixed(1)}B truck value.`,
  );
  lines.push("");
  lines.push("## Favorability Assessment");
  if (mobileEnergyOpportunity) {
    lines.push(
      "**Mobile-energy opportunity identified**: high modeled demand + zero Class-8 charging in radius.",
    );
    lines.push(
      `This location is a strong candidate for mobile EV charging deployment.`,
    );
  } else {
    lines.push(
      "No mobile-energy opportunity flag — either score below threshold or Class-8 charging exists.",
    );
  }
  lines.push("");
  lines.push("## Recommended Next Steps");
  lines.push(`1. Target the ${carrierCount} carriers within radius for outreach.`);
  lines.push(
    `2. Assess charging infrastructure — ${class8WithinRadius} Class-8 chargers currently in radius.`,
  );
  lines.push(`3. Validate parking capacity of ${totalSpots} spots across ${parkingSites} sites.`);
  lines.push("");
  lines.push("## Open Gates for the Full Route Report");
  lines.push(
    "Route geometry, equal-work diesel-versus-BEV emissions, charger/trailer capability, field evidence, carrier contacts, and route use remain Research required unless verified in the full route evidence manifest.",
  );
  lines.push("");
  lines.push("## Data Disclosure");
  lines.push(
    "Hotspot score is modeled from NATD parking capacity, CalTrans truck AADT, FAF freight flow, and POLB carrier concentration data. Not observed dwell telematics. Charging data from AFDC.",
  );
  lines.push("");
  lines.push(
    "_Detour cost and environmental benefit are not computed — they require Phase-13 routing/physics analysis._",
  );

  return lines.join("\n");
}
