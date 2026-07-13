---
phase: quick
plan: 260709-szr
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/convex/geo/ingestZcta.ts
  - apps/web/convex/workbench/ai.ts
  - apps/web/src/lib/maps/ptv-routes.ts
  - apps/web/src/stores/map-workbench-store.test.ts
  - apps/web/src/components/workbench/map-workbench/fleetvolt-map-canvas.tsx
  - apps/web/src/components/workbench/map-workbench/layers/caas-choropleth-layer.tsx
  - apps/web/src/components/workbench/map-workbench/layers/generator-spokes-layer.tsx
autonomous: true
must_haves:
  truths:
    - "The active CaaS geospatial and California choropleth WIP contributes no TypeScript errors in its touched repair files."
    - "The active WIP contributes no ESLint errors or warnings in its touched repair files."
    - "Offline AADT sampling, PTV route parsing, and CaaS store behavior tests pass without requiring a Convex deployment."
    - "Unrelated pre-existing typecheck and lint failures remain outside this quick task and are not edited."
    - "Live Convex verification is reported separately as pass or deployment/network-blocked, never conflated with local unit coverage."
  artifacts:
    - path: "apps/web/convex/geo/ingestZcta.ts"
      provides: "Explicitly typed ZCTA ingest/purge action results without recursive generated-API inference"
    - path: "apps/web/convex/workbench/ai.ts"
      provides: "CaaS map action layer contract that accepts the ports layer"
    - path: "apps/web/src/lib/maps/ptv-routes.ts"
      provides: "Type-safe PTV string/GeoJSON polyline parsing"
    - path: "apps/web/src/components/workbench/map-workbench/fleetvolt-map-canvas.tsx"
      provides: "CaaS map asset merge without shadowing the JavaScript Map constructor"
    - path: "apps/web/src/components/workbench/map-workbench/layers/caas-choropleth-layer.tsx"
      provides: "Stable choropleth region dependency identity"
    - path: "apps/web/src/components/workbench/map-workbench/layers/generator-spokes-layer.tsx"
      provides: "Stable generator-spoke dependency identity"
    - path: "apps/web/src/stores/map-workbench-store.test.ts"
      provides: "WorkbenchAiResult-complete CaaS AI fixtures"
  key_links:
    - from: "apps/web/convex/workbench/ai.ts"
      to: "apps/web/src/components/workbench/map-workbench/types.ts"
      via: "Matching WorkbenchLayerId support for the ports CaaS layer"
      pattern: '"ports"'
    - from: "apps/web/src/components/workbench/map-workbench/fleetvolt-map-canvas.tsx"
      to: "apps/web/src/components/workbench/map-workbench/layers/caas-choropleth-layer.tsx"
      via: "CaaS geo-level query data rendered on the Google map"
      pattern: "CaasChoroplethLayer"
    - from: "apps/web/src/lib/maps/ptv-routes.ts"
      to: "apps/web/src/lib/maps/ptv-routes.test.ts"
      via: "String and GeoJSON PTV polyline parsing coverage"
      pattern: "parsePtvRoutePayload"
---

<objective>
Finish the active CaaS geospatial and California choropleth work by repairing only the typecheck and lint regressions introduced by this dirty-worktree WIP, then validate its offline behavior independently from live Convex availability.

Purpose: Make the WIP internally consistent and reviewable without absorbing unrelated baseline failures or altering the intended CaaS/choropleth behavior.
Output: Scoped TypeScript and React-hook repairs, contract-complete test fixtures, and explicit local-versus-live verification evidence.
</objective>

<execution_context>
@/Users/chussey/.codex/gsd-core/workflows/execute-plan.md
@/Users/chussey/.codex/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@apps/web/package.json
@apps/web/convex/geo/ingest.ts
@apps/web/convex/geo/ingestZcta.ts
@apps/web/convex/workbench/ai.ts
@apps/web/src/components/workbench/map-workbench/types.ts
@apps/web/src/components/workbench/map-workbench/fleetvolt-map-canvas.tsx
@apps/web/src/components/workbench/map-workbench/layers/caas-choropleth-layer.tsx
@apps/web/src/components/workbench/map-workbench/layers/generator-spokes-layer.tsx
@apps/web/src/lib/maps/ptv-routes.ts
@apps/web/src/lib/maps/ptv-routes.test.ts
@apps/web/src/stores/map-workbench-store.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Repair WIP result and layer contracts without changing behavior</name>
  <files>apps/web/convex/geo/ingestZcta.ts, apps/web/convex/workbench/ai.ts, apps/web/src/lib/maps/ptv-routes.ts, apps/web/src/stores/map-workbench-store.test.ts</files>
  <action>
In `ingestZcta.ts`, follow the established explicit async return annotation pattern in `convex/geo/ingest.ts` to terminate Convex generated-API circular inference: type the `purgeNonCaliforniaZcta` and `ingestZcta` action handler results, and explicitly type the `countyAttach` mutation result. Preserve the existing validators, batching, upsert/purge behavior, and returned field names. In `workbench/ai.ts`, add `"ports"` to both the local `WorkbenchLayerId` union and `LAYER_IDS` allowlist so the new deterministic CaaS `set_layers` action matches the frontend contract; do not broaden any other layer or action types. In `ptv-routes.ts`, retain the string value in a string-typed local (or equivalently re-narrow it) before JSON parsing and encoded-polyline fallback so the fallback decoder never receives `unknown`; preserve GeoJSON and encoded-polyline behavior. In the two new CaaS AI-result fixtures in `map-workbench-store.test.ts`, add the required empty `mapActions` collection rather than weakening `WorkbenchAiResult`.

Do not edit the unrelated baseline failures in `convex/catalog/enrich.ts`, auth/setup/pulse/scenario files, `route-layer.tsx`, or any other file not listed in this plan.
  </action>
  <verify>
    <automated>cd apps/web &amp;&amp; (pnpm typecheck &gt; /tmp/fleetvolt-caas-typecheck-task1.log 2&gt;&amp;1 || true) &amp;&amp; ! rg -n 'convex/geo/ingestZcta\.ts|convex/workbench/ai\.ts|src/lib/maps/ptv-routes\.ts|src/stores/map-workbench-store\.test\.ts' /tmp/fleetvolt-caas-typecheck-task1.log</automated>
  </verify>
  <done>The ZCTA actions and local mutation result have explicit non-recursive result types, the CaaS ports layer is valid in the backend action contract, PTV string fallback is narrowed safely, and both new AI fixtures satisfy `WorkbenchAiResult`; no scoped typecheck output remains for these four files.</done>
</task>

<task type="auto">
  <name>Task 2: Stabilize CaaS map identities and run scoped local gates</name>
  <files>apps/web/src/components/workbench/map-workbench/fleetvolt-map-canvas.tsx, apps/web/src/components/workbench/map-workbench/layers/caas-choropleth-layer.tsx, apps/web/src/components/workbench/map-workbench/layers/generator-spokes-layer.tsx</files>
  <action>
In `fleetvolt-map-canvas.tsx`, alias the `@vis.gl/react-google-maps` component import to a non-global name such as `GoogleMap` and update its JSX use so `new Map&lt;string, WorkbenchMapAsset&gt;()` resolves to the built-in collection. Remove the now-unused `US_BOUNDS`; keep the California/West Coast framing unchanged. In `caas-choropleth-layer.tsx`, memoize the cast `data?.regions ?? []` value from `data?.regions` before using it as the `shapeInputs` dependency. In `generator-spokes-layer.tsx`, import `useMemo` and memoize the cast `data?.spokes ?? []` value from `data?.spokes` before the map-overlay effect. Preserve polygon opacity/tiering, selection payloads, marker rendering, polyline animation, and cleanup semantics.

After the edits, run targeted ESLint with zero warnings allowed across all seven repaired files, then run only the three offline suites. Do not use the aggregate `pnpm test` result as the local acceptance gate because that glob includes live `ConvexHttpClient` suites whose deployment fetch can be unavailable.
  </action>
  <verify>
    <automated>cd apps/web &amp;&amp; pnpm exec eslint --max-warnings=0 convex/geo/ingestZcta.ts convex/workbench/ai.ts src/components/workbench/map-workbench/fleetvolt-map-canvas.tsx src/components/workbench/map-workbench/layers/caas-choropleth-layer.tsx src/components/workbench/map-workbench/layers/generator-spokes-layer.tsx src/lib/maps/ptv-routes.ts src/stores/map-workbench-store.test.ts &amp;&amp; pnpm exec node --import tsx --test convex/faf/aadtSample.test.ts src/stores/map-workbench-store.test.ts src/lib/maps/ptv-routes.test.ts &amp;&amp; (pnpm typecheck &gt; /tmp/fleetvolt-caas-typecheck-final.log 2&gt;&amp;1 || true) &amp;&amp; ! rg -n 'convex/geo/ingestZcta\.ts|convex/workbench/ai\.ts|fleetvolt-map-canvas\.tsx|src/lib/maps/ptv-routes\.ts|src/stores/map-workbench-store\.test\.ts' /tmp/fleetvolt-caas-typecheck-final.log</automated>
  </verify>
  <done>All targeted WIP files lint with zero warnings, the direct local command passes the AADT/PTV/store suites (currently 21 tests), and the filtered typecheck log contains no failures from the active WIP repair files even if unrelated baseline errors keep the full command nonzero.</done>
</task>

</tasks>

<source_audit>

| Source | Item | Plan coverage | Status |
|---|---|---|---|
| GOAL | Finish and validate active CaaS geospatial/California choropleth WIP | Tasks 1–2 | COVERED |
| CONTEXT | Repair only WIP-introduced typecheck/lint issues | Tasks 1–2 and filtered gates | COVERED |
| CONTEXT | Preserve unrelated baseline failures | Both task actions explicitly prohibit baseline cleanup | COVERED |
| CONTEXT | Distinguish local unit coverage from live Convex availability | Task 2 and overall verification | COVERED |
| REQ | No ROADMAP requirement IDs assigned to this quick task | N/A | EXCLUDED |
| RESEARCH | No quick-task research artifact supplied | N/A | EXCLUDED |

</source_audit>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|---|---|
| Local Census-prepared rows → Convex action | ZCTA geometry and metadata cross into persisted Convex data through runtime validators. |
| Convex query results → browser map overlays | Choropleth, asset, and generator data become clickable Google Maps objects and links. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|---|---|---|---|---|---|
| T-QUICK-SZR-01 | Tampering | `convex/geo/ingestZcta.ts` | medium | mitigate | Preserve the existing Convex row and return validators while adding types only; do not loosen ingest validation or CA purge bounds. |
| T-QUICK-SZR-02 | Denial of Service | browser polygon/spoke overlays | low | accept | This repair changes dependency identity only and preserves existing query limits, overlay cleanup, and interval cleanup; no new resource exposure is introduced. |

</threat_model>

<verification>

1. Offline/local gate (required): run the exact direct Node test command from Task 2. It must pass without contacting Convex; record its test count in the summary.
2. Scoped static gates (required): targeted ESLint must pass with `--max-warnings=0`, and the captured full typecheck log must contain no entries for the seven repaired WIP files. The full repository typecheck/lint may remain nonzero only for already-known unrelated baseline files; do not repair those here.
3. Live Convex smoke (conditional and separately reported): when deployment credentials and network are available, run from `apps/web`:
   - `pnpm exec convex run geo/choropleth:listCaasChoropleth '{"level":"county"}'`
   - `pnpm exec convex run geo/choropleth:listCaasChoropleth '{"level":"zip"}'`
   - `pnpm exec convex run generators/queries:listWithPortSpokes '{"limit":3}'`
4. If any live command cannot reach/authenticate/deploy against Convex, record `BLOCKED_DEPLOYMENT_OR_NETWORK` with the command and error in the quick summary. This does not invalidate the offline tests or scoped static gates. If a live command reaches Convex and returns an application/schema error, treat that as an in-scope failure and repair only the active WIP responsible.
5. Run `git diff --check` and inspect `git diff --name-only`; the executor must not add unrelated source files to the repair diff.

</verification>

<success_criteria>

- Every WIP-specific TypeScript failure named in the planning context is absent from the captured typecheck output.
- The three WIP-specific lint warnings (unused `US_BOUNDS`, unstable `regions`, unstable `spokes`) are absent, with no new targeted warnings.
- The local AADT sample, map-workbench store, and PTV route suites pass directly.
- Live Convex status is explicit: PASS or `BLOCKED_DEPLOYMENT_OR_NETWORK`, with application/schema failures never mislabeled as network blocks.
- No unrelated baseline typecheck/lint problem is edited or claimed as resolved.

</success_criteria>

<output>
Create `.planning/quick/260709-szr-finish-and-validate-the-active-caas-geos/260709-szr-SUMMARY.md` when done.
</output>
