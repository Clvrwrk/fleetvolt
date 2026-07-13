---
phase: 17-role-based-map-workbench-driver-day-plan-fleet-contract-plan-caas-gap-map
reviewed: 2026-07-11
reviewer: cw-codex
status: needs-remediation
score: 14/24
surfaces:
  - https://fleetvolt.network/caas
  - https://staging.fleetvolt.network/caas
  - https://fleetvolt.network/fleet/contract-plan
  - https://staging.fleetvolt.network/driver/day-plan
---

# Phase 17 UI Review — Role-Based Map Workbench

## Outcome

The Phase 17 workbench is real and visually evaluable on desktop. Driver, Fleet, and CaaS share a coherent map-first shell, the left rail carries role-specific inputs, and the map remains the dominant surface. It is not yet ready for visual acceptance or release promotion: the CaaS map renders database bounding boxes as geographic shapes, mobile is a clipped 1024px desktop layout, role navigation is absent when account-role resolution lags, and Phase 17 UAT remains 3/9 complete.

## Score

| Pillar | Score | Assessment |
|---|---:|---|
| Copywriting | 3/4 | Role language and modeled/advisory caveats are strong; some rail copy is dense and the dashboard/workbench headings are generic. |
| Visuals | 2/4 | Desktop map-first composition is credible; rectangular pseudo-geographies materially misrepresent the data. |
| Color | 3/4 | Graphite/blue system is consistent and map overlays are legible; choropleth opacity and overlapping rectangle fills create misleading emphasis. |
| Typography | 3/4 | Inter/JetBrains Mono hierarchy is coherent; small uppercase labels and dense helper text become difficult in the narrow rail. |
| Spacing | 2/4 | Desktop rail/canvas proportions are usable; controls are vertically crowded and the mobile viewport is severely clipped. |
| Experience Design | 1/4 | Desktop role modes are understandable, but mobile fails, role nav may disappear, CaaS drilldown geometry is untrustworthy, and critical flows remain unaccepted. |
| **Overall** | **14/24** | **Desktop alpha evaluation is appropriate; release acceptance is not.** |

## Evidence and Findings

### Critical — mobile contract is not implemented in the live experience

At a 390×844 viewport, the left desktop rail and map remain laid out against a 1024px canvas. Most controls and content are off-screen, and the expected mobile bottom sheet is not the usable primary interaction. The root cause is the global `min-w-[1024px]` on `body` in `apps/web/src/app/layout.tsx:42`, which defeats the responsive workbench classes and contradicts UAT Test 8 and the Phase 17 summary's claimed mobile pass.

Acceptance: remove the global desktop minimum or scope it only to legacy surfaces; at 390px show the map plus a usable bottom sheet, with desktop left/right panels hidden. Re-run the actual Playwright mobile test against the production-equivalent shell.

### Critical — California and district boxes are rendered as if they were boundaries

Both production and staging visibly show overlapping rectangular fills around California. `CaasChoroplethLayer` accepts either a polygon ring or a bounding box and constructs `google.maps.Rectangle` when a ring is unavailable (`caas-choropleth-layer.tsx:107-160`). County rows expose only `bbox` in `convex/geo/choropleth.ts:108-128`, and air districts are explicitly unions of county bounding boxes. These rectangles are valid query/framing aids, but not valid geographic shapes.

Acceptance: never render a bbox as a choropleth region. Use verified polygon or multipolygon geometry for state, air-district, county, and ZIP layers. Until a level has verified geometry, show markers/labels or an honest unavailable state. Bounding boxes may remain internal for queries and camera fitting.

### High — implementation progress is ahead of acceptance evidence

The shared Driver, Fleet, and CaaS workbench shell exists and is visibly coherent. However, `17-UAT.md` records only Tests 1–3 as passed; Fleet contract results, CaaS gap flow, map-first AI, route aliases, desktop/mobile behavior, and screenshot review remain pending. The live visual check confirms desktop initial states but does not close the calculate/result flows.

Acceptance: finish UAT 4–9 using production-equivalent data. Do not mark the phase accepted from component existence or DOM-only assertions.

### High — repository quality gates are red

On 2026-07-11, full TypeScript and lint commands failed, including active workbench and auth files. The test suite reported 210 passing and 27 failing tests; several failures require a reachable Convex deployment, but there are also deterministic failures in provenance source counts, Google/PTV fallback expectations, and scenario-store behavior.

Acceptance: distinguish network-dependent integration tests from deterministic unit tests, make the offline deterministic suite green, and clear active workbench/auth TypeScript errors before promotion.

### High — auth state is inferred from readable cookie names

The client provider and middleware infer authentication from cookie-name presence. This is brittle and can leave navigation at “Role tools load after your account role is available,” which was visible on Driver and Fleet workbenches. The callback also has a TypeScript-invalid `onError` return and hard-codes `/driver` as `returnPathname` while maintaining a separate role map.

Acceptance: use the supported WorkOS AuthKit session/middleware integration as the source of truth, return a valid error response, and verify role-specific callback routing end to end in both environments.

## What Is Working

- Driver and Fleet are clearly the same workbench filtered by role, consistent with the genesis vision.
- Desktop canvas dominance, graphite rail, blue primary actions, and map status card form a strong visual foundation.
- Driver preserves a road-snapped route; Fleet exposes contract-specific schedule, volume, dwell, and shift inputs.
- CaaS exposes ports, freight volume, chargers, parking, traffic, census, gaps, carriers, heat zones, and route layers in one tool rail.
- Copy generally labels modeled or advisory data honestly.

## Recommended Remediation Order

1. Stop visualizing bounding boxes; ingest/use verified boundary geometry.
2. Remove the global 1024px minimum and make the promised mobile sheet pass at 390px.
3. Clear active workbench/auth TypeScript and lint failures; split offline and live integration gates.
4. Complete UAT 4–9, including Fleet calculation, CaaS gap flow, AI action, aliases, and screenshots.
5. Stabilize WorkOS/Convex auth and role navigation across production and staging.

## Onboarding-Note Coverage

Repo sources reviewed include the canonical `doc/visions/genesis-fleetvolt.md`, role/workbench interview, Phase 16 and 17 contexts, tool-rail decision, Monday demo script, Shafter Triangle feasibility audit, current handoff, testing guide, and UAT. The detailed 12-month vision-interview choices from 2026-07-11 are available in the working conversation/Linear planning record but are not consolidated into one durable FleetVolt repo document. That consolidation remains a documentation gap.
