# Phase 4: Analyst Dashboard & Export - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning
**Source:** PRD + architecture synthesis (pre-discuss express)

<domain>
## Phase Boundary

Phase 4 delivers the **analyst-facing desktop web UI** for POLB corridor simulations: scenario configuration, async job submission/polling, interactive results dashboard (map + charts + KPIs + charging table), **2+ scenario comparison** with sensitivity sliders, and **CSV/JSON/PDF export** with assumptions audit trail.

Success means a fleet analyst can configure a corridor scenario, run it via `POST /v1/simulations`, review defensible results visually, compare variants side-by-side, and export client-ready artifacts — **without** NHFN route preference, corridor gap analysis, emissions economics, or TCO (Phases 5–6).

Phase 3's async job API, `simulation_runs` cache, `charging_stops[]`, `feasibility{}`, and full segment arrays are the data contract; Phase 4 consumes them read-only from the web app via Fastify `:4000`.
</domain>

<decisions>
## Implementation Decisions

### App Shell & Routing (MAP-01 foundation)
- **D-01:** Replace the Phase 1 health-check homepage with an **analyst workspace** at `/` — left configuration panel + right results canvas (map + charts). Keep a `/status` or collapsible "Stack health" drawer for dev diagnostics (relocate current `page.tsx` content).
- **D-02:** **Next.js App Router** in `apps/web` — server components for initial catalog fetch (trucks, corridors); client components for map, charts, polling, and comparison state.
- **D-03:** **Desktop-first layout** — min width 1280px primary target; responsive down to 1024px with stacked panels; mobile deferred to v2.

### Map & Visualization (MAP-01, MAP-02, MAP-03)
- **D-04:** **Mapbox GL JS** for base map and route layers — PRD/architecture preference; use `NEXT_PUBLIC_MAPBOX_TOKEN` env var; fallback dev message if token missing (no silent blank map).
- **D-05:** **SoC-gradient route polyline** — single GeoJSON LineString split or `line-gradient` by segment `soc_pct` (green >40%, amber 20–40%, red <20%); use segment midpoint colors from `outputs.segments[]`.
- **D-06:** **Charger markers** — render `charging_stops[]` as circle layers sized by `power_kw` (min 8px, max 20px) and colored by HD tier (≥350 kW = brand accent); popup on click with name, power, arrival/departure SoC, dwell.
- **D-07:** **Map ↔ chart hover sync** — shared `activeDistanceM` state; hovering chart brush or map point highlights corresponding segment index; use segment `dist_m` for lookup.
- **D-08:** **Profile chart** — Recharts line chart: X = distance (mi), Y = SoC (%); secondary optional series for segment `energy_kwh`; charging stop vertical reference lines at stop distances.

### KPIs, Tables & Assumptions (MAP-04, MAP-05, MAP-06)
- **D-09:** **KPI card row** — total kWh, Wh/mi, total time, stop count, total dwell, final SoC %, feasibility verdict badge with tier tag (`public_hd` / `depot_required` / `infrastructure_gap`).
- **D-10:** **Charging plan table** — columns: location, power kW, arrival SoC, energy added kWh, dwell (min), departure SoC; row click zooms map to stop.
- **D-11:** **Assumptions & limitations panel** — collapsible right or bottom drawer: physics_version, charger_version, inputs_hash, weather preset, payload, port drayage flag, link to `model_assumptions.md` sections; **prominent disclaimer** per architecture §liability (not for dispatch/HOS).
- **D-12:** Surface **model version strings** from poll response (`physics_version`, `charger_version`) and job `inputs_hash` for audit replay (SCEN-04).

### Scenario Configuration & Job Flow (SCEN-04)
- **D-13:** **Scenario form** — truck select (`GET /v1/trucks`), corridor preset (`GET /v1/corridors`), conditions: weather preset enum, payload lbs slider (20k–80k), port drayage toggle, `options.include_charging: true` default.
- **D-14:** **Run submits async job** — `POST /v1/simulations` via `API_URL` (browser calls Fastify `:4000` through Next rewrites or `NEXT_PUBLIC_API_URL`); show PENDING spinner with poll every 2s on `GET /v1/simulations/{id}` until COMPLETE/FAILED.
- **D-15:** **Cache hit UX** — if POST returns `COMPLETE` immediately, skip poll and render results; display "cached result" chip with `inputs_hash` prefix.
- **D-16:** **FAILED state** — show `error.message` and `error.stage` from poll payload; allow retry without losing form inputs.

### Comparison & Sensitivity (SCEN-01, SCEN-02)
- **D-17:** **Comparison mode** — user can pin up to **3 scenarios** (A/B/C) in session; each run adds to comparison tray if "Add to comparison" checked.
- **D-18:** **Side-by-side diff table** — KPI columns per scenario + delta columns (B−A, C−A); charging stop count and feasibility verdict diff rows.
- **D-19:** **Sensitivity sliders** (local what-if without re-run for v1): payload ±%, temperature offset, headwind m/s — **re-run job** on slider release (debounced 500ms) using same corridor/truck with updated `conditions`; show delta KPIs vs baseline scenario in comparison tray.
- **D-20:** **SCEN-03 corridor gap analysis deferred to Phase 5** — do not build NHFN gap map layer in Phase 4.

### Export (EXPR-01, EXPR-02, EXPR-03)
- **D-21:** **CSV export** — client-side download from poll `outputs`: segments flat table + charging_stops sheet; include `inputs_hash`, physics/charger versions in header comment row.
- **D-22:** **JSON export** — full poll payload (`inputs` + `outputs` + metadata) as downloadable blob; schema matches OpenAPI `SimulationJobResult`.
- **D-23:** **PDF export** — **server route** `POST /v1/exports/pdf` on Fastify (Node) using Puppeteer or pdfkit; accepts `job_id`, renders HTML template with KPI summary, assumptions table, charging table, embedded map snapshot (client sends base64 PNG from Mapbox `map.getCanvas().toDataURL()`), physics parameter snapshot from truck config + conditions.
- **D-24:** PDF includes **disclaimer footer**, model versions, `inputs_hash`, and export timestamp for consulting audit trail (EXPR-03).

### State & Types
- **D-25:** **Zustand** for client scenario/comparison/poll state — single store `useScenarioStore` with immer-friendly updates; avoid prop drilling across map/chart/form.
- **D-26:** Import API types from **`@fleetvolt/shared-types`** (`schema.d.ts`) — no duplicate hand-written simulation interfaces.
- **D-27:** **Zod** validates scenario form before submit; share shape with `inputs_hash` canonical fields.

### Styling & Brand
- **D-28:** **Tailwind CSS v4** + design tokens from `Design/technical-brand-geometry-1.html` — background `#EFEFF5`, Inter font, skeuomorphic card borders, corner bracket accents on primary panels; no full 3D hero — extract color/spacing/typography only.
- **D-29:** **shadcn/ui** — add minimal set: Button, Card, Slider, Select, Tabs, Badge, Table, Collapsible for dashboard; install via existing monorepo patterns.

### Claude's Discretion
- Exact Next.js rewrite vs CORS for browser → Fastify API
- Mapbox vs react-map-gl wrapper choice
- PDF library (Puppeteer in api service vs @react-pdf/renderer client-only) — prefer server route per D-23
- Comparison tray UI pattern (tabs vs split columns)
- Segment-to-GeoJSON assembly location (client util vs api enrich endpoint)
- Playwright E2E scope for Phase 4 vs manual UAT only

</decisions>

<canonical_refs>
## Canonical References

### Product & Requirements
- `00_PRD_FleetVolt_Route_v2.md` — §10 user journey, §11 frontend stack, M5–M8 milestones
- `.planning/REQUIREMENTS.md` — MAP-01–06, SCEN-01/02/04, EXPR-01–03
- `.planning/ROADMAP.md` — Phase 4 goal and success criteria
- `01_Technical_Architecture_FleetVolt.md` — §frontend map layers, chart sync, export, disclaimers
- `Design/technical-brand-geometry-1.html` — brand colors, Inter, card treatment

### Phase 3 Handoff (API contract)
- `.planning/phases/03-charging-job-pipeline/03-CONTEXT.md` — async API, charging_stops, feasibility shape
- `packages/shared-types/src/schema.d.ts` — OpenAPI types for simulations
- `services/api/src/simulations.ts` — POST/GET job routes
- `services/simulator/docs/model_assumptions.md` — assumptions text for panel

### Existing Web
- `apps/web/src/app/page.tsx` — current stack health page to relocate
- `apps/web/src/app/globals.css` — base styles
- `apps/web/package.json` — Next 16 + React 19 (map/chart deps to add)

</canonical_refs>

<specifics>
## Specific Ideas

- Primary demo corridor: `polb_cajon_pass` with `ecascadia_438` and ideal weather — matches Phase 3 integration tests.
- Analyst persona: consultant preparing POLB drayage feasibility deck; export PDF is the deliverable.
- Comparison example: baseline ideal vs hot weather vs +10k payload sensitivity.

</specifics>

<deferred>
## Deferred Ideas

- SCEN-03 corridor charging gap analysis map overlay (Phase 5)
- User accounts and saved scenarios (PRD S5)
- PWA/offline (PRD C5)
- Real-time OpenWeatherMap pull (PRD S2) — use weather presets only
- Mobile driver companion UI
- Interactive stop editing / drag-to-reorder charging plan

</deferred>

---

*Phase: 04-analyst-dashboard-export*
*Context gathered: 2026-07-01 via PRD/architecture synthesis*
