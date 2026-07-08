// convex/planner.ts — AI planning action for the "Plan with AI" chat interface.
//
// Flow:
//   1. Receive { message, role, context? } from the chat UI
//   2. Call OpenAI with a system prompt that:
//      - Knows the user's role (driver / fleet_manager / caas)
//      - Has a TOOL LIST of all available Convex queries (names + signatures)
//      - Is instructed to output a structured JSON plan of which queries to run
//   3. Parse the LLM's plan, execute the planned Convex queries via ctx.runQuery
//      (the LLM does NOT call tools directly — we execute its plan)
//   4. Feed the query results back to the LLM for a final grounded answer
//   5. Return { answer, visualization, queries_run, role }
//
// GROUNDING + HONESTY rules enforced in both prompts (see SYSTEM_PROMPT).
// The planner never fabricates — if a query returns empty, the answer says so.
//
// Convex actions run in a sandbox: no node:crypto/fs/path. The OpenAI call uses
// fetch (same pattern as brief.ts). The OPENAI_API_KEY must be set in Convex env.

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

// ── Types ────────────────────────────────────────────────────────────────────

export type PlannerRole = "driver" | "fleet_manager" | "caas";

interface PlannedQuery {
  function: string;
  args: Record<string, unknown>;
  reason: string;
}

interface LlmPlan {
  queries: PlannedQuery[];
  visualization: "heatmap" | "route_map" | "table" | "text";
  summary: string;
}

interface QueryRun {
  name: string;
  args: Record<string, unknown>;
  result_summary: string;
  result?: unknown;
}

interface PlannerResult {
  answer: string;
  visualization: {
    type: "heatmap" | "route_map" | "table" | "text";
    data: unknown;
  };
  queries_run: QueryRun[];
  role: PlannerRole;
  model: string;
  fallback: boolean;
}

// ── Role-aware system prompt ────────────────────────────────────────────────

const ROLE_CONTEXT: Record<PlannerRole, string> = {
  driver: `ROLE: DRIVER
The user is a truck driver. Focus on:
- Class-8 chargers along their route (use chargers/queries: nearestClass8, fiveClosest)
- Services and amenities (use pois/queries: poisInRadius for fuel/food/parking)
- Route timing — can they complete N runs in 10 hours? (use physics/simulate if route+truck are known)
- Parking for rest/charging stops (use pois/queries: parkingInRadius)
Keep answers practical and driver-focused: where to charge, what's nearby, can I make it in time.`,

  fleet_manager: `ROLE: FLEET MANAGER
The user manages a fleet. Focus on:
- Fleet sizing: how many trucks needed for N containers/day (compute from round-trip time + gate hours + dwell)
- Gate hours + dwell times: Port of SF typical gate hours 6am-5pm M-F, average dwell 45-90 min
- Charging location planning: where along the route to charge (use chargers/queries + fleet/queries: getRouteChargers)
- Yard charging capabilities: kW needed to charge N trucks by a target time (compute from truck battery kWh + charge rate)
- Whether CaaS contracting is needed (use caas/queries if gap is severe)
- End-of-day routing to the fleet yard (use fleet/queries: listFleetParkingLots, listFleetRoutes)
- Use physics/simulate for energy/SoC/charging-stops when route+truck are specified
Keep answers operational: truck count, charge timing, kW requirements, yard planning.`,

  caas: `ROLE: CaaS (Charging-as-a-Service) PROVIDER
The user is a CaaS operator/siting analyst. Focus on:
- Charger gap analysis: where are Class-8 charging deserts? (use chargers/queries: class8Gap with corridorPoints)
- Carrier density and outreach targets (use carriers/queries: topCarriersNear, carrierDensityByCorridorCity)
- Deployment zones and siting recommendations (use caas/queries: listDeploymentZones, getZoneReport, getChargerGapByArea, listZonesByPriority)
- Hotspot reports for siting opportunities (use report: hotspotReport)
- Geo context (use geo/queries: listGeoRegions for state/county/air_district)
- Freight flow context (use faf/queries: freightContext)
- Heatmap visualization for gap severity
Keep answers strategic: gap size, carrier counts, zone priority, siting recommendations.`,
};

const TOOL_LIST = `AVAILABLE CONVEX QUERIES (the LLM plans which to call; the action executes them):

1. chargers/queries:nearestClass8 — args: { lat: number, lng: number, radiusM: number, limit?: number }
   Returns: nearest TRUE Class-8-capable chargers (≥350kW + MD/HD) within radius, ascending by distance.

2. chargers/queries:fiveClosest — args: { lat: number, lng: number, radiusM: number }
   Returns: the 5 nearest chargers regardless of class, with full config (powerKw, maxVehicleClass, connectorTypes, isClass8Capable).

3. chargers/queries:class8Gap — args: { corridorPoints: [{lat,lng},...], radiusM: number }
   Returns: { class8WithinCorridor, closestClass8DistanceM, class8Chargers[], fiveClosestAnyClass[] } — the honest gap over a corridor.

4. carriers/queries:carriersInRadius — args: { lat: number, lng: number, radiusM: number, limit?: number }
   Returns: located carriers within radius of a point, ascending by distance.

5. carriers/queries:carrierDensityByCorridorCity — args: {}
   Returns: { clusters: [{corridorCity, count}], totalInCorridor } — carrier count per corridor city.

6. carriers/queries:topCarriersNear — args: { lat: number, lng: number, radiusM: number, limit?: number }
   Returns: nearest located carriers to a point (name/city/corridorCity/distance) — the outreach list.

7. pois/queries:poisInRadius — args: { lat: number, lng: number, radiusM: number, types?: string[], limit?: number }
   Returns: POIs within radius, grouped by type (fuel/food/parking/rest/etc).

8. pois/queries:parkingInRadius — args: { lat: number, lng: number, radiusM: number, limit?: number }
   Returns: parking sites within radius + totalSpotsWithinRadius.

9. hotspots/queries:listModeledHotspots — args: {}
   Returns: all modeled dwell hotspots (precomputed scores, locations, titles).

10. geo/queries:listGeoRegions — args: { level?: "nation"|"state"|"county" }
    Returns: geo regions with fips/name/centroid/bbox/aggregateScore.

11. faf/queries:freightContext — args: { year: number, dmsOrig?: string, topN?: number }
    Returns: freight flow context (totalKtons, truckKtons, truckValueUSD, topDestinations, topCommodities).

12. trucks/queries:list — args: {}
    Returns: all 37 truck configs with OEM, batteryUsableKwh, streetEfficiencyKwhPerMi {min,max,typical}, batteryHealthGuidance, maxChargeRateKw, ratedRangeMiles, recommendedMilesPerCharge.

13. fleet/queries:getFleet — args: { fleetId: string }
    Returns: fleet company record.

14. fleet/queries:listFleetDrivers — args: { fleetId: string }
    Returns: drivers in the fleet.

15. fleet/queries:listFleetParkingLots — args: { fleetId: string }
    Returns: fleet yard/parking locations.

16. fleet/queries:listFleetRoutes — args: { fleetId: string }
    Returns: fleet routes.

17. fleet/queries:getFleetOverview — args: { fleetId: string }
    Returns: fleet overview (trucks, drivers, lots, routes summary).

18. fleet/queries:getRouteChargers — args: { routeId: string, radiusM?: number }
    Returns: chargers near a fleet route.

19. caas/queries:listDeploymentZones — args: { caasId: string }
    Returns: CaaS deployment zones.

20. caas/queries:getZoneReport — args: { zoneId: string }
    Returns: full zone report (delegates to hotspotReport).

21. caas/queries:getZoneGeoContext — args: { zoneId: string }
    Returns: zone geo context.

22. caas/queries:getChargerGapByArea — args: { level: "state"|"county"|"air_district"|"zip", fips?: string, airDistrict?: string, zipCode?: string }
    Returns: charger gap analysis by geographic area.

23. caas/queries:listZonesByPriority — args: { caasId: string }
    Returns: deployment zones ranked by priority.

24. highways/queries:mostCongestedRoute — args: { limit?: number }
    Returns: most congested highway routes.

25. highways/queries:corridorCongestion — args: { minLat, minLng, maxLat, maxLng }
    Returns: congestion data for a bbox.

26. highways/queries:segmentsInBbox — args: { minLat, minLng, maxLat, maxLng }
    Returns: highway segments in a bbox.

27. report:hotspotReport — args: { lat: number, lng: number, radiusM: number, hotspotId?: Id }
    Returns: { location, radiusM, carriers[], parking{count,totalSpots}, pois{total,byType}, chargers{class8WithinRadius,closestClass8DistanceM,class8Chargers[],fiveClosest[]}, score{score,method,inputs,components,source,title}, freightContext, whatsMissing }.

28. physics/simulate:simulate — args: { request: { route: {corridor_key?,origin?,dest?,terminal_key?}, truck: {slug}, conditions?: {weather_preset?,payload_lbs?,port_drayage_enabled?,charging?}, overrides?, options? } }
    Returns: full physics simulation (segments[], kpis{total_kwh,wh_per_mi,regen_kwh,total_time_s}, charging_stops[], feasibility).

IMPORTANT NOTES:
- The average kWh/mile across all truck models = average of streetEfficiencyKwhPerMi.typical across all 37 trucks from trucks/queries:list.
- Battery best practices = the batteryHealthGuidance from each truck config (dailyChargeTargetPct, operatingWindowMinPct/MaxPct, dodMaxPct).
- Port of San Francisco coordinates: approximately lat 37.78, lng -122.42.
- Modesto, CA coordinates: approximately lat 37.64, lng -120.99.
- The SF-to-Modesto corridor is ~90 miles via I-580 E and I-205 E.
- For corridor gap analysis, sample corridor points along the route at ~10-mile intervals.`;

const GROUNDING_RULES = `CRITICAL GROUNDING + HONESTY RULES:
1. Every number, distance, count, or claim in your answer MUST come from real query results. NEVER fabricate or estimate numbers not present in the data.
2. Modeled data (hotspot scores, dwell estimates) must be labeled "modeled" or "estimated" — NEVER "observed" or "measured".
3. If a query returns empty or zero results, state that honestly. Do not extrapolate.
4. If you don't have enough data to answer a sub-question, say "I don't have enough data to answer [X]" rather than guessing.
5. When computing averages (e.g., avg kWh/mi), show the computation from the actual data.
6. Label which queries produced which numbers in your answer (inline citations like "[from chargers/queries:class8Gap]").
7. For fleet sizing and timing calculations, show your work (round-trip time, gate hours, dwell assumptions, charge time).`;

const SYSTEM_PROMPT_PLAN = (role: PlannerRole) => `You are FleetVolt's AI planning assistant. Your job is to decompose a user's natural-language freight/charging/planning question into a structured plan of Convex queries to execute.

${ROLE_CONTEXT[role]}

${TOOL_LIST}

${GROUNDING_RULES}

OUTPUT FORMAT:
Respond with ONLY a JSON object (no markdown fences, no prose before/after) with this exact shape:
{
  "queries": [
    { "function": "<query name from the list above, e.g. 'chargers/queries:class8Gap'>", "args": { ... }, "reason": "<why this query is needed>" }
  ],
  "visualization": "heatmap" | "route_map" | "table" | "text",
  "summary": "<one-sentence summary of what the plan will answer>"
}

RULES FOR THE PLAN:
- Choose "heatmap" visualization when the user asks for gap analysis with a heat map (typically CaaS role).
- Choose "route_map" visualization when the user asks about a specific route with chargers/amenities along it (typically Driver or Fleet Manager).
- Choose "table" when the answer is best presented as structured data (carrier lists, truck specs, zone rankings).
- Choose "text" when no spatial visualization is needed.
- For corridor gap analysis, provide corridorPoints as an array of {lat, lng} sampling the route at ~10-mile intervals.
- For the SF-to-Modesto route, use these approximate corridor points:
  [{lat:37.78,lng:-122.42},{lat:37.70,lng:-122.10},{lat:37.69,lng:-121.77},{lat:37.67,lng:-121.44},{lat:37.65,lng:-121.11},{lat:37.64,lng:-120.99}]
- For top carriers near a region, use lat/lng of the region center and radiusM of 50000 (50km) or as appropriate.
- Do NOT include queries that aren't relevant to the question. Be selective.
- If the user mentions a specific fleet, use fleet/queries with an appropriate fleetId (use "fleet_demo_01" as default if none specified).
- If the user mentions a CaaS company, use caas/queries with caasId "caas_demo_01" as default.`;

const SYSTEM_PROMPT_ANSWER = (role: PlannerRole) => `You are FleetVolt's AI planning assistant. You are now writing the FINAL ANSWER to the user's question, grounded in the query results that were just executed.

${ROLE_CONTEXT[role]}

${GROUNDING_RULES}

OUTPUT FORMAT:
- Write in clear, well-structured Markdown (## headers, bullet lists, **bold** for key numbers).
- Start with a direct answer to the user's question in 1-2 sentences.
- Then provide supporting detail with specific numbers from the query results.
- Include a "## Data Sources" section at the end listing which queries were executed and what they returned.
- If the question involves a calculation (fleet sizing, charge time, etc.), show the math.
- Keep it concise but complete. No filler.`;

// ── The Convex action ─────────────────────────────────────────────────────────

export const planWithAi = action({
  args: {
    message: v.string(),
    role: v.union(
      v.literal("driver"),
      v.literal("fleet_manager"),
      v.literal("caas"),
    ),
    context: v.optional(v.string()),
  },
  handler: async (ctx, { message, role, context }): Promise<PlannerResult> => {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const queryId = `qry_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // ── No API key: return a fallback that explains the situation ──────────
    if (!apiKey) {
      return {
        answer:
          "## AI Planner Unavailable\n\nThe OpenAI API key is not configured on the Convex deployment. Set it with `npx convex env set OPENAI_API_KEY <value>`.\n\nIn the meantime, you can use the interactive Route Planner and Hotspot Report tools directly.",
        visualization: { type: "text", data: null },
        queries_run: [],
        role,
        model: "fallback",
        fallback: true,
      };
    }

    // ── Step 1: Ask the LLM to plan which queries to run ───────────────────
    const planResponse = await callOpenAI(apiKey, model, [
      {
        role: "system",
        content: SYSTEM_PROMPT_PLAN(role),
      },
      {
        role: "user",
        content: context
          ? `Previous context: ${context}\n\nQuestion: ${message}`
          : `Question: ${message}`,
      },
    ]);

    let plan: LlmPlan;
    try {
      // The LLM should return pure JSON, but be defensive about markdown fences
      const raw = planResponse.trim();
      const jsonStr = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      plan = JSON.parse(jsonStr);
    } catch {
      // If the LLM didn't return valid JSON, treat the response as a text answer
      return {
        answer: planResponse,
        visualization: { type: "text", data: null },
        queries_run: [],
        role,
        model,
        fallback: true,
      };
    }

    // ── Step 2: Execute the planned queries ───────────────────────────────
    // Each query is wrapped in try/catch. Errors are converted to human-readable
    // messages (no raw API paths like "chargers/queries:class8Gap" leaked to users).
    const queryRuns: QueryRun[] = [];
    const queryResults: Record<string, unknown> = {};
    let allQueriesFailed = false;
    let firstErrorMessage = "";

    for (const q of plan.queries) {
      try {
        const result = await executeQuery(ctx, q.function, q.args);
        const resultSummary = summarizeResult(q.function, result);
        queryRuns.push({
          name: q.function,
          args: q.args,
          result_summary: resultSummary,
          result,
        });
        queryResults[q.function] = result;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        const humanReadable = humanizeQueryError(q.function, errMsg);
        queryRuns.push({
          name: q.function,
          args: q.args,
          result_summary: `ERROR: ${humanReadable}`,
        });
        if (!firstErrorMessage) firstErrorMessage = humanReadable;
      }
    }

    // If ALL queries failed, return a human-readable error instead of passing
    // empty results to the LLM (which would produce a confusing "no data" answer)
    if (plan.queries.length > 0 && queryRuns.every((r) => r.result_summary.startsWith("ERROR:"))) {
      allQueriesFailed = true;
      const errorAnswer = buildErrorAnswer(firstErrorMessage, plan.queries.length);
      await ctx.runMutation(api["observability/mutations"].recordQueryHistory, {
        queryId,
        role,
        message,
        response: errorAnswer,
        visualizationType: "text",
        status: "error",
        errorMessage: firstErrorMessage,
        queriesRun: queryRuns.map((r) => ({ name: r.name, args: r.args, result_summary: r.result_summary })),
      }).catch(() => undefined);
      for (const run of queryRuns.filter((r) => r.result_summary.startsWith("ERROR:"))) {
        await ctx.runMutation(api["observability/mutations"].recordQueryResponseError, {
          errorId: `qerr_${queryId}_${Math.random().toString(36).slice(2, 8)}`,
          queryId,
          functionName: run.name,
          args: run.args,
          errorMessage: run.result_summary,
          errorKind: "planner_query_error",
        }).catch(() => undefined);
      }
      return {
        answer: errorAnswer,
        visualization: { type: "text", data: null },
        queries_run: queryRuns.map((r) => ({
          name: r.name,
          args: r.args,
          result_summary: r.result_summary,
        })),
        role,
        model,
        fallback: true,
      };
    }
    // Suppress unused variable warning
    void allQueriesFailed;

    // ── Step 3: Feed results back to the LLM for a grounded answer ────────
    const resultsContext = JSON.stringify(
      { message, role, plan, queryResults: queryRuns.map((r) => ({ name: r.name, args: r.args, result_summary: r.result_summary, result: r.result })) },
      null,
      2,
    );

    const answerResponse = await callOpenAI(apiKey, model, [
      {
        role: "system",
        content: SYSTEM_PROMPT_ANSWER(role),
      },
      {
        role: "user",
        content: `Original question: ${message}\n\nExecuted query results (use ONLY these numbers in your answer):\n\n${resultsContext}`,
      },
    ]);

    // ── Step 4: Build visualization data ──────────────────────────────────
    const vizData = buildVisualizationData(plan.visualization, queryResults);

    await ctx.runMutation(api["observability/mutations"].recordQueryHistory, {
      queryId,
      role,
      message,
      response: answerResponse,
      visualizationType: plan.visualization,
      status: queryRuns.some((r) => r.result_summary.startsWith("ERROR:")) ? "error" : "success",
      errorMessage: queryRuns.find((r) => r.result_summary.startsWith("ERROR:"))?.result_summary,
      queriesRun: queryRuns.map((r) => ({ name: r.name, args: r.args, result_summary: r.result_summary })),
    }).catch(() => undefined);

    return {
      answer: answerResponse,
      visualization: {
        type: plan.visualization,
        data: vizData,
      },
      queries_run: queryRuns.map((r) => ({
        name: r.name,
        args: r.args,
        result_summary: r.result_summary,
      })),
      role,
      model,
      fallback: false,
    };
  },
});

// ── OpenAI helper ────────────────────────────────────────────────────────────

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "unknown error");
    throw new Error(`OpenAI API error ${resp.status}: ${errText}`);
  }

  const json = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

// ── Human-readable error helpers ─────────────────────────────────────────────
// Converts raw Convex API errors into plain-language messages.
// Never exposes raw API paths like "chargers/queries:class8Gap" to the user.

function humanizeQueryError(functionName: string, errMsg: string): string {
  // Categorize by query module
  const module = functionName.split("/")[0] ?? "data";
  const isConvexConnectionError = errMsg.includes("Auth") || errMsg.includes("auth") || errMsg.includes("connection") || errMsg.includes("network");
  const isTableError = errMsg.includes("not found") || errMsg.includes("does not exist") || errMsg.includes("table");
  const isArgError = errMsg.includes("argument") || errMsg.includes("args") || errMsg.includes("required");

  if (isConvexConnectionError) {
    return `I couldn't connect to the database to retrieve ${module} data. The Convex backend may be temporarily unavailable. Try again in a moment, or check the backend status.`;
  }
  if (isTableError) {
    return `The ${module} data isn't available yet. This usually means the database tables haven't been seeded. Try running the seed scripts or contact an administrator.`;
  }
  if (isArgError) {
    return `The query for ${module} data was given invalid parameters. Try rephrasing your question with more specific details (e.g., exact city names or coordinates).`;
  }
  // Generic fallback — no raw API paths
  return `I couldn't retrieve ${module} data for this route. ${errMsg.slice(0, 120)}. Try selecting a specific corridor first, or check that the Convex backend is connected.`;
}

function buildErrorAnswer(firstError: string, queryCount: number): string {
  return `## I couldn't retrieve the data for this route\n\n${firstError}\n\n**What to try:**\n- Select a specific corridor from the sidebar, then retry\n- Check that the Convex backend is running and seeded\n- If the problem persists, contact an administrator\n\n*(${queryCount} data ${queryCount === 1 ? "query" : "queries"} failed)*`;
}

// ── Query executor ───────────────────────────────────────────────────────────
// Maps the LLM's function name to the actual Convex query via ctx.runQuery.
// This is a controlled dispatch — the LLM can only call functions we've mapped.

async function executeQuery(
  ctx: any,
  functionName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (functionName) {
    case "chargers/queries:nearestClass8":
      return await ctx.runQuery(api.chargers.queries.nearestClass8, args as any);
    case "chargers/queries:fiveClosest":
      return await ctx.runQuery(api.chargers.queries.fiveClosest, args as any);
    case "chargers/queries:class8Gap":
      return await ctx.runQuery(api.chargers.queries.class8Gap, args as any);
    case "carriers/queries:carriersInRadius":
      return await ctx.runQuery(api.carriers.queries.carriersInRadius, args as any);
    case "carriers/queries:carrierDensityByCorridorCity":
      return await ctx.runQuery(api.carriers.queries.carrierDensityByCorridorCity, args as any);
    case "carriers/queries:topCarriersNear":
      return await ctx.runQuery(api.carriers.queries.topCarriersNear, args as any);
    case "pois/queries:poisInRadius":
      return await ctx.runQuery(api.pois.queries.poisInRadius, args as any);
    case "pois/queries:parkingInRadius":
      return await ctx.runQuery(api.pois.queries.parkingInRadius, args as any);
    case "hotspots/queries:listModeledHotspots":
      return await ctx.runQuery(api.hotspots.queries.listModeledHotspots, args as any);
    case "geo/queries:listGeoRegions":
      return await ctx.runQuery(api.geo.queries.listGeoRegions, args as any);
    case "faf/queries:freightContext":
      return await ctx.runQuery(api.faf.queries.freightContext, args as any);
    case "trucks/queries:list":
      return await ctx.runQuery(api.trucks.queries.list, args as any);
    case "fleet/queries:getFleet":
      return await ctx.runQuery(api.fleet.queries.getFleet, args as any);
    case "fleet/queries:listFleetDrivers":
      return await ctx.runQuery(api.fleet.queries.listFleetDrivers, args as any);
    case "fleet/queries:listFleetParkingLots":
      return await ctx.runQuery(api.fleet.queries.listFleetParkingLots, args as any);
    case "fleet/queries:listFleetRoutes":
      return await ctx.runQuery(api.fleet.queries.listFleetRoutes, args as any);
    case "fleet/queries:getFleetOverview":
      return await ctx.runQuery(api.fleet.queries.getFleetOverview, args as any);
    case "fleet/queries:getRouteChargers":
      return await ctx.runQuery(api.fleet.queries.getRouteChargers, args as any);
    case "caas/queries:listDeploymentZones":
      return await ctx.runQuery(api.caas.queries.listDeploymentZones, args as any);
    case "caas/queries:getZoneReport":
      return await ctx.runQuery(api.caas.queries.getZoneReport, args as any);
    case "caas/queries:getZoneGeoContext":
      return await ctx.runQuery(api.caas.queries.getZoneGeoContext, args as any);
    case "caas/queries:getChargerGapByArea":
      return await ctx.runQuery(api.caas.queries.getChargerGapByArea, args as any);
    case "caas/queries:listZonesByPriority":
      return await ctx.runQuery(api.caas.queries.listZonesByPriority, args as any);
    case "highways/queries:mostCongestedRoute":
      return await ctx.runQuery(api.highways.queries.mostCongestedRoute, args as any);
    case "highways/queries:corridorCongestion":
      return await ctx.runQuery(api.highways.queries.corridorCongestion, args as any);
    case "highways/queries:segmentsInBbox":
      return await ctx.runQuery(api.highways.queries.segmentsInBbox, args as any);
    case "report:hotspotReport":
      return await ctx.runQuery(api.report.hotspotReport, args as any);
    default:
      throw new Error(`Unknown query function: ${functionName}`);
  }
}

// ── Result summarizer (for the "Queries executed" panel) ─────────────────────

function summarizeResult(functionName: string, result: unknown): string {
  if (result === null || result === undefined) return "null";
  if (Array.isArray(result)) return `${result.length} rows`;
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    // Common summary shapes
    if ("class8WithinCorridor" in obj) {
      return `class8WithinCorridor=${obj.class8WithinCorridor}, closest=${obj.closestClass8DistanceM ?? "none"}m`;
    }
    if ("carriers" in obj && Array.isArray(obj.carriers)) {
      return `${(obj.carriers as unknown[]).length} carriers`;
    }
    if ("clusters" in obj) {
      return `${(obj.clusters as unknown[]).length} corridor-city clusters, totalInCorridor=${obj.totalInCorridor ?? "?"}`;
    }
    if ("class8WithinRadius" in obj) {
      return `class8WithinRadius=${obj.class8WithinRadius}`;
    }
    if ("totalSpots" in obj) {
      return `totalSpots=${obj.totalSpots}, count=${obj.count ?? "?"}`;
    }
    if ("total" in obj && "byType" in obj) {
      return `${obj.total} POIs`;
    }
    if ("score" in obj && typeof obj.score === "object") {
      const score = (obj.score as Record<string, unknown>)?.score ?? "?";
      return `modeled score=${score}`;
    }
    if ("rowCount" in obj) {
      return `${obj.rowCount} FAF rows, truckKtons=${obj.truckKtons ?? "?"}`;
    }
    // Generic: count keys
    const keys = Object.keys(obj);
    return `${keys.length} fields: ${keys.slice(0, 5).join(", ")}${keys.length > 5 ? "..." : ""}`;
  }
  return String(result).slice(0, 120);
}

// ── Visualization data builder ───────────────────────────────────────────────
// Extracts the data the frontend needs for each viz type from the query results.

function buildVisualizationData(
  vizType: string,
  queryResults: Record<string, unknown>,
): unknown {
  switch (vizType) {
    case "heatmap": {
      // For heatmap: extract class8Gap result (corridor points + gap data)
      // + carrier locations + existing charger pins
      const gapResult = queryResults["chargers/queries:class8Gap"] as
        | { class8Chargers?: unknown[]; fiveClosestAnyClass?: unknown[] }
        | undefined;
      const topCarriers = queryResults["carriers/queries:topCarriersNear"] as
        | unknown[]
        | undefined;
      const nearestClass8 = queryResults["chargers/queries:nearestClass8"] as
        | unknown[]
        | undefined;
      return {
        gap: gapResult
          ? {
              class8Count: gapResult.class8Chargers?.length ?? 0,
              chargers: gapResult.class8Chargers ?? [],
              fiveClosest: gapResult.fiveClosestAnyClass ?? [],
            }
          : null,
        carriers: topCarriers ?? [],
        existingChargers: nearestClass8 ?? [],
      };
    }
    case "route_map": {
      // For route_map: extract charger pins + POI pins + carrier locations
      const nearestClass8 = queryResults["chargers/queries:nearestClass8"] as
        | unknown[]
        | undefined;
      const fiveClosest = queryResults["chargers/queries:fiveClosest"] as
        | unknown[]
        | undefined;
      const pois = queryResults["pois/queries:poisInRadius"] as
        | { pois?: unknown[] }
        | undefined;
      const parking = queryResults["pois/queries:parkingInRadius"] as
        | { parking?: unknown[] }
        | undefined;
      const carriers = queryResults["carriers/queries:carriersInRadius"] as
        | unknown[]
        | undefined;
      return {
        chargers: {
          class8: nearestClass8 ?? [],
          fiveClosest: fiveClosest ?? [],
        },
        pois: pois?.pois ?? [],
        parking: parking?.parking ?? [],
        carriers: carriers ?? [],
      };
    }
    case "table": {
      // For table: return whatever tabular data was queried
      // The frontend will render the first array result as a table
      for (const [, value] of Object.entries(queryResults)) {
        if (Array.isArray(value) && value.length > 0) {
          return { rows: value };
        }
        if (value && typeof value === "object") {
          const obj = value as Record<string, unknown>;
          if ("clusters" in obj && Array.isArray(obj.clusters)) {
            return { rows: obj.clusters };
          }
          if ("carriers" in obj && Array.isArray(obj.carriers)) {
            return { rows: obj.carriers };
          }
        }
      }
      return { rows: [] };
    }
    default:
      return null;
  }
}
