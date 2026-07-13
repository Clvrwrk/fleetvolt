# Phase 23: Statewide Route Intelligence, Prime Charging Sites, and Executive Briefs — Specification

**Created:** 2026-07-12
**Ambiguity score:** 0.08 (gate: ≤ 0.20)
**Requirements:** 7 locked

## Goal

FleetVolt changes from a six-route demonstration catalog into a 69-route evidence-honest California freight network where each traffic generator has one cached port route, one explainable modeled charging-prime candidate, and one accessible route-native executive brief with downloadable evidence.

## Background

Phase 18 provides directional PTV geometry with a 90-day cache. Phase 19 provides seven-day route enrichment. Phase 20 promotes curated routes into the shared catalog. The live audit found 69 traffic generators, 37 explicit port assignments, 32 nearest-port assignments, and only six verified designated routes. Route-specific Caltrans truck AADT exists, but freight volume is currently regional context and was incorrectly reused from FAF zone 061. The focused route uses a separate blue style, the current GAP logic samples three chord points rather than the PTV road, and the existing executive briefing is synthetic rather than route-native.

## Requirements

1. **STATE-ROUTE-01 — Complete designated route coverage**: Maintain exactly one directional designated port-to-generator route for each of 69 traffic generators.
   - Current: Six designated pairs have verified promoted PTV geometry; 63 are missing.
   - Target: A resumable admin runner processes the 63 gaps sequentially, invokes the existing one-generator action, applies bounded retry/backoff, records a receipt per attempt, and reuses valid PTV geometry for 90 days.
   - Acceptance: Coverage returns 69 unique generator/port pairs with provider road geometry of at least eight points, valid pair identity, geometry freshness status, enrichment status, and no duplicate promoted pair.

2. **STATE-ROUTE-02 — Evidence-honest traffic and freight encoding**: Expose typed route traffic and freight metrics with separate visual channels.
   - Current: AADT is route-specific, freight is LA-area FAF context reused across ports, and UI tiering parses formatted strings.
   - Target: Route color derives only from numeric Caltrans truck AADT. Width/pulse derives only from explicitly labeled port and port-correct FAF context. Ports without defensible freight evidence return unavailable.
   - Acceptance: Pure policy tests prove exact AADT tier boundaries, port-to-FAF mapping, unavailable handling, and identical styling between overview and focused route renderers.

3. **PRIME-SITE-01 — One explainable modeled charging-prime candidate**: Calculate exactly one modeled candidate for every promoted route.
   - Current: GAP analysis receives origin/chord-midpoint/destination, may return up to three candidates, and does not model a route-energy window.
   - Target: Candidate selection walks the actual PTV polyline for the standard 438-kWh Class 8 tractor, targets an inclusive 20–40% arrival SoC window, uses an inclusive 10-mile maximum detour, ranks freight-compatible parking/rest/truck-stop/fuel dwell sites, and returns score components, provenance, confidence, and field-validation caveats.
   - Acceptance: Deterministic tests cover exact 20%, 40%, and 10-mile boundaries, no qualifying existing site, equal-score ties, missing evidence, and stable reruns. A route with no qualifying existing site receives one on-route modeled candidate explicitly marked as requiring parcel/access validation.

4. **ROUTE-MAP-01 — Statewide route and prime-site map**: Render the promoted network and prime candidates on the CaaS home freight map.
   - Current: Overview arcs and focused routes use different style contracts; no prime-site FleetVolt marker exists.
   - Target: All promoted routes use the shared typed traffic/freight policy. Each prime candidate uses a pulsing FleetVolt logo. Keyboard or pointer activation opens an explanation card and preserves selected-route focus until the user chooses Show All Layers.
   - Acceptance: Desktop visual/interaction verification proves 69 promoted route records can be represented, route focus persists after marker activation, marker cards expose the scoring explanation, and honest loading/empty/error states replace fabricated geometry.

5. **ROUTE-BRIEF-01 — Route-native live evidence contract**: Build one deterministic brief contract keyed by catalog route.
   - Current: The hotspot report is location-centric, exports require simulation inputsHash, and the executive briefing contains hard-coded demonstration values.
   - Target: The brief joins catalog geometry/freshness, typed AADT, labeled port/FAF context, charger/GAP evidence, the prime candidate, district/county/ZIP context, verified nearby carriers, standard-profile energy/emissions, sources, assumptions, and unavailable reasons.
   - Acceptance: A catalog route produces a brief without a simulation inputsHash; every numeric value has units, source/method, and as-of data, and missing data is rendered as unavailable rather than zero.

6. **ROUTE-BRIEF-02 — Accessible HTML/PDF/CSV/JSON outputs**: Publish the same grounded route brief in four formats.
   - Current: No catalog-route export exists and the current report UI is synthetic.
   - Target: Provide a live semantic HTML brief, downloadable PDF, CSV evidence appendix, and JSON evidence appendix using the FleetVolt enterprise design system and a road-level route rendering.
   - Acceptance: HTML and PDF contain the same headline values; CSV/JSON reconcile to the evidence contract; HTML uses a 16px minimum readable-text floor; PDF body text is at least 11pt; tables repeat headers and visual evidence has captions and tabular alternatives.

7. **ROUTE-CARRIER-01 — Verified carrier targets only**: Rank only real, geocoded carriers qualifying under the documented route-proximity policy.
   - Current: Earlier briefing concepts allowed mocked top-ten carriers.
   - Target: Return up to ten verified carriers, with fewer or zero allowed when evidence is insufficient.
   - Acceptance: Tests prove zero, fewer-than-ten, exactly-ten, and over-ten inputs; equal scores use stable distance/name/id tie-breaking; no mock or illustrative company can enter production output.

## Boundaries

**In scope:**
- 69 designated California port-to-generator catalog routes.
- Sequential, resumable provider execution with per-route receipts.
- Typed AADT and port-correct freight-context fields plus a shared styling policy.
- One modeled prime charging candidate and explanation per promoted route.
- CaaS network/prime-site map behavior on the desktop release.
- Route-native HTML, PDF, CSV, and JSON brief outputs.
- Standard 438-kWh Class 8 modeled energy/emissions with explicit assumptions.
- Verified/geocoded carrier targets only.

**Out of scope:**
- The 414-route all-port-to-all-generator matrix — the product decision is one designated port per generator.
- Tablet/mobile responsive implementation — parked in FleetVolt.Network Mobile/Tablet Design.
- Fleet Manager and Driver lane completion — CaaS is the release priority.
- Parcel acquisition, utility capacity, permitting, or field validation — the candidate is modeled and must retain caveats.
- New proprietary generator-throughput claims — no measured generator volume source exists.
- Mock carriers or synthetic production KPIs — production truth requirements prohibit them.
- Overlapping-road route chooser — Phase 21 remains a separate interaction.

## Constraints

- Convex remains the system of record; no Supabase dual write.
- PTV geometry is directional and cached for 90 days; enrichment has its own seven-day freshness.
- Provider generation is sequential, resumable, idempotent, and never an opaque concurrent bulk action.
- At most one refresh lease may call PTV for a directional request at a time.
- Route evidence must distinguish measured, regional-context, and modeled values.
- Proximity filtering uses an inclusive 10-mile maximum detour.
- HTML readable text has a 16px absolute floor and supports 200% zoom.
- All changes remain on a dedicated PR branch; no direct merge or push to main.

## Acceptance Criteria

- [ ] Coverage reports 69 unique designated generator/port pairs and zero missing or duplicate promoted pairs.
- [ ] Re-running or resuming the generator causes zero unnecessary PTV calls for fresh geometry and does not duplicate receipts or catalog rows.
- [ ] An interrupted run resumes at the first unverified pair and never starts more than one provider pull concurrently.
- [ ] Provider failure records an error receipt and leaves the pair unpromoted; no chord or straight line is stored.
- [ ] Route color uses measured AADT only; width/pulse uses clearly labeled port/FAF context only.
- [ ] Ports without defensible freight context show unavailable rather than FAF zone 061 or zero.
- [ ] Prime-site scoring uses the actual PTV polyline, inclusive 20–40% SoC window, and inclusive ≤10-mile detour.
- [ ] Every promoted route has exactly one modeled candidate; fallback candidates are explicitly labeled for parcel/access validation.
- [ ] Prime-site marker activation preserves selected-route focus and exposes source, score, confidence, and caveats.
- [ ] A catalog route produces matching HTML/PDF headline values and reconcilable CSV/JSON evidence.
- [ ] Modeled energy/emissions are labeled as planning estimates using the standard 438-kWh profile and named factors.
- [ ] Carrier lists contain zero to ten verified/geocoded real companies and are never padded.
- [ ] No user-facing brief or marker card exposes raw Convex IDs, raw storage keys, or unformatted raw OSM tag objects.
- [ ] No production surface presents modeled freight, emissions, or prime-site scores as measured facts.
- [ ] Automated unit, type, lint, contract, and export reconciliation tests pass before visual review.

## Edge Coverage

**Coverage:** 24/24 applicable edges resolved · 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| adjacency | R1 | ✅ covered | Pair identity uses generator id plus designated port; coincident coordinates do not merge distinct generators. |
| empty | R1 | ✅ covered | Coverage can report 0/69 but promotion remains empty; no fabricated rows. |
| ordering | R1 | ✅ covered | Runner order is stable by generator id after explicit assignments resolve. |
| idempotency | R1 | ✅ covered | Fresh reruns make zero PTV calls and upsert rather than duplicate. |
| concurrency | R1 | ✅ covered | One sequential worker and one request refresh lease; interruption resumes. |
| adjacency | R2 | ✅ covered | AADT tier equality belongs to the higher documented threshold tier. |
| empty | R2 | ✅ covered | Missing metrics return unavailable and no derived style claim. |
| ordering | R2 | ✅ covered | Port/freight records and visual styles use deterministic mapping/order. |
| boundary | R3 | ✅ covered | 20%, 40%, and 10 miles are inclusive; just-outside values fail qualification. |
| adjacency | R3 | ✅ covered | Coincident sites remain distinct evidence records; ranking selects one. |
| empty | R3 | ✅ covered | One explicitly caveated on-route modeled fallback is returned. |
| ordering | R3 | ✅ covered | Equal scores break by evidence completeness, detour, then stable id. |
| precision | R3 | ✅ covered | Compare unrounded values; round only display values. |
| adjacency | R4 | ✅ covered | Overlapping markers may cluster visually but retain distinct accessible targets. |
| empty | R4 | ✅ covered | Honest empty/loading/error state; no synthetic route or marker. |
| ordering | R4 | ✅ covered | Layer and route draw order is deterministic; focus renders above overview. |
| unclassified | R5 | ✅ covered | Manual review resolved missing fields as explicit unavailable values. |
| adjacency | R6 | ✅ covered | Pagination/page breaks repeat headings rather than merge table rows. |
| empty | R6 | ✅ covered | Valid four-format brief renders even with zero carriers or unavailable evidence. |
| encoding | R6 | ✅ covered | HTML/CSV/JSON are UTF-8; PDF embeds usable text and font fallbacks. |
| ordering | R6 | ✅ covered | Sections and evidence rows follow one deterministic schema order. |
| adjacency | R7 | ✅ covered | Boundary-distance carriers qualify at the inclusive proximity limit. |
| empty | R7 | ✅ covered | Zero qualifying carriers produces an explicit no-verified-targets state. |
| ordering | R7 | ✅ covered | Rank, distance, normalized name, then stable id break ties. |

## Prohibitions (must-NOT)

**Coverage:** 5/5 applicable prohibitions resolved · 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| MUST NOT present modeled freight, emissions, or site scores as measured facts. | R2, R3, R5 | resolved · judgment | Content/data-contract review verifies labels and provenance. |
| MUST NOT fabricate road geometry, zero-fill unavailable evidence, or substitute LA FAF context for another port. | R1, R2 | resolved · test | Policy and contract tests exercise provider failure and unavailable mappings. |
| MUST NOT fan out concurrent PTV pulls or bypass the 90-day geometry cache. | R1 | resolved · test | Runner/cache tests assert maximum provider concurrency of one and fresh-hit reuse. |
| MUST NOT pad carrier targets with mock, illustrative, or ungeocoded companies. | R7 | resolved · test | Carrier ranking tests exercise zero through over-ten inputs. |
| MUST NOT expose raw Convex ids, storage keys, or raw OSM tag objects in user-facing outputs. | R4, R5, R6 | resolved · judgment | Visual/output schema review. |

Canon security controls such as injection, authorization, and secret handling remain owned by the project security gate and are not duplicated here.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.96 | 0.75 | ✓ | Exact 69-route outcome and four formats. |
| Boundary Clarity | 0.94 | 0.70 | ✓ | 69 designated routes, not 414; mobile/Fleet/Driver excluded. |
| Constraint Clarity | 0.89 | 0.65 | ✓ | Cache, provider, evidence, profile, detour, accessibility locked. |
| Acceptance Criteria | 0.90 | 0.70 | ✓ | 15 pass/fail criteria plus 24 edge resolutions. |
| **Ambiguity** | **0.08** | ≤0.20 | ✓ | Gate passed. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | Designated coverage or all-to-all matrix? | 69 designated routes. |
| 1 | Researcher | How should traffic and freight drive appearance? | AADT color; labeled port/FAF width or pulse. |
| 1 | Simplifier | What truck/site model is the MVP? | Standard 438-kWh tractor, 20–40% SoC, ≤10-mile detour, one candidate. |
| 2 | Boundary Keeper | Which report formats ship? | Live HTML, PDF, CSV, and JSON. |
| 2 | Boundary Keeper | How are emissions represented? | Clearly labeled standard-profile modeled estimates. |
| 2 | Failure Analyst | Can targets be mocked or padded? | Verified/geocoded only; fewer than ten is valid. |
| 2 | Failure Analyst | How may 63 PTV gaps be generated? | Sequential, resumable, throttled, receipt-backed execution. |

---

*Phase: 23-statewide-route-intelligence-prime-charging-sites-and-execut*
*Spec created: 2026-07-12*
*Next step: gsd plan-phase 23 — implementation planning*
