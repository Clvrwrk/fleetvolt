# Pitfalls Research

**Domain:** Animated Google-Maps freight visualization under a 5-day demo deadline
**Researched:** 2026-07-06
**Confidence:** HIGH

## Critical Pitfalls

1. **"Data needs to be accurate" but the map shows simulated volumes framed as real** — Warning signs: a "Live" toggle with no live data source; polyline thickness/color derived from a hand-tuned constant, not FAF/PeMS; no citation anywhere on screen; a stakeholder asking "where does this number come from?" during the demo and no answer exists. — Prevention: Adopt a **provenance-first data contract** before writing any render code. Every rendered quantity carries a `source` enum (`FAF5`, `Caltrans_PeMS`, `SIMULATED`, `ESTIMATE`) and a `year`. "Live" mode is renamed **"Live Simulation"** in the UI with an always-visible badge. A persistent sources footer cites FAF5 (BTS/FHWA), Caltrans PeMS, and states "flow animation is illustrative, scaled from annual tonnage." Never interpolate simulated GPS and call it tracking. — Address in phase: **Phase 0 (Data Contract & Sourcing)** — must precede any visualization work.

2. **`google.maps.Marker` is deprecated — building the animated truck on the legacy class** — Warning signs: tutorials/AI codegen emit `new google.maps.Marker(...)`; console prints "google.maps.Marker is deprecated as of February 21st, 2024"; marker won't accept a custom DOM/SVG element cleanly. — Prevention: Use **`google.maps.marker.AdvancedMarkerElement`** from the start (requires the `marker` library import + a **Map ID**, which also gates cloud-based styling). The animated Class-8 truck should be a single AdvancedMarkerElement whose `position` is updated per frame, or better an `OverlayView`/`WebGLOverlayView` — not a redrawn legacy Marker. Confirm the Map ID is provisioned day 1 because vector maps + AdvancedMarkers won't render without it. — Address in phase: **Phase 1 (Map Shell & Marker Foundation)**.

3. **Directions API called per-render / per-interaction blows the budget and rate limits mid-demo** — Warning signs: last-mile routes recomputed on every pan/zoom/filter change; `OVER_QUERY_LIMIT` responses; a surprise bill. Directions is a **paid, now-legacy** endpoint ("Directions Advanced" is the current SKU) billed per call, and Dynamic Map loads are **$7.00 per 1,000**. — Prevention: **Precompute and cache** all last-mile routes into Convex at build time (or a one-time seed script); the demo reads static geometry, issues **zero** live Directions calls. Cap the API key with quotas + HTTP referrer restriction. Budget alert set at a low threshold. Never call Directions inside a React render or a map event handler. — Address in phase: **Phase 2 (Routes & Data Seeding)**.

## Performance Pitfalls

4. **Too many Polylines/Markers → the map chokes and animation stutters on the demo laptop** — Warning signs: hundreds of individual `Polyline` objects; per-segment markers; frame rate collapses on pan/zoom; fan spins up. Each Polyline is a heavy managed object. — Prevention: Consolidate highway geometry into a small number of polylines; animate "pulse" via `strokeOpacity`/`icons` dash-offset or a **single WebGLOverlayView/deck.gl layer**, not N objects. Cap total interactive markers at low double digits; cluster or pre-filter hotspots. Test on the actual demo hardware early. — Address in phase: **Phase 3 (Flow Animation)**.

5. **GSAP timeline fighting the Google Maps render loop → jank, rAF leaks, battery drain** — Warning signs: two independent animation loops (GSAP ticker + map redraw) both driving position each frame; `requestAnimationFrame` handles never cancelled on unmount → CPU stays pegged after navigating away; laptop overheats/throttles during a 20-min demo. — Prevention: Pick **one** loop authority. Prefer GSAP as the clock, updating marker `position` inside `gsap.ticker` (or a WebGLOverlayView's `onDraw`), and let the map redraw follow. **Always** `gsap.context()` + cleanup / `cancelAnimationFrame` in `useEffect` teardown. Pause animations when the tab is hidden (`visibilitychange`) and when off-viewport. Prefer transform/opacity over layout-triggering props. Run the demo plugged in, screen-saver/OS-nap disabled. — Address in phase: **Phase 3 (Flow Animation)** + **Phase 6 (Demo Hardening)**.

6. **Redraw storms from React re-rendering the map** — Warning signs: the `<Map>` or overlays remount on every state change (date filter, toggle); markers flicker; state lives above the map and cascades. — Prevention: Memoize the map instance; keep it mounted once. Drive filters by **mutating overlay data**, not remounting the map. Use refs for imperative map objects, not React state. Debounce filter/date changes. — Address in phase: **Phase 1 / Phase 4 (Filters & Overlays)**.

## Data Accuracy & Credibility Pitfalls

7. **Conflating FAF (annual, national, modeled) with PeMS (sensor, real-time, CA-only) as one "volume"** — Warning signs: a single number labeled "freight volume" with no unit/timescale; mixing tons/year with vehicles/hour. — Prevention: Keep sources in separate, labeled layers with explicit units. FAF5 = commodity tonnage/value flows (annual, forecast years); PeMS = detector vehicle counts/speeds (CA highways). Never blend into one scalar. — Address in phase: **Phase 0**.

8. **"Live" mode implies real-time GPS the product does not have** — Warning signs: pulsing trucks moving in "real time," a clock ticking, phrasing like "current traffic." — Prevention: Label it **"Simulation"**; add a tooltip explaining it's an illustrative model seeded from historical data. This is a credibility landmine with a stakeholder who demanded accuracy — a single overclaim in the demo can sink trust. — Address in phase: **Phase 0 / Phase 4**.

9. **TAM/SAM/SOM overlays presented as measured, not estimated** — Warning signs: precise dollar figures with no methodology. — Prevention: Tag as "Estimate — methodology available"; keep a one-line basis (source + assumption) reachable from the overlay. — Address in phase: **Phase 0 / Phase 5 (Business Overlays)**.

## Integration Pitfalls (Convex / WorkOS / Vercel / review gates)

10. **Convex provider on the wrong side of the Next 15 App Router boundary** — Warning signs: "You're trying to use a Convex hook in a Server Component"; `useQuery` throws; the whole tree is a server component. — Prevention: `ConvexProvider`/`ConvexClientProvider` must be a **`"use client"`** component wrapping children in `app/layout.tsx` (or a `/pulse` layout). All hook consumers (`useQuery`/`useMutation`) are client components. Use `NEXT_PUBLIC_CONVEX_URL`. For server-side reads, use `fetchQuery`/`preloadQuery` from `convex/nextjs`, not the React hooks. — Address in phase: **Phase 1 (App/Convex Wiring)**.

11. **Convex document/array size + read limits when storing highway geometry** — Warning signs: dense polyline coordinate arrays and route geometry pushing a single document toward the ~1 MB document / 8 MiB function-read ceiling; slow queries returning huge arrays each reactive update. — Prevention: Store geometry chunked/simplified (Douglas-Peucker), split per-corridor documents, index by region/corridor, and paginate. Don't stream the entire dataset through one reactive `useQuery`. Precompute simplified LODs for zoom levels. — Address in phase: **Phase 2 (Data Seeding)**.

12. **WorkOS auth boundary blocks the demo URL or leaks the /pulse route** — Warning signs: middleware redirects the demo viewer to login; or `/pulse` is unintentionally public; callback/redirect URI mismatch on the Vercel preview domain. — Prevention: Decide access explicitly — either gate `/pulse` behind WorkOS and pre-provision the demo account, **or** carve `/pulse` out of the auth middleware matcher for the demo. Register the **exact Vercel preview + prod redirect URIs** in WorkOS. Test the login flow on the deployed URL, not just localhost. — Address in phase: **Phase 1 / Phase 6**.

13. **Vercel deploy gotchas: env vars, Convex prod deploy, Maps key referrer** — Warning signs: works locally, blank map on Vercel (key restricted to localhost / missing `NEXT_PUBLIC_` var); Convex still pointing at dev deployment; build fails on server/client import mixing. — Prevention: Set `NEXT_PUBLIC_CONVEX_URL`, Google Maps key, WorkOS keys in Vercel env for Preview+Prod. Run `convex deploy` and wire the prod URL. Add the Vercel domains to the Maps key HTTP-referrer allowlist. Do a full deploy dry-run **by day 3**, not day 5. — Address in phase: **Phase 6 (Demo Hardening)**.

14. **Coderabbit + Greptile review gates stall an autonomous 5-day build** — Warning signs: giant single PR that reviewers flag exhaustively; agent loops fixing style nits; gates block merge the night before. — Prevention: Ship **small, phase-scoped PRs** so each review is fast and mergeable. Front-load a `.coderabbit.yaml` / config to focus severity and silence noise on generated/vendor code. Treat review comments as triage (block vs defer), not a mandate to fix everything before the demo. Reserve a merge-freeze buffer on day 5. — Address in phase: **Every phase (process)**.

## Brand-Fidelity Pitfalls

15. **Default Google Maps styling bleeds through the skeuomorphic-CAD "blueprint" aesthetic** — Warning signs: Google's POI pins, road colors, and default palette clash with the JetBrains-Mono blueprint grid; the map looks like stock Google, not FleetVolt. — Prevention: Use **cloud-based map styling** via the **Map ID** (required anyway for AdvancedMarkers) to strip POIs/labels and apply a monochrome blueprint palette; overlay a custom grid/graticule; style InfoWindows/"dimension callouts" as custom `OverlayView` DOM (Google InfoWindow is nearly unstyleable and will break brand fidelity). Google's logo + ToS attribution **cannot** be removed — reserve space for it in the layout so it doesn't look broken. — Address in phase: **Phase 1 (Map Shell)** + **Phase 5 (Callout UI)**.

16. **Custom "dimension callout" popups built on native InfoWindow** — Warning signs: rounded white bubble with a tail you can't restyle; fonts won't match. — Prevention: Build callouts as custom `AdvancedMarkerElement` content or `OverlayView` React portals so they inherit the CAD design system. — Address in phase: **Phase 5**.

## Prevention Summary

| Pitfall | Prevention | Phase |
|---|---|---|
| Simulated data shown as real | Provenance data contract + "Live Simulation" label + sources footer | 0 |
| Deprecated `google.maps.Marker` | Use AdvancedMarkerElement + Map ID from day 1 | 1 |
| Directions cost/rate-limit blowup | Precompute + cache routes in Convex; zero live calls | 2 |
| Polyline/marker overload | Consolidate geometry; WebGL/deck.gl; cap markers | 3 |
| GSAP vs map loop / rAF leaks | Single animation authority; cleanup; pause on hidden | 3, 6 |
| Map redraw storms | Keep map mounted; mutate data not remount; debounce | 1, 4 |
| FAF vs PeMS conflation | Separate labeled layers, explicit units | 0 |
| "Live" overclaim | Rename Simulation + tooltip | 0, 4 |
| TAM/SAM/SOM as fact | Estimate tags + methodology basis | 0, 5 |
| Convex provider boundary | `"use client"` provider; server uses fetch/preload | 1 |
| Convex size/read limits | Chunk + simplify geometry; paginate | 2 |
| WorkOS blocks/leaks demo | Explicit gating + exact Vercel redirect URIs | 1, 6 |
| Vercel env/key/deploy | Set all env; referrer allowlist; day-3 dry run | 6 |
| Review gates stall build | Small phase PRs; tuned config; triage not fix-all | all |
| Google styling bleeds through | Cloud map styling via Map ID; custom overlays | 1, 5 |
| Native InfoWindow off-brand | Custom OverlayView/AdvancedMarker DOM callouts | 5 |

## Sources

- Google Maps Platform — Marker (deprecated) reference, confirming `google.maps.Marker` deprecated Feb 21 2024 and AdvancedMarkerElement replacement (developers.google.com/maps/documentation/javascript/reference/marker) — **HIGH**
- Google Maps Platform — Advanced Markers migration guide (requires Map ID + `marker` library) — **HIGH**
- Google Maps Platform — Billing & Pricing: Dynamic Maps $7.00/1k loads; Directions now legacy vs "Directions Advanced" SKU; per-1000-event tiered pricing (developers.google.com/maps/billing-and-pricing/pricing) — **HIGH**
- Convex — Next.js quickstart / App Router client integration: `"use client"` ConvexProvider pattern, `NEXT_PUBLIC_CONVEX_URL`, server-side `fetchQuery`/`preloadQuery` (docs.convex.dev/client/react/nextjs) — **HIGH**
- Convex — Limits (document ~1 MB, function read ceilings, pagination guidance) — **MEDIUM** (page fetch blocked; general limits from prior Convex docs knowledge)
- FAF5 (BTS/FHWA Freight Analysis Framework) — annual modeled commodity flows; Caltrans PeMS — real-time CA detector data (domain knowledge of dataset semantics) — **HIGH**
- GSAP + requestAnimationFrame cleanup / render-loop coordination and WebGLOverlayView performance patterns (domain knowledge; web_search unavailable this session) — **MEDIUM**

---
*Pitfalls research for: Freight Pulse visualization*
*Researched: 2026-07-06*
