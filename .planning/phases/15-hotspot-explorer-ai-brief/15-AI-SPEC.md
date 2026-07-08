# AI-SPEC — Phase 15: Hotspot Explorer + AI Brief

**Phase:** 15 — Hotspot Explorer — Drill-Down UI + Executive Sales Brief
**System Type:** Grounded text generation (single-turn, retrieval-augmented)
**Domain:** Freight electrification sales intelligence
**Date:** 2026-07-07
**Status:** Planning artifact (generated as part of `/gsd-plan-phase`)

---

## 1. System Classification

| Attribute | Value |
|-----------|-------|
| **System type** | Grounded LLM text generation (single-turn, no agent loop) |
| **Interaction pattern** | User clicks a hotspot → system fetches `hotspotReport` payload → LLM generates an executive sales brief grounded in that payload |
| **Output modality** | Structured markdown text (~400–800 words) |
| **Latency budget** | <15s end-to-end (report query + LLM call + rendering) |
| **Criticality** | Sales-facing — incorrect numbers or fabricated claims directly damage credibility with clients |
| **Multi-turn?** | No — single prompt/response per hotspot. Future: follow-up Q&A (deferred) |

---

## 2. Framework Selection

### Selected Framework: Direct LLM API call from Convex action

**Provider:** OpenAI (primary) — `gpt-4o` or `gpt-4o-mini`
**Alternative:** Anthropic Claude (`claude-sonnet-4-20250514`) — same pattern, swap the fetch URL + auth header
**Transport:** `fetch()` from inside a Convex `action` (Convex actions support outbound HTTP)

### Rationale

| Criterion | Direct API from Convex action | LangChain/LlamaIndex | Vercel AI SDK |
|-----------|------------------------------|----------------------|---------------|
| Complexity | Lowest — one `fetch`, one JSON parse | High — framework overhead for a single-turn call | Medium — adds a client dependency |
| Convex compatibility | Native — actions are Node.js sandbox | Requires bundling into action | Designed for Next.js routes, not Convex actions |
| Grounding control | Full — we construct the exact prompt | Framework abstracts prompt construction | SDK manages prompt/streaming |
| Auditability | Maximum — prompt is a string we control | Hidden behind chain abstractions | Partial |
| Streaming | Not needed (brief is <800 words, <5s generate) | Supported but unnecessary | Native streaming |

**Decision:** Direct `fetch` to OpenAI Chat Completions API from a Convex action. No framework — the grounding contract is a structured JSON payload injected into the system prompt, and the output is plain markdown. This keeps the prompt fully auditable and avoids framework lock-in for what is fundamentally a single-turn grounded generation task.

### Why not an agent loop?

The brief is a single document derived from a single data source (`hotspotReport`). There is no multi-step reasoning, no tool use, no retrieval iteration — the data is already gathered and structured by the report query. An agent loop would add latency and non-determinism without improving output quality.

---

## 3. Grounding Contract

### What is injected

The **entire `hotspotReport` payload** is serialized and injected as the system prompt's grounding context. This is the same payload the drill-down UI renders — single source of truth, no parallel data path.

```
hotspotReport({lat, lng, radiusM, hotspotId?}) → {
  location: {lat, lng},
  radiusM,
  carriers: [{name, city, corridorCity, location, distanceM}],
  parking: {count, totalSpots, parking: [{name, numberOfSpots, hgv, location, distanceM}]},
  pois: {total, byType: {convenience: N, fuel: N, ...}, pois: [{type, name, location, distanceM}]},
  chargers: {
    fiveClosest: [{stationId, name, powerKw, maxVehicleClass, connectorTypes, isClass8Capable, distanceM}],
    class8WithinRadius: number,
    closestClass8DistanceM: number | null,
    class8Chargers: [...]
  },
  score: {
    score: number,           // 0–1 composite
    method: "modeled",       // HONESTY LABEL — always "modeled", never "observed"
    inputs: ["NATD_parking_capacity", "Caltrans_5axle_truckAADT", "FAF_zone061_flow", "POLB_carrier_concentration"],
    components: {parking, truck, faf, carrier},  // per-proxy normalized 0–1
    source: "persisted" | "inline",
    hotspotId: string | null,
    title: string | null
  },
  freightContext: {origin, year, rowCount, totalKtons, totalValueUSD, truckKtons, truckValueUSD},
  whatsMissing: {
    mobileEnergyOpportunity: boolean,
    opportunityThreshold: number,
    noClass8Charging: boolean,
    noParkingCapacity: boolean,
    noCarriersInRadius: boolean,
    deferredToPhase13: {detourCost: "external...", environmentalBenefit: "external..."}
  }
}
```

### Prompt structure

```
SYSTEM:
You are a freight electrification sales analyst. Generate an executive sales brief
for a modeled truck parking/dwelling hotspot. The brief helps a BD team decide
whether to pursue a mobile-energy (mobile EV charging) deployment at this location.

CRITICAL HONESTY RULES:
1. The hotspot score is MODELED, not observed. Never say "observed", "measured",
   or "actual dwell data". Always say "modeled" or "estimated".
2. Every number in your brief MUST come from the provided report data. Do NOT
   invent numbers, estimates, or figures not present in the data.
3. If a data field is absent or zero, state that honestly — do not extrapolate.
4. The score is a composite of four proxies: NATD parking capacity, CalTrans
   5-axle truck AADT, FAF zone-061 flow, and POLB carrier concentration. Name
   them when explaining why the hotspot exists.
5. Detour cost and environmental benefit are NOT computed — do not cite them
   as numbers. If relevant, say they require further analysis.
6. End the brief with a "Data Disclosure" line stating the score is modeled
   from public proxy data, not observed dwell telematics.

BRIEF STRUCTURE:
## Executive Summary
[2–3 sentences: what this hotspot is, its score, and the headline opportunity]

## Why This Hotspot Exists
[Explain the demand drivers using the four proxy inputs + freight context.
Reference specific numbers from the data: carrier count, parking spots, AADT
proxy component, FAF flow magnitude.]

## Favorability Assessment
[Assess how favorable this is for a mobile-energy deployment. Key signal:
whatsMissing.mobileEnergyOpportunity — high modeled demand + zero Class-8
charging = strong opportunity. Reference the charger gap (class8WithinRadius)
and what charging infrastructure exists or is missing.]

## Recommended Next Steps
[2–3 actionable items grounded in the data: e.g. "Target the N carriers
within radius for outreach", "Assess depot charging feasibility given zero
en-route Class-8 charging", "Validate parking capacity of N spots on-site"]

## Data Disclosure
[One line: "Hotspot score is modeled from NATD parking capacity, CalTrans
truck AADT, FAF freight flow, and POLB carrier concentration data. Not
observed dwell telematics. Charging data from AFDC."]

GROUNDING DATA (the report payload — use ONLY these numbers):
{JSON.stringify(hotspotReport payload)}

USER:
Generate the executive sales brief for this hotspot.
```

---

## 4. Guardrails Against Hallucination

| Guardrail | Implementation | Verification |
|-----------|---------------|--------------|
| **No fabricated numbers** | System prompt instructs "every number MUST come from the provided report data"; the report payload is the only context provided (no external knowledge injection) | `brief.test.ts` extracts all numbers from the brief and asserts each appears in the report payload |
| **Modeled never observed** | System prompt: "Never say observed/measured/actual dwell data"; score.method is "modeled" in the injected payload | `brief.test.ts` asserts the brief contains "modeled" and does NOT contain "observed dwell" or "measured dwell" |
| **No detour/CO2 fabrication** | System prompt: "Detour cost and environmental benefit are NOT computed — do not cite them as numbers"; `deferredToPhase13` markers are in the payload | `brief.test.ts` asserts no detour km or CO2 kg figures appear unless present in the payload (they won't be) |
| **Data disclosure present** | System prompt mandates a "Data Disclosure" section; structure is enforced | `brief.test.ts` asserts the brief contains "## Data Disclosure" and "modeled" |
| **Four proxies named** | System prompt lists the four proxy names; score.inputs is in the payload | `brief.test.ts` asserts the brief mentions at least 2 of the 4 proxy names |
| **Grounding traceability** | Every claim must trace to a data field — the prompt says "Reference specific numbers from the data" | Manual review + the number-extraction test above |
| **Brief length bounded** | Prompt specifies ~400–800 words; prevents runaway generation | `brief.test.ts` asserts word count is between 200 and 1200 |

---

## 5. How the Modeled-Score Honesty Label Propagates

```
hotspots/score.ts (Phase 12)
  └─ computeHotspotScore() always returns method:"modeled" + inputs[4 proxies]
     └─ persisted to hotspots table: provenance{source:"ESTIMATE", method:"modeled", inputs[]}
        └─ hotspotReport query reads the persisted score → score.method:"modeled" in the payload
           └─ AI-SPEC §3: system prompt receives score.method:"modeled" in the grounding JSON
              └─ System prompt rule #1: "Never say observed/measured/actual dwell data"
                 └─ LLM output uses "modeled"/"estimated" language
                    └─ Data Disclosure section reinforces: "modeled from proxy data, not observed"
                       └─ brief.test.ts asserts: no "observed dwell", contains "modeled"
```

The honesty label propagates through FIVE layers:
1. **Score function** (score.ts): `method: "modeled"` hardcoded
2. **Persistence** (hotspots table): `provenance.source: "ESTIMATE"`, `provenance.method: "modeled"`
3. **Report query** (report.ts): `scorePayload.method = "modeled"` (literal in code)
4. **Prompt** (brief prompt): system prompt rule #1 + the JSON payload carries `method:"modeled"`
5. **Output verification** (brief.test.ts): asserts "modeled" present, "observed dwell" absent

---

## 6. Evaluation Strategy

### Dimensions

| Dimension | What we check | How |
|-----------|--------------|-----|
| **Grounding fidelity** | Every number in the brief exists in the report payload | Extract numbers via regex, assert each is in the payload |
| **Honesty label** | Brief says "modeled", never "observed dwell" | String assertions |
| **Structural completeness** | All 5 sections present (Executive Summary, Why, Favorability, Next Steps, Data Disclosure) | Regex heading check |
| **Bounded length** | 200–1200 words | Word count |
| **Proxy attribution** | At least 2 of 4 proxy names mentioned | String search for proxy name fragments |
| **No fabrication** | No detour km or CO2 kg numbers | Regex for number+unit patterns not in payload |

### Test approach

- **Unit test** (`brief.test.ts`): Calls the `generateSalesBrief` action with a known POLB-corridor hotspot, asserts all dimensions above. Uses the live Convex deployment (`sensible-oriole-832`) for the report payload, but mocks the LLM call (or uses a live key if provisioned) — skips loudly if the LLM key is absent.
- **Manual review**: A human reads 3 briefs for 3 different hotspots and checks that claims trace to data fields. This is the end-of-phase human verification gate.

### Tracing

Not applicable for MVP — this is an internal sales tool, not a production AI system with monitoring requirements. If the brief is later productized, add OpenAI usage logging + Arize Phoenix for prompt tracing.

---

## 7. Configuration

| Env var | Where | Purpose |
|---------|-------|---------|
| `OPENAI_API_KEY` | Convex env (`npx convex env set OPENAI_API_KEY <value>`) | LLM API auth |
| `OPENAI_MODEL` | Convex env (optional, default `gpt-4o-mini`) | Model selection |

If `OPENAI_API_KEY` is not set, the `generateSalesBrief` action returns a **structured fallback** — a template brief assembled from the report payload fields (no LLM call). This ensures the UI never breaks in environments without an LLM key, and the fallback is still grounded (it just lacks the narrative quality of the LLM version). The fallback is clearly labeled "Template brief (LLM unavailable)".

---

## 8. Alternatives Considered

| Alternative | Why rejected |
|-------------|-------------|
| LangChain | Framework overhead for a single-turn call; hides prompt from audit |
| Vercel AI SDK (`ai` package) | Designed for Next.js routes, not Convex actions; adds streaming complexity we don't need |
| Google Gemini | Viable (Chris has Google console), but OpenAI has simpler Chat Completions API for this use case; Gemini is the swap-in alternative if cost/availability favors it |
| Local model (Ollama) | Not available in Convex action sandbox; would require a separate service |
| No LLM (template-only) | Fallback exists, but the LLM version provides the narrative quality that makes the brief a "sales" tool vs a data dump |

---

## Checklist

- [x] Framework selected with rationale (§2)
- [x] Grounding contract defined — report payload is the single source (§3)
- [x] Prompt structure specified with all 5 brief sections (§3)
- [x] Guardrails against hallucination defined and testable (§4)
- [x] Modeled-score honesty propagation documented through 5 layers (§5)
- [x] Evaluation strategy with 6 testable dimensions (§6)
- [x] Configuration + fallback strategy (§7)
- [x] Alternatives considered and rejected with rationale (§8)
