// generateSalesBrief — Convex action that generates an LLM-powered executive
// sales brief grounded in the hotspotReport payload.
//
// Flow:
//   1. Call hotspotReport query to get the grounding payload
//   2. Construct the prompt (system + user) per 15-AI-SPEC §3
//   3. Call OpenAI Chat Completions API (if OPENAI_API_KEY is set)
//   4. Return {brief, grounded, model, fallback}
//
// If OPENAI_API_KEY is not set, returns a STRUCTURED FALLBACK brief assembled
// from the report payload fields (template, not LLM) — clearly labeled
// "Template brief (LLM unavailable)". Still grounded, just template quality.
//
// NOTE: buildBriefPrompt + buildFallbackBrief are INLINED here (duplicated from
// src/lib/brief-prompt.ts) because Convex actions run in a sandbox that cannot
// import from the Next.js src/ directory. The canonical source is
// src/lib/brief-prompt.ts (testable without Convex); this is the deployment
// copy. If you change one, change both.
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

// ── INLINED from src/lib/brief-prompt.ts (deployment copy) ──────────────────

const PROXY_INPUTS = [
  "NATD_parking_capacity",
  "Caltrans_5axle_truckAADT",
  "FAF_zone061_flow",
  "POLB_carrier_concentration",
] as const;

const SYSTEM_PROMPT_PREFIX = `You are a freight electrification sales analyst. Generate an executive sales brief for a modeled truck parking/dwelling hotspot. The brief helps a BD team decide whether to pursue a mobile-energy (mobile EV charging) deployment at this location.

CRITICAL HONESTY RULES:
1. The hotspot score is MODELED, not observed. Never say "observed", "measured", or "actual dwell data". Always say "modeled" or "estimated".
2. Every number in your brief MUST come from the provided report data. Do NOT invent numbers, estimates, or figures not present in the data.
3. If a data field is absent or zero, state that honestly — do not extrapolate.
4. The score is a composite of four proxies: NATD parking capacity, CalTrans 5-axle truck AADT, FAF zone-061 flow, and POLB carrier concentration. Name them when explaining why the hotspot exists.
5. Detour cost and environmental benefit are NOT computed — do not cite them as numbers. If relevant, say they require further analysis.
6. End the brief with a "Data Disclosure" line stating the score is modeled from public proxy data, not observed dwell telematics.

BRIEF STRUCTURE:
## Executive Summary
[2–3 sentences: what this hotspot is, its score, and the headline opportunity]

## Why This Hotspot Exists
[Explain the demand drivers using the four proxy inputs + freight context. Reference specific numbers from the data: carrier count, parking spots, AADT proxy component, FAF flow magnitude.]

## Favorability Assessment
[Assess how favorable this is for a mobile-energy deployment. Key signal: whatsMissing.mobileEnergyOpportunity — high modeled demand + zero Class-8 charging = strong opportunity. Reference the charger gap (class8WithinRadius) and what charging infrastructure exists or is missing.]

## Recommended Next Steps
[2–3 actionable items grounded in the data: e.g. "Target the N carriers within radius for outreach", "Assess depot charging feasibility given zero en-route Class-8 charging", "Validate parking capacity of N spots on-site"]

## Data Disclosure
[One line: "Hotspot score is modeled from NATD parking capacity, CalTrans truck AADT, FAF freight flow, and POLB carrier concentration data. Not observed dwell telematics. Charging data from AFDC."]

GROUNDING DATA (the report payload — use ONLY these numbers):`;

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

function buildBriefPrompt(reportPayload: unknown): {
  systemPrompt: string;
  userPrompt: string;
} {
  const payloadJson = JSON.stringify(reportPayload, null, 2);
  const systemPrompt = `${SYSTEM_PROMPT_PREFIX}\n${payloadJson}`;
  const userPrompt = "Generate the executive sales brief for this hotspot.";
  return { systemPrompt, userPrompt };
}

function buildFallbackBrief(reportPayload: unknown): string {
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
  const poiTotal = r.pois?.total ?? 0;
  const parkingSites = r.parking?.count ?? 0;
  const title = r.score?.title ?? "Unnamed hotspot";

  const lines: string[] = [];
  lines.push("# Template Brief (LLM unavailable)");
  lines.push("");
  lines.push(`**Hotspot:** ${title} (modeled)`);
  lines.push("");
  lines.push("## Executive Summary");
  lines.push(
    `This hotspot has a modeled demand score of ${score.toFixed(3)}, with ${carrierCount} carriers within radius, ${totalSpots} total parking spots, and ${class8WithinRadius} Class-8-capable chargers in radius.`,
  );
  lines.push("");
  lines.push("## Why This Hotspot Exists");
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
      "This location is a strong candidate for mobile EV charging deployment.",
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
  lines.push(
    `3. Validate parking capacity of ${totalSpots} spots across ${parkingSites} sites.`,
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

// ── The Convex action ────────────────────────────────────────────────────────

interface BriefResult {
  brief: string;
  grounded: boolean;
  model: string;
  fallback: boolean;
}

export const generateSalesBrief = action({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusM: v.number(),
    hotspotId: v.optional(v.id("hotspots")),
  },
  handler: async (ctx, { lat, lng, radiusM, hotspotId }): Promise<BriefResult> => {
    // 1. Get the grounding payload from hotspotReport
    const report = await ctx.runQuery(api.report.hotspotReport, {
      lat,
      lng,
      radiusM,
      hotspotId: hotspotId ?? undefined,
    });

    // 2. Construct the prompt
    const { systemPrompt, userPrompt } = buildBriefPrompt(report);

    // 3. Check for API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        brief: buildFallbackBrief(report),
        grounded: true,
        model: "fallback",
        fallback: true,
      };
    }

    // 4. Call OpenAI Chat Completions
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      });

      if (!resp.ok) {
        // Non-200: return fallback with error model
        return {
          brief: buildFallbackBrief(report),
          grounded: true,
          model: "error",
          fallback: true,
        };
      }

      const json = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const brief =
        json.choices?.[0]?.message?.content ?? buildFallbackBrief(report);

      return {
        brief,
        grounded: true,
        model,
        fallback: false,
      };
    } catch {
      // fetch error/timeout: return fallback
      return {
        brief: buildFallbackBrief(report),
        grounded: true,
        model: "error",
        fallback: true,
      };
    }
  },
});
