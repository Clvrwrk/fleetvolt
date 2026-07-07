# Feature Research

**Domain:** Freight-flow / market-opportunity visualization dashboard
**Researched:** 2026-07-06
**Confidence:** MEDIUM

## Feature Landscape

The `/pulse` surface is a hybrid of two well-established dashboard genres: (1) animated freight-flow / logistics-network maps (nodes sized by throughput, flows encoded by width + color + moving particles, time-scrubbing playback) and (2) TAM/SAM/SOM market-opportunity dashboards (nested concentric encoding, toggleable overlays, live-updating number callouts). The hard constraints are the 5-day (Friday-demo) build window and the "sell it tomorrow in 30 seconds" success bar, so the classification below aggressively separates what actually lands the demo from what quietly eats the week.

### Table Stakes (users expect these)

- **Interactive Google Map, West-Coast-framed on load** — Any freight-map viewer expects pan/zoom and a sensible default viewport (CA ports in frame). Without it the surface reads as a static image. — complexity Low — dependencies: Google Maps JS API key already in existing app; new `/pulse` route in the app shell/router.
- **Named port anchors (POLA, POLB, Port Hueneme, Oakland, SF, San Diego)** — Users orient themselves off known hubs; markers/labels are the "you are here" of the map. — complexity Low — dependencies: hardcoded lat/lng constants; existing marker/icon assets.
- **Volume-flow lines on real highway geometry (I-5, I-710, I-110, US-101, etc.)** — Flows drawn as straight arcs read as fake; freight audiences expect corridors to follow real roads. — complexity Med — dependencies: Google Directions/Routes API or pre-baked polyline geometry per corridor; a curated OD (origin-destination) corridor list.
- **R/Y/G volume encoding (color = congestion/utilization state)** — Traffic-light semantics are the universal shorthand; a BD viewer decodes green/yellow/red instantly with zero legend-reading. — complexity Low — dependencies: flow dataset carrying a state/volume field per corridor.
- **Flow legend + concise map key** — Viewers must know what color/width/pulse means or the "wow" collapses into confusion. — complexity Low — dependencies: none beyond the encoding decisions.
- **Click/hover tooltips on flows and hotspots** — Detail-on-demand is the baseline interaction contract of every logistics dashboard. — complexity Med — dependencies: hotspot dataset; popup/InfoWindow component.
- **TAM/SAM/SOM readout with real dollar figures** — For a market-size demo, the numbers ARE the product; nested concentric or stacked callouts are the expected form. — complexity Low — dependencies: sourced/estimated market numbers (BD-supplied or researched).
- **Date/time filter (5yr / 1yr historical selectors)** — Time framing is expected on any freight-trend view; even a coarse selector signals the data has depth. — complexity Med — dependencies: dataset keyed by period (or scaled multipliers per period if data is synthetic).
- **Responsive layout for a laptop/large-tablet demo** — BD demos on a laptop or in a browser on a conference display; broken layout kills credibility. — complexity Low — dependencies: existing app's responsive/CSS system.
- **Data-source transparency footer** — Market claims need attribution (BTS FAF, port authority stats, etc.) or the numbers aren't trustworthy in a sales context. — complexity Low — dependencies: list of source citations.

### Differentiators (competitive edge)

- **Pulsing / "marching-ants" animated flow lines** — Motion is the single biggest "wow" lever and the literal namesake ("Pulse"); animated gradient/particle flow along real geometry is what makes BD say "sell it tomorrow." — complexity Med — dependencies: animation loop (requestAnimationFrame) over polylines; symbol-offset animation on Google Maps polylines or a Canvas/deck.gl overlay.
- **Leading Class-8 truck SVG marker riding the flow** — A recognizable truck gliding the corridor personifies the abstract flow and ties directly to FleetVolt's product (Class-8 EV). High memorability, low data cost. — complexity Med — dependencies: truck SVG asset; path-interpolation along polyline; reuse of existing sim's vehicle iconography if present.
- **Solar-charger site-recommendation hotspots** — This is the actual sales thesis ("here's where to deploy mobile chargers"); turning market data into a deployment map is the differentiator vs a generic freight viewer. — complexity Med — dependencies: a scored candidate-site list (queue proximity + trucking-HQ proximity + congestion); hotspot rendering + popup.
- **Technical "dimension callout" popup styling** — Engineering-drawing-style callouts (leader lines, dimension ticks) make the popups feel like a spec sheet, reinforcing credibility and visual distinctiveness. — complexity Med — dependencies: custom popup/overlay component with SVG leader-line rendering; design tokens.
- **TAM/SAM/SOM overlay toggles with dimension-style number callouts** — Toggling market rings on/off over the live map (rather than a separate chart) fuses "where" and "how big," which is the demo's core argument. — complexity Med — dependencies: overlay layer + toggle controls; market numbers; shared dimension-callout component.
- **"Live" simulation mode** — A simulated real-time ticker of trucks/flows makes the map feel alive and current, separating it from a static BI export. — complexity Med — dependencies: client-side simulation/animation timer; synthetic live event stream (no backend required for demo).
- **Last-mile street-level route reveal (on zoom or hotspot click)** — Zooming from corridor to street level shows the last-mile story that charger siting depends on; a strong "depth" moment in a demo. — complexity Med — dependencies: Google Directions for local segments; zoom-level-driven layer switching.
- **Hotspot taxonomy (queue/parking, congestion, trucking-HQ proximity, charger recs)** — Multiple, visually distinct hotspot types let the presenter tell several stories from one map. — complexity Med — dependencies: categorized hotspot dataset; per-type icon/color system.

### Anti-Features (explicitly avoid for this milestone)

- **Live external freight-data ingestion / real API feeds (AIS, BTS live, carrier TMS)** — Real pipelines are days of integration and fragile on demo day; use curated/synthetic data. Defer to post-demo if the deal advances.
- **Editable assumption sliders / what-if market modeling** — Powerful but a rabbit hole of state management and validation; BD only needs to *show* numbers Friday, not recompute them live.
- **Nationwide / global coverage** — Scope is CA-first West Coast; adding more geography multiplies geometry/data curation with no demo payoff.
- **User accounts, saved scenarios, sharing/export (PDF/PPT)** — No persistence needed for a live demo; export is a fast-follow, not a table stake for Friday.
- **Full WCAG AA accessibility conformance / screen-reader parity** — Keep *basics* (keyboard focus on controls, sufficient contrast, alt text on legend), but formal audit-grade a11y is out of scope for a 5-day internal demo.
- **Mobile-phone-optimized layout** — Demo runs on a laptop/large display; phone breakpoints are wasted effort this week.
- **Deep drill-down nested overlays (region → country → persona)** — The nested-overlay pattern is compelling but multi-level recursion is scope creep; a single TAM/SAM/SOM level is enough.
- **Backend service / database for /pulse** — Everything can be static JSON bundled with the client for the demo; standing up services burns the timeline.
- **Historical data accuracy guarantees** — Numbers can be representative/illustrative (clearly labeled) rather than audited; precision claims create liability with no demo benefit.

## Feature Categories

These six categories are structured to seed REQUIREMENT categories (REQ-IDs):

1. **Map & Flow Engine** — Google Map surface, West-Coast framing, port anchors, real-highway polyline geometry, R/Y/G + width volume encoding, pulsing/animated flow lines, the leading Class-8 truck SVG marker, legend/key.
2. **Hotspots & Recommendations** — Hotspot taxonomy (queue/parking, congestion, trucking-HQ proximity, solar-charger site recs), scoring/placement of charger recommendations, click interaction model, dimension-callout popup component, last-mile street-level route reveal.
3. **Market Sizing** — TAM/SAM/SOM data, overlay toggles, dimension-style number callouts, nested/stacked visual encoding, fusion of market rings with the map.
4. **Time Controls** — 5yr / 1yr historical selectors, period-keyed data switching, and the "Live" simulation mode (client-side ticker/animation).
5. **Data & Sourcing** — Curated/synthetic dataset structure (corridors, OD volumes, hotspots, market numbers), source-transparency footer, "illustrative data" labeling.
6. **Shell / Chrome** — New `/pulse` route in the app shell, navigation tab, layout container, responsive laptop/tablet layout, control panel (toggles/filters), accessibility basics (keyboard focus, contrast, alt text).

## Complexity & Build-Order Notes

- **Critical path = Map & Flow Engine.** Everything visually anchors to it. Build order: (1) `/pulse` route + map + port anchors (Low, day 1), (2) static corridor polylines with R/Y/G/width encoding (Med, day 1–2), (3) pulse animation + truck marker (Med, day 2–3). The animation is the demo's heartbeat — protect time for it.
- **Data curation is the hidden cost.** Real-highway geometry and a believable OD/hotspot/market dataset are the least glamorous but most schedule-risky items. Pre-bake polylines (fetch Directions once, store as static GeoJSON) rather than calling Directions live per render — cheaper, faster, offline-safe for the demo.
- **Reuse the existing FleetVolt shell.** The Phases 1–4 app already has routing, Google Maps API wiring, and likely a Class-8 vehicle icon and design tokens — inherit these instead of rebuilding. This is the single biggest time saver and the main cross-feature dependency.
- **Dimension-callout popup is a shared component.** Both hotspots and TAM/SAM/SOM callouts use it — build it once (Med) and reuse. Sequence it after the map so it has real anchors to attach to (day 3).
- **Market Sizing overlay is low-data / high-impact** — numbers + toggles are cheap to render and land the sales argument; slot it mid-week (day 3–4) once the map is stable.
- **Time Controls: historical selectors are Low if data is period-keyed multipliers; "Live" mode is Med** (needs an animation timer but no backend). Build historical first, add Live if time remains — Live is the top *cuttable* differentiator if the week slips.
- **Realistically cuttable for Friday, in priority order:** (1) last-mile street-level reveal, (2) "Live" simulation mode, (3) multiple hotspot types beyond charger-recs + congestion, (4) 5yr vs 1yr distinction (ship one period). The non-negotiable demo core: framed map + pulsing R/Y/G flows on real corridors + truck marker + clickable charger-rec hotspots + a TAM/SAM/SOM readout + source footer.
- **Accessibility basics are Low-cost insurance:** keyboard-focusable toggles, ≥4.5:1 contrast on callouts, alt/aria labels on the legend and controls. Do these inline; skip the formal audit.

## Sources

- xAI X Search synthesis on animated freight-flow logistics dashboards — node sizing, R/Y/G status color, width-by-volume, particle/trip animation, time-slider playback, deck.gl TripsLayer patterns, BTS Freight Analysis Framework as a public data source — confidence MEDIUM (aggregated practitioner knowledge, not a single authoritative doc).
- xAI X Search synthesis on TAM/SAM/SOM market-sizing dashboards — nested concentric-circle encoding, overlay toggles, progressive-disclosure/nested-overlay UX, live-updating callouts, data-source footnote convention — confidence MEDIUM.
- Domain reasoning from the FleetVolt product context (Class-8 EV sim, mobile solar-charger siting thesis) applied to feature classification and demo-scope cutting — confidence MEDIUM.
- Google Maps JavaScript API capabilities (animated polyline symbol offset, Directions/Routes for highway geometry, InfoWindow/custom overlays) — confidence HIGH (well-documented platform features).
- Note: general web_search / web_extract backend was returning auth errors during this research window; findings lean on X Search synthesis + domain reasoning rather than direct page extraction, hence overall MEDIUM confidence.

---
*Feature research for: Freight-flow visualization*
*Researched: 2026-07-06*
