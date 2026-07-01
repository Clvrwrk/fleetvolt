# Phase 4: Analyst Dashboard & Export - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 38
**Analogs found:** 28 / 38

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/src/app/page.tsx` | component (server) | request-response | `apps/web/src/app/page.tsx` (extend) | exact |
| `apps/web/src/app/status/page.tsx` | component (server) | request-response | `apps/web/src/app/page.tsx` | exact |
| `apps/web/src/app/layout.tsx` | config | — | `apps/web/src/app/layout.tsx` (extend) | exact |
| `apps/web/src/app/globals.css` | config | — | `apps/web/src/app/globals.css` + `Design/technical-brand-geometry-1.html` | partial |
| `apps/web/next.config.ts` | config | request-response | `apps/web/next.config.ts` (extend) | exact |
| `apps/web/package.json` | config | — | `apps/web/package.json` (extend) | exact |
| `apps/web/components.json` | config | — | — | no analog |
| `apps/web/src/components/workspace/workspace-layout.tsx` | component (client) | transform | `apps/web/src/app/page.tsx` (layout shell) | partial |
| `apps/web/src/components/scenario/scenario-form.tsx` | component (client) | request-response | `services/api/src/simulations.ts` (POST body) | partial |
| `apps/web/src/components/scenario/job-status-bar.tsx` | component (client) | request-response | `services/api/src/simulations.ts` (poll) | partial |
| `apps/web/src/components/scenario/sensitivity-sliders.tsx` | component (client) | request-response | `services/api/src/simulations.ts` (POST re-run) | partial |
| `apps/web/src/components/map/route-map.tsx` | component (client) | transform | — | no analog |
| `apps/web/src/components/map/route-map-dynamic.tsx` | component (client) | transform | RESEARCH Pattern 1 | no analog |
| `apps/web/src/components/charts/soc-profile-chart.tsx` | component (client) | transform | — | no analog |
| `apps/web/src/components/kpi/kpi-card-row.tsx` | component (client) | transform | `apps/web/src/app/page.tsx` (`Badge`) | partial |
| `apps/web/src/components/tables/charging-plan-table.tsx` | component (client) | transform | `apps/web/src/app/page.tsx` (table) | partial |
| `apps/web/src/components/tables/comparison-diff-table.tsx` | component (client) | transform | `apps/web/src/app/page.tsx` (table) | partial |
| `apps/web/src/components/comparison/comparison-tray.tsx` | component (client) | CRUD | — | no analog |
| `apps/web/src/components/results/assumptions-panel.tsx` | component (client) | transform | `packages/shared-types/src/schema.d.ts` | partial |
| `apps/web/src/components/export/export-menu.tsx` | component (client) | file-I/O | — | no analog |
| `apps/web/src/components/ui/*` | component | — | — | no analog (shadcn init) |
| `apps/web/src/stores/scenario-store.ts` | store | pub-sub | — | no analog |
| `apps/web/src/lib/api-client.ts` | utility | request-response | `apps/web/src/app/page.tsx` (fetch helpers) | exact |
| `apps/web/src/lib/scenario-schema.ts` | utility | transform | `packages/shared-types/src/schema.d.ts` | partial |
| `apps/web/src/lib/poll-job.ts` | utility | request-response | `services/api/src/simulations.ts` (GET poll) | partial |
| `apps/web/src/lib/segment-geojson.ts` | utility | transform | — | no analog |
| `apps/web/src/lib/export-csv.ts` | utility | file-I/O | — | no analog |
| `apps/web/src/lib/export-json.ts` | utility | file-I/O | — | no analog |
| `apps/web/src/lib/kpi.ts` | utility | transform | `packages/shared-types/src/schema.d.ts` (`KpiResult`) | partial |
| `services/api/src/simulations.ts` | route | CRUD | `services/api/src/simulations.ts` (extend) | exact |
| `services/api/src/exports.ts` | route | file-I/O | `services/api/src/simulations.ts` | role-match |
| `services/api/src/export-template.ts` | utility | transform | — | no analog |
| `services/api/src/app.ts` | route | request-response | `services/api/src/app.ts` (extend) | exact |
| `packages/shared-types/src/schema.d.ts` | model | transform | `packages/shared-types/src/schema.d.ts` (extend) | exact |
| `services/api/src/simulations.test.ts` | test | request-response | `services/api/src/simulations.test.ts` (extend) | exact |
| `services/api/src/exports.test.ts` | test | file-I/O | `services/api/src/simulations.test.ts` | role-match |
| `apps/web/src/lib/*.test.ts` | test | transform | `services/api/src/inputs_hash.test.ts` | role-match |
| `apps/web/playwright.config.ts` | config | — | — | no analog |

## Pattern Assignments

### `apps/web/src/app/page.tsx` (component/server, request-response) — MODIFY

**Analog:** Self — replace health dashboard with analyst workspace shell; keep SSR catalog fetch pattern.

**Server fetch + ok/error union** (page.tsx lines 47-69, 95-117):
```typescript
async function fetchNhfnStats(): Promise<
  { ok: true; data: NhfnStats } | { ok: false; error: string }
> {
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
  try {
    const response = await fetch(`${apiUrl}/v1/spatial/nhfn/stats`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `API returned ${response.status}: ${await response.text()}`,
      };
    }
    const data = (await response.json()) as NhfnStats;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

**Parallel SSR prefetch** (page.tsx lines 186-194):
```typescript
export default async function HomePage() {
  const [result, nhfnResult, trucksResult, freshnessResult, chargersResult] =
    await Promise.all([
      fetchStackMeta(),
      fetchNhfnStats(),
      fetchTrucks(),
      fetchFreshness(),
      fetchChargersNearPolb(),
    ]);
```

**Pattern to copy:** Server component prefetches `GET /v1/trucks` + `GET /v1/corridors` via `API_URL` + `cache: "no-store"`; pass catalogs as props to client `WorkspaceLayout`. Remove stack-health UI from `/` — delegate to `/status`.

---

### `apps/web/src/app/status/page.tsx` (component/server, request-response) — NEW

**Analog:** `apps/web/src/app/page.tsx` (relocate verbatim)

**Pattern to copy:** Move current `HomePage` implementation (lines 1-392) to `status/page.tsx` unchanged initially; update `layout.tsx` metadata title to "Stack Status". Keeps dev diagnostics without polluting analyst workspace (D-01).

---

### `apps/web/src/app/layout.tsx` (config) — MODIFY

**Analog:** Self

**Current layout pattern** (layout.tsx lines 1-19):
```typescript
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FleetVolt Route — Stack Status",
  description: "Local development stack health for FleetVolt Route",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**Pattern to copy:** Add `next/font/google` Inter 400/500; update metadata to analyst workspace copy; add `min-w-[1024px]` on body per D-03; import Tailwind v4 entry when postcss configured.

---

### `apps/web/src/app/globals.css` (config) — MODIFY

**Analog:** Self + `Design/technical-brand-geometry-1.html`

**Current dark dev tokens** (globals.css lines 1-9):
```css
:root {
  --bg: #0f1419;
  --surface: #1a2332;
  --text: #e8edf4;
  --muted: #8b9cb3;
  --ok: #22c55e;
  --bad: #ef4444;
  --border: #2d3a4f;
}
```

**Brand tokens to adopt** (technical-brand-geometry-1.html lines 14-16, 35-53):
```css
body {
  font-family: 'Inter', sans-serif;
  background-color: #EFEFF5;
}
.gradient-border-wrapper {
  position: relative;
  background: #EFEFF5;
  /* ::before gradient border mask — see 04-UI-SPEC.md .fv-panel */
}
```

**Existing table/badge patterns to preserve** (globals.css lines 59-77, 98-114):
```css
.badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}
```

**Pattern to copy:** Replace `:root` with `--fv-*` tokens from UI-SPEC; port `.gradient-border-wrapper` + corner brackets; keep `.mono` for hash/version strings; migrate shadcn CSS variables after init.

---

### `apps/web/next.config.ts` (config, request-response) — MODIFY

**Analog:** Self

**Current minimal config** (next.config.ts lines 1-7):
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

**Pattern to copy:** Add rewrites + transpilePackages per RESEARCH:
```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["mapbox-gl", "react-map-gl"],
  async rewrites() {
    const api = process.env.API_URL ?? "http://localhost:4000";
    return [{ source: "/api/v1/:path*", destination: `${api}/v1/:path*` }];
  },
};
```

---

### `apps/web/src/lib/api-client.ts` (utility, request-response) — NEW

**Analog:** `apps/web/src/app/page.tsx` fetch helpers

**Fetch with API_URL default** (page.tsx lines 50-52, 98-102):
```typescript
const apiUrl = process.env.API_URL ?? "http://localhost:4000";
const response = await fetch(`${apiUrl}/v1/trucks`, {
  cache: "no-store",
});
```

**Pattern to copy:** Client-side module uses same-origin `/api/v1` base (rewrites); server-side catalog fetch keeps `API_URL`. Export typed wrappers:
```typescript
const base = "/api/v1";

export async function postSimulation(body: unknown) {
  const res = await fetch(`${base}/simulations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

Import response types from `@fleetvolt/shared-types`:
```typescript
import type { components } from "@fleetvolt/shared-types";
type SimulationJobPollResponse = components["schemas"]["SimulationJobPollResponse"];
```

---

### `apps/web/src/lib/scenario-schema.ts` (utility, transform) — NEW

**Analog:** `packages/shared-types/src/schema.d.ts` (`SimulateRequest`, `ConditionsSpec`)

**OpenAPI request shape** (schema.d.ts lines 657-664, 376-390):
```typescript
SimulateRequest: {
  route: components["schemas"]["RouteSpec"];
  truck: components["schemas"]["TruckSpec"];
  conditions?: components["schemas"]["ConditionsSpec"];
  overrides?: components["schemas"]["OverridesSpec"];
  options?: components["schemas"]["SimulateOptions"];
};
ConditionsSpec: {
  weather_preset: components["schemas"]["WeatherPreset"];
  payload_lbs: number;
  port_drayage_enabled: boolean;
  charging?: components["schemas"]["ChargingConditionsSpec"];
};
WeatherPreset: "ideal" | "hot" | "cold" | "headwind";
```

**Pattern to copy:** Zod schema mirrors these fields exactly (D-27); payload 20k–80k per D-13; `options.include_charging: z.literal(true).default(true)`.

---

### `apps/web/src/lib/poll-job.ts` (utility, request-response) — NEW

**Analog:** `services/api/src/simulations.ts` (`getSimulation`)

**Poll payload assembly** (simulations.ts lines 133-169):
```typescript
async function getSimulation(request, reply) {
  const result = await deps.pool.query(
    `SELECT id, status, outputs, error, duration_ms
     FROM simulation_runs WHERE id = $1`,
    [id],
  );
  const payload: Record<string, unknown> = {
    job_id: row.id,
    status: row.status,
  };
  if (row.status === "COMPLETE" && row.outputs !== undefined) {
    payload.outputs = row.outputs;
  }
  if (row.status === "FAILED" && row.error !== undefined) {
    payload.error = row.error;
  }
  return payload;
}
```

**Pattern to copy:** Client poll loop calls `GET /api/v1/simulations/{id}` every 2s; abort via `AbortSignal` on unmount/new submit; throw on `FAILED` with `error.message` + `error.stage` (D-16).

---

### `apps/web/src/stores/scenario-store.ts` (store, pub-sub) — NEW

**Analog:** None — first client state store. Use RESEARCH Pattern 3 + Pattern 4.

**Pattern to copy:** Zustand store holds: `formInputs`, `activeJob`, `pollResult`, `comparisonScenarios[]` (max 3), `activeDistanceM`, `routeCoordinates` keyed by job_id. Use immer for comparison tray mutations (D-17). Wire submit → `postSimulation` → poll → set result.

---

### `apps/web/src/components/workspace/workspace-layout.tsx` (component/client, transform) — NEW

**Analog:** `apps/web/src/app/page.tsx` (card/table layout structure)

**Card grid pattern** (page.tsx lines 254-269):
```tsx
<div className="card">
  <h2>Services</h2>
  {services.map((service) => (
    <div key={service.name} className="service-row">
      <span>{service.name}</span>
      <Badge ok={service.ok} />
    </div>
  ))}
</div>
```

**Pattern to copy:** `'use client'` shell with CSS grid: left rail 320px + flex results canvas; header with Export/Compare slots; apply `.fv-panel` / `.gradient-border-wrapper` on primary panels per UI-SPEC. Accept SSR catalog props; children slots for form + results.

---

### `apps/web/src/components/scenario/scenario-form.tsx` (component/client, request-response) — NEW

**Analog:** `services/api/src/simulations.test.ts` (`CORRIDOR_BODY`)

**Canonical submit body** (simulations.test.ts lines 6-16):
```typescript
const CORRIDOR_BODY = {
  route: { corridor_key: "polb_cajon_pass" },
  truck: { slug: "ecascadia_438" },
  conditions: {
    weather_preset: "ideal",
    payload_lbs: 34000,
    port_drayage_enabled: false,
  },
  overrides: {},
  options: { include_charging: true },
};
```

**Pattern to copy:** React Hook Form + `@hookform/resolvers/zod` with `scenarioFormSchema`; truck Select from catalog; corridor Select from presets; on submit call store action → `postSimulation`; handle cache hit when `status === "COMPLETE"` (D-15).

---

### `apps/web/src/components/scenario/job-status-bar.tsx` (component/client, request-response) — NEW

**Analog:** `apps/web/src/app/page.tsx` (`Badge` component)

**Status badge pattern** (page.tsx lines 178-184):
```tsx
function Badge({ ok }: { ok: boolean }) {
  return (
    <span className={`badge ${ok ? "badge-ok" : "badge-bad"}`}>
      {ok ? "ok" : "down"}
    </span>
  );
}
```

**Pattern to copy:** Map `PENDING`/`RUNNING` → accent spinner; `COMPLETE` → green; `FAILED` → destructive Alert; cached chip shows `inputs_hash` prefix (D-12, D-15). `aria-live="polite"` per UI-SPEC accessibility.

---

### `apps/web/src/components/map/route-map.tsx` (component/client, transform) — NEW

**Analog:** None in repo — use RESEARCH Pattern 1 + Pattern 2

**SSR-safe dynamic import pattern** (RESEARCH.md):
```tsx
'use client';
import Map, { type MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

export function RouteMap({ mapRef }: { mapRef: React.RefObject<MapRef | null> }) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return <p>Set NEXT_PUBLIC_MAPBOX_TOKEN for map preview.</p>;
  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={token}
      preserveDrawingBuffer={true}
      /* layers: route-soc line-gradient, charger circles */
    />
  );
}
```

**Pattern to copy:** `preserveDrawingBuffer: true` for PDF capture (D-23); missing token → Alert not blank div (D-04); `mousemove` on route layer sets `activeDistanceM` (D-07).

---

### `apps/web/src/components/map/route-map-dynamic.tsx` (component/client, transform) — NEW

**Analog:** RESEARCH Pattern 1

```tsx
import dynamic from 'next/dynamic';
export const RouteMapDynamic = dynamic(() => import('./route-map').then(m => m.RouteMap), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-muted" />,
});
```

---

### `apps/web/src/lib/segment-geojson.ts` (utility, transform) — NEW

**Analog:** None — use RESEARCH Pattern 2 + `RouteResponse.coordinates`

**Route API type** (schema.d.ts lines 588-615):
```typescript
RouteResponse: {
  distance_m: number;
  duration_s: number;
  coordinates?: number[][];
  valhalla_status: string;
};
SegmentResult: {
  dist_m: number;
  soc_pct: number;
  energy_kwh: number;
  /* ... */
};
```

**Pattern to copy:** Fetch `GET /v1/routing/route?origin_lat=...` using corridor catalog origin/dest; build `line-gradient` step expression from segment `dist_m` / total distance; `socColor()` thresholds green >40%, amber 20–40%, red <20% (D-05).

---

### `apps/web/src/components/charts/soc-profile-chart.tsx` (component/client, transform) — NEW

**Analog:** None — use RESEARCH Pattern 4

**Pattern to copy:** Recharts `LineChart` with X = `dist_m / 1609.34`, Y = `soc_pct`; `ReferenceLine` at charging stop distances; `onMouseMove` sets Zustand `activeDistanceM` — do **not** use `syncId` alone (D-07, D-08).

---

### `apps/web/src/components/kpi/kpi-card-row.tsx` (component/client, transform) — NEW

**Analog:** `packages/shared-types/src/schema.d.ts` (`KpiResult`, `FeasibilityResult`)

**KPI + feasibility types** (schema.d.ts lines 504-514, 478-498):
```typescript
KpiResult: {
  total_kwh: number;
  wh_per_mi: number;
  regen_kwh: number;
  total_time_s: number;
};
FeasibilityResult: {
  verdict: "feasible" | "critical" | "infeasible";
  tier: "public_hd" | "depot_required" | "infrastructure_gap";
  stop_count: number;
};
```

**Pattern to copy:** Derive 7 KPI cards per UI-SPEC table; feasibility Badge + tier tag; format `total_time_s` and dwell sum as `Xh XXm`.

---

### `apps/web/src/components/tables/charging-plan-table.tsx` (component/client, transform) — NEW

**Analog:** `apps/web/src/app/page.tsx` (table markup)

**Table pattern** (page.tsx lines 363-381):
```tsx
<table>
  <thead>
    <tr>
      <th>Model</th>
      <th>Usable / Nameplate</th>
      <th>Usable %</th>
    </tr>
  </thead>
  <tbody>
    {trucksResult.data.map((truck) => (
      <tr key={truck.id}>
        <td>{truck.name}</td>
        <td className="mono">{truck.usable_kwh} / {truck.nameplate_kwh} kWh</td>
      </tr>
    ))}
  </tbody>
</table>
```

**Charging stop fields** (schema.d.ts lines 353-374):
```typescript
ChargingStopResult: {
  station_id: string;
  name?: string | null;
  lat: number;
  lon: number;
  power_kw: number;
  arrival_soc_pct: number;
  departure_soc_pct: number;
  dwell_s: number;
  energy_added_kwh: number;
};
```

**Pattern to copy:** shadcn Table wrapper; row click → `mapRef.flyTo({ center: [lon, lat] })` (D-10); selected row left border accent when map-synced.

---

### `apps/web/src/components/comparison/comparison-tray.tsx` + `comparison-diff-table.tsx` (component/client) — NEW

**Analog:** `apps/web/src/app/page.tsx` (table) for diff table; no tray analog

**Pattern to copy:** Zustand `comparisonScenarios` max 3 with labels A/B/C; diff table columns A, B, C, Δ(B−A), Δ(C−A) for KPI rows + stop count + feasibility verdict (D-18).

---

### `apps/web/src/components/export/export-menu.tsx` (component/client, file-I/O) — NEW

**Analog:** None — RESEARCH Pattern 5 + Pattern 6

**Client blob download** (RESEARCH.md):
```typescript
function downloadBlob(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Map PNG capture** (RESEARCH.md):
```typescript
async function captureMapPng(map: mapboxgl.Map): Promise<string> {
  return new Promise((resolve) => {
    map.once('idle', () => resolve(map.getCanvas().toDataURL('image/png')));
    map.triggerRepaint();
  });
}
```

**Pattern to copy:** CSV/JSON client-side from poll result; PDF POST `/api/v1/exports/pdf` with `{ job_id, map_snapshot_base64 }` after idle capture (D-21–D-24).

---

### `apps/web/src/lib/export-csv.ts` + `export-json.ts` (utility, file-I/O) — NEW

**Analog:** None — use RESEARCH Pattern 6

**Pattern to copy:** CSV header comment rows with `inputs_hash`, `physics_version`, `charger_version`; flat segments table + charging_stops section; JSON = full `SimulationJobPollResponse` blob; prefix CSV cells starting with `=`, `+`, `-`, `@` with `'` (RESEARCH security table).

---

### `services/api/src/simulations.ts` (route, CRUD) — MODIFY

**Analog:** Self — extend `getSimulation` SELECT

**Current poll SELECT** (simulations.ts lines 139-144):
```typescript
const result = await deps.pool.query(
  `SELECT id, status, outputs, error, duration_ms
   FROM simulation_runs
   WHERE id = $1`,
  [id],
);
```

**INSERT already stores audit fields** (simulations.ts lines 62-68):
```typescript
const inserted = await deps.pool.query(
  `INSERT INTO simulation_runs (
     inputs, inputs_hash, status, physics_version, charger_version
   )
   VALUES ($1, $2, 'PENDING', $3, $4)
   RETURNING id`,
  [body, hash, PHYSICS_VERSION, CHARGER_VERSION],
);
```

**Pattern to copy:** Wave 0 — extend SELECT to include `inputs_hash, physics_version, charger_version, inputs`; add to poll payload and cache-hit POST response (D-12, SCEN-04). Keep `createSimulationsHandlers` + injectable `SimulationsDeps` for tests.

---

### `services/api/src/exports.ts` (route, file-I/O) — NEW

**Analog:** `services/api/src/simulations.ts` (handler factory + route registration)

**Handler factory pattern** (simulations.ts lines 38-42, 175-182):
```typescript
export function createSimulationsHandlers(deps: SimulationsDeps = defaultDeps) {
  async function postSimulation(request, reply) { /* ... */ }
  return { postSimulation, getSimulation };
}

export function registerSimulationRoutes(app: FastifyInstance, deps?: SimulationsDeps) {
  const { postSimulation, getSimulation } = createSimulationsHandlers(deps);
  app.post("/v1/simulations", postSimulation);
  app.get("/v1/simulations/:id", getSimulation);
}
```

**Puppeteer render** (RESEARCH Pattern 5):
```typescript
import puppeteer from 'puppeteer';

export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
```

**Pattern to copy:** `POST /v1/exports/pdf` validates UUID `job_id`; limit base64 payload ~5MB; load job row for KPIs/assumptions; inline HTML only (no user URLs — SSRF guard); return `application/pdf`.

---

### `services/api/src/app.ts` (route) — MODIFY

**Analog:** Self

**Route registration** (app.ts lines 216-217):
```typescript
registerSimulationRoutes(app, options?.simulationsDeps);
return app;
```

**CORS for browser client** (app.ts lines 15-21):
```typescript
await app.register(cors, {
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://web:3000",
  ],
});
```

**Proxy GET with query passthrough** (app.ts lines 115-153):
```typescript
async function proxySimulatorGet(request, reply, path, timeoutMs = 5000) {
  const query = request.url?.split("?")[1];
  const url = query ? `${simulatorUrl}${path}?${query}` : `${simulatorUrl}${path}`;
  /* fetch + simulator_error / simulator_unreachable envelope */
}
```

**Pattern to copy:** Add `registerExportRoutes(app)`; add `app.get("/v1/routing/route", ...)` proxy if not already proxied (needed for client route geometry fetch).

---

### `packages/shared-types/src/schema.d.ts` (model, transform) — MODIFY

**Analog:** Self — extend `SimulationJobPollResponse`

**Current poll type** (schema.d.ts lines 792-807):
```typescript
SimulationJobPollResponse: {
  job_id: string;
  status: "PENDING" | "RUNNING" | "COMPLETE" | "FAILED";
  outputs?: components["schemas"]["SimulateResponse"] | null;
  error?: { [key: string]: unknown; } | null;
  duration_ms?: number | null;
};
```

**Pattern to copy:** Add optional `inputs_hash`, `physics_version`, `charger_version`, `inputs`; add `PdfExportRequest` / `PdfExportResponse` for new route; regenerate via OpenAPI codegen — do not hand-edit without simulator schema update.

---

### `services/api/src/simulations.test.ts` (test, request-response) — MODIFY

**Analog:** Self

**Mock pool + inject pattern** (simulations.test.ts lines 24-54, 80-96):
```typescript
function createMockPool(handlers: { onGet?: (id: string) => unknown }) {
  return {
    query: mock.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes("WHERE id = $1") && sql.includes("duration_ms")) {
        const row = handlers.onGet?.(params[0] as string);
        return { rows: row ? [row as Record<string, unknown>] : [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    }),
  } satisfies SimulationsDeps["pool"];
}

const app = await buildApp({ logger: false, simulationsDeps: deps });
const response = await app.inject({ method: "GET", url: `/v1/simulations/${runId}` });
```

**Pattern to copy:** Add test asserting poll response includes `inputs_hash`, `physics_version`, `charger_version` after Wave 0 extension.

---

### `services/api/src/exports.test.ts` (test, file-I/O) — NEW

**Analog:** `services/api/src/simulations.test.ts`

**Pattern to copy:** Mock Puppeteer or test HTML template builder separately; `app.inject` POST `/v1/exports/pdf` asserts `content-type: application/pdf` and status 200; test 404 for unknown job_id.

---

### `apps/web/src/lib/*.test.ts` (test, transform) — NEW

**Analog:** `services/api/src/inputs_hash.test.ts`

**Node test runner pattern** (inputs_hash.test.ts lines 1-21):
```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("computeInputsHash", () => {
  it("matches Python committed test vector", () => {
    assert.equal(digest, TEST_VECTOR_EXPECTED_HASH);
  });
});
```

**Pattern to copy:** Unit tests for `segment-geojson`, `kpi` derivations, `export-csv` header rows using fixture `MOCK_OUTPUTS` from simulations.test.ts; run via `node --test`.

---

## Shared Patterns

### Server-Side API Fetch (SSR catalog)
**Source:** `apps/web/src/app/page.tsx`
**Apply to:** `page.tsx`, server-only catalog helpers
```typescript
const apiUrl = process.env.API_URL ?? "http://localhost:4000";
const response = await fetch(`${apiUrl}/v1/trucks`, { cache: "no-store" });
```

### Client API via Next Rewrites
**Source:** RESEARCH Pattern 1 + `apps/web/next.config.ts`
**Apply to:** `api-client.ts`, `poll-job.ts`, `export-menu.tsx`
```typescript
const base = "/api/v1";
await fetch(`${base}/simulations`, { method: "POST", ... });
```

### OpenAPI Types from `@fleetvolt/shared-types`
**Source:** `packages/shared-types/src/schema.d.ts`
**Apply to:** All web lib + components — no hand-written simulation interfaces (D-26)
```typescript
import type { components } from "@fleetvolt/shared-types";
type SimulateResponse = components["schemas"]["SimulateResponse"];
```

### Fastify Handler Factory + Injectable Deps
**Source:** `services/api/src/simulations.ts`
**Apply to:** `exports.ts`, extend `simulations.ts`
```typescript
export function createSimulationsHandlers(deps: SimulationsDeps = defaultDeps) {
  /* handlers */
  return { postSimulation, getSimulation };
}
```

### Fastify Error Envelope
**Source:** `services/api/src/app.ts`, `simulations.ts`
**Apply to:** All API routes
```typescript
return reply.status(404).send({ error: "not_found", message: "Simulation run not found" });
return reply.status(503).send({ error: "simulator_unreachable", message: ... });
```

### Node Built-in Test + Mock Pool
**Source:** `services/api/src/simulations.test.ts`
**Apply to:** `simulations.test.ts`, `exports.test.ts`
```typescript
import { describe, it, mock, afterEach } from "node:test";
const app = await buildApp({ logger: false, simulationsDeps: deps });
const response = await app.inject({ method: "POST", url: "/v1/simulations", payload: CORRIDOR_BODY });
```

### Canonical Demo Scenario Body
**Source:** `services/api/src/simulations.test.ts`
**Apply to:** Default form values, E2E smoke, manual UAT
```typescript
const CORRIDOR_BODY = {
  route: { corridor_key: "polb_cajon_pass" },
  truck: { slug: "ecascadia_438" },
  conditions: { weather_preset: "ideal", payload_lbs: 34000, port_drayage_enabled: false },
  options: { include_charging: true },
};
```

### CORS Already Configured for `:3000`
**Source:** `services/api/src/app.ts`
**Apply to:** Fallback if rewrites skipped — `NEXT_PUBLIC_API_URL` works without extra CORS setup

### Brand Surface Tokens
**Source:** `Design/technical-brand-geometry-1.html`, `04-UI-SPEC.md`
**Apply to:** `globals.css`, workspace panels, KPI cards
- Background `#EFEFF5`, accent `#2D4A6F`, Inter font
- `.gradient-border-wrapper` + corner brackets on primary panels

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/components.json` | config | — | shadcn not initialized yet — run `npx shadcn init` per D-29 |
| `apps/web/src/components/map/route-map.tsx` | component | transform | First Mapbox usage — use RESEARCH Patterns 1–2 |
| `apps/web/src/components/charts/soc-profile-chart.tsx` | component | transform | First Recharts usage — use RESEARCH Pattern 4 |
| `apps/web/src/stores/scenario-store.ts` | store | pub-sub | First Zustand store in monorepo |
| `apps/web/src/lib/segment-geojson.ts` | utility | transform | No GeoJSON/Mapbox util exists — turf + line-gradient new |
| `apps/web/src/lib/export-csv.ts` | utility | file-I/O | No client export helpers in repo |
| `apps/web/src/lib/export-json.ts` | utility | file-I/O | No client export helpers in repo |
| `services/api/src/export-template.ts` | utility | transform | First HTML→PDF template — Puppeteer per RESEARCH Pattern 5 |
| `apps/web/src/components/ui/*` | component | — | shadcn greenfield — official registry only per UI-SPEC |
| `apps/web/playwright.config.ts` | config | — | No Playwright in repo yet — optional Wave 4 gate |

## Metadata

**Analog search scope:** `apps/web/src/`, `services/api/src/`, `packages/shared-types/src/`, `Design/`, `.planning/phases/03-charging-job-pipeline/03-PATTERNS.md`
**Files scanned:** 22 source files
**Pattern extraction date:** 2026-07-01
