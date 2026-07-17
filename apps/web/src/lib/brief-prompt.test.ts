// Unit test: brief-prompt builder (pure functions, no network).
import { test } from "node:test";
import assert from "node:assert";
import { buildBriefPrompt, buildFallbackBrief } from "../../src/lib/brief-prompt.js";
import { FLEETVOLT_REPORT_STANDARD_VERSION } from "../../report-standard/fleetvolt-route-report-v1.js";

const sampleReport = {
  location: { lat: 33.754, lng: -118.216 },
  radiusM: 5000,
  carriers: [{ name: "Test Carrier", distanceM: 1000 }],
  parking: { totalSpots: 42, list: [] },
  pois: { total: 15, byType: { fuel: 5, convenience: 10 } },
  chargers: { class8WithinRadius: 3, fiveClosest: [] },
  score: { score: 0.621, method: "modeled", inputs: ["NATD_parking_capacity", "Caltrans_5axle_truckAADT", "FAF_zone061_flow", "POLB_carrier_concentration"] },
  freightContext: { truckKtons: 393438 },
  whatsMissing: { mobileEnergyOpportunity: false, deferredToPhase13: true },
};

test("buildBriefPrompt: system prompt has honesty rules + grounding injection", () => {
  const { systemPrompt, userPrompt } = buildBriefPrompt(sampleReport);
  assert.ok(systemPrompt.length > 100, "system prompt is substantial");
  assert.ok(/modeled/i.test(systemPrompt), "system prompt mentions 'modeled'");
  assert.ok(/GROUNDING DATA/i.test(systemPrompt), "system prompt injects grounding data");
  assert.ok(/detour|CO2|environmental/i.test(systemPrompt), "system prompt mentions detour/CO2 deferral");
  assert.ok(systemPrompt.includes(FLEETVOLT_REPORT_STANDARD_VERSION), "system prompt records the report standard version");
  assert.match(systemPrompt, /Command Brief narrative/);
  assert.match(systemPrompt, /Corridor White Paper design/);
  assert.match(systemPrompt, /Open Gates for the Full Route Report/);
  assert.ok(userPrompt.length > 0, "user prompt is non-empty");
});

test("buildBriefPrompt: every number must come from report data", () => {
  const { systemPrompt } = buildBriefPrompt(sampleReport);
  assert.ok(/number.*report|report.*number|data.*number/i.test(systemPrompt), "system prompt enforces data-grounded numbers");
});

test("buildFallbackBrief: has template label + modeled label", () => {
  const brief = buildFallbackBrief(sampleReport);
  assert.ok(/template|fallback|unavailable/i.test(brief), "fallback brief is labeled as template");
  assert.ok(/modeled/i.test(brief), "fallback brief mentions 'modeled'");
  assert.ok(brief.length > 50, "fallback brief is substantial");
});

test("buildFallbackBrief: does not fabricate LLM output", () => {
  const brief = buildFallbackBrief(sampleReport);
  // Should NOT contain OpenAI/GPT style language — it's a template
  assert.ok(!/as an ai|i think|in my opinion/i.test(brief), "no AI-style language in fallback");
});
