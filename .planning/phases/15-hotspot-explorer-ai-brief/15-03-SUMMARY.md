---
phase: 15-hotspot-explorer-ai-brief
plan: 03
subsystem: frontend
tags: [llm, sales-brief, ai, grounding, honesty, convex-action]
requirements: [FLAGSHIP-01]
---

# Plan 15-03 Summary — LLM Sales Brief Generation

## Status: COMPLETE

### Tasks
1. **brief-prompt.ts** (pure, testable) — `buildBriefPrompt(reportPayload)` returns `{systemPrompt, userPrompt}` with honesty rules from 15-AI-SPEC §3 (score is MODELED, every number from report data, detour/CO2 not computed, mandatory Data Disclosure). System prompt ends with `GROUNDING DATA:` + JSON. `buildFallbackBrief(reportPayload)` returns a structured template brief labeled "Template brief (LLM unavailable)".
2. **brief.ts** (Convex action) — `generateSalesBrief({lat,lng,radiusM,hotspotId?})` fetches `hotspotReport`, constructs prompt, calls OpenAI Chat Completions (if `OPENAI_API_KEY` set), returns `{brief, grounded, model, fallback}`. Falls back to template if no key. (Committed in 13-02 commit due to import fix.)
3. **brief-panel.tsx** (UI) — `useAction(api.brief.generateSalesBrief)` with loading skeleton, error state, markdown brief render. Header: model name, "grounded" badge, fallback indicator. "Regenerate" button.

### Commits
- `feat(15-03): LLM sales brief — prompt builder + BriefPanel UI` (this plan)
- `brief.ts` Convex action import fix in 13-02 commit (import paths `../_generated` → `./_generated`)

### Verification
- tsc clean (except pre-existing scenario-form.tsx + Phase-13 simulate.ts implicit-any)
- Convex codegen passes
- OPENAI_API_KEY not set in Convex env — fallback template path is exercised (valid per AI-SPEC §7)

### Follow-ups
- Set `OPENAI_API_KEY` in Convex env (`npx convex env set OPENAI_API_KEY <value>`) to enable live LLM briefs
- Write 15-04 integration tests + full suite gate
