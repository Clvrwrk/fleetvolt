---
phase: 15-hotspot-explorer-ai-brief
plan: 04
subsystem: testing
tags: [integration, unit, suite-gate, phase15]
requirements: [FLAGSHIP-01]
---

# Plan 15-04 Summary — Integration Tests + Full Suite Gate

## Status: COMPLETE

### Tasks
1. **Integration test** (hotspots/queries.test.ts) — 2 live-deployment tests: listModeledHotspots returns 5+ hotspots with scores; listGeoRegions returns 60 regions (58 CA counties + state) with all 3 corridor counties carrying aggregateScore (LA 0.536, Riverside 0.555, SB 0.426). Both green.
2. **Unit test** (src/lib/brief-prompt.test.ts) — 4 pure tests: honesty rules in system prompt, grounding JSON injection, modeled label in fallback, no fabricated AI language. All green.
3. **Full suite gate** — 14/14 Phase 15 tests green (2 live + 4 prompt + 8 score).

### Commits
- `test(15-04): Phase 15 integration + unit tests + full suite gate (14/14 green)`

### Verification
- Live deployment queries work via ConvexHttpClient reading NEXT_PUBLIC_CONVEX_URL from .env.local
- Score tests enforce the 5-layer honesty propagation
- Brief-prompt tests enforce honesty rules + grounding + no-fabrication guardrails
- Also fixed: moved capturePythonBaseline.ts out of convex/ (was breaking Convex codegen with node:fs/path/url imports)

### Phase 15 Complete
All 4 plans done (15-01 map explorer, 15-02 report panel, 15-03 LLM brief, 15-04 tests).
14/14 tests green. tsc clean except pre-existing.
