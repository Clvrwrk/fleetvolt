# Stack Research

**Domain:** Freight-flow geospatial visualization (Google Maps + animated overlays)
**Researched:** 2026-07-06
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|---|---|---|---|
| Next.js (App Router) | 15.5.20 | App framework on Vercel | Locked. Stay on the mature 15.5.x LTS line, not the just-released 16.x, for Convex/WorkOS/Sentry ecosystem stability. React 19 baseline. |
| React | 19.2.7 | UI runtime | Ships with Next 15.5; required peer for `@vis.gl/react-google-maps` 1.9 and Convex 1.42. |
| `@vis.gl/react-google-maps` | 1.9.0 | React wrapper for Google Maps JS API | **Primary map lib.** Actively maintained by the vis.gl/Google team, React 19 + App Router friendly, hooks-first (`useMap`, `useMapsLibrary`), clean `APIProvider`. Best fit for imperative overlay/animation work. |
| `convex` | 1.42.1 | Real-time DB + state (sim datasets, user filters) | Locked. Reactive queries auto-push to client; single package ships client, React bindings, and codegen. |
| `gsap` | 3.15.0 | Animation engine (masked reveal, SVG stroke-draw, marker tween) | Locked. Since GSAP 3.13 (late 2024) **all plugins including MotionPathPlugin and DrawSVGPlugin are 100% free** under the Webflow-owned license. |
| Google Maps JavaScript API | v=weekly (`quarterly` channel recommended) | Base map, Traffic layer, Directions, Polylines, InfoWindows | Locked. Pin `v=quarterly` in loader for stability; `weekly` only in dev. |
| `@workos-inc/authkit-nextjs` | 4.2.0 | Auth (AuthKit) | Locked. Official App-Router SDK: middleware + `withAuth()` server helper + `<AuthKitProvider>`. |
| `@sentry/nextjs` | 10.63.0 | Error + performance monitoring | Locked. v10 uses the instrumentation-hook + `withSentryConfig` model native to Next 15. |
| Tailwind CSS | 4.3.2 | Styling engine | Locked. v4 CSS-first config (`@theme`), Oxide engine. Shadcn/ui supports v4. |
| Shadcn/ui | CLI `canary`/latest (not versioned pkg) | Component primitives (dialogs, toggles, popovers) | Locked. Copy-in components; use the Tailwind v4 + React 19 compatible CLI. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `@googlemaps/js-api-loader` | 2.1.1 | Low-level API loader | Transitive dep of `@vis.gl/react-google-maps`; only install directly if you also load Maps outside React. |
| `@types/google.maps` | ^3.64.0 | TS types for `google.maps.*` | Always in dev; enables typed Polyline/Marker/DirectionsService. |
| `@googlemaps/markerclusterer` | 2.6.2 | Cluster dense hotspots | When many queue/parking/HQ markers overlap at low zoom. |
| `@convex-dev/workos` (or `convex/react` + custom) | latest | Bridge WorkOS AuthKit → Convex auth | Use to pass WorkOS JWT into `ConvexProviderWithAuth` so queries are authed. |
| `simplify-js` | 1.2.4 | Douglas-Peucker polyline simplification | Thin dense highway geometry (Directions `overview_path`) before animating for perf. |
| `@turf/turf` | 7.2.0 | Geospatial math (bearing, along, length) | Compute marker heading + position-along-line for the Class-8 truck when NOT using GSAP MotionPath on screen coords. |
| `jetbrains-mono` (fontsource) `@fontsource/jetbrains-mono` | 5.2.8 | Self-host JetBrains Mono | Load via `next/font` or fontsource for the CAD/blueprint typography. |
| `clsx` + `tailwind-merge` | 2.x / 3.x | Conditional class composition | Standard Shadcn utility (`cn()`). |

### Development Tools

| Tool | Purpose | Notes |
|---|---|---|
| TypeScript | Type safety across map + Convex codegen | 5.6+; Convex generates typed API into `convex/_generated`. |
| Convex CLI (`npx convex dev`) | Local reactive backend + codegen | Run alongside `next dev`; pushes schema/functions. |
| Vercel CLI | Deploy previews | Set `NEXT_PUBLIC_CONVEX_URL`, Maps key, WorkOS + Sentry env vars. |
| Sentry Wizard (`npx @sentry/wizard@latest -i nextjs`) | Scaffold Sentry config | Generates `instrumentation.ts` + client/server/edge configs for v10. |
| Google Cloud Console | Enable Maps JS + Directions APIs, key restriction | Restrict key by HTTP referrer + API; billing required (paid). |
| ESLint / Prettier | Lint/format | Next 15 flat-config ESLint. |

## Installation

```bash
# 1. App base (Next 15.5 + React 19 + TS + Tailwind v4 already scaffolded)
npx create-next-app@15 fleetvolt-pulse --ts --app --tailwind

# 2. Map + geo
npm install @vis.gl/react-google-maps@1.9.0
npm install @googlemaps/markerclusterer@2.6.2 @turf/turf@7.2.0 simplify-js@1.2.4
npm install -D @types/google.maps

# 3. Real-time state
npm install convex@1.42.1

# 4. Auth (WorkOS AuthKit) + Convex bridge
npm install @workos-inc/authkit-nextjs@4.2.0
npm install @convex-dev/workos            # authed Convex queries

# 5. Animation (all plugins now free)
npm install gsap@3.15.0

# 6. Monitoring
npm install @sentry/nextjs@10.63.0
npx @sentry/wizard@latest -i nextjs       # scaffolds instrumentation.ts

# 7. Typography + Shadcn utils
npm install @fontsource/jetbrains-mono@5.2.8 clsx tailwind-merge
npx shadcn@latest init                    # Tailwind v4 / React 19 aware CLI
npx shadcn@latest add dialog popover switch toggle-group tabs
```

Env vars (`.env.local` + Vercel):
```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...        # referrer-restricted, Maps JS + Directions enabled
NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
WORKOS_API_KEY=...  WORKOS_CLIENT_ID=...  WORKOS_COOKIE_PASSWORD=<32+ chars>
NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://app/callback
SENTRY_AUTH_TOKEN=...  NEXT_PUBLIC_SENTRY_DSN=...
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| `@vis.gl/react-google-maps` 1.9 | `@react-google-maps/api` 2.20.8 | Only for legacy React 18 codebases. It is community-maintained, slower to track new Maps features, wraps everything in components (harder to do imperative per-frame Polyline mutation), and has known React 19/StrictMode double-mount friction. Not recommended for new build. |
| GSAP `MotionPathPlugin` on an SVG overlay | Google Maps `AdvancedMarkerElement` + `requestAnimationFrame` lat/lng lerp | Use the RAF+lat/lng lerp when the truck must stay perfectly geo-anchored at all zooms and you don't need easing. Use GSAP MotionPath when the truck rides a screen-space SVG (custom `OverlayView`/`google.maps.OverlayView`) for buttery eased motion + the blueprint aesthetic. |
| Deck.gl `TripsLayer` | Raw animated `google.maps.Polyline` with `icons` dashed-offset trick | Use Deck.gl only if flows exceed ~thousands of animated segments (WebGL batching). For a curated set of West-Coast corridors, native Polyline + GSAP is lighter and matches the CAD look. |
| Convex reactive queries | Server-Sent Events / polling REST | Never for this app — Convex is locked and gives live push for free. |
| Canvas 2D blueprint grid | Pure CSS `repeating-linear-gradient` grid | Use CSS gradient for a static grid; use Canvas/WebGL when the grid must parallax/animate (drifting blueprint) with GSAP-driven offset. |
| `@fontsource/jetbrains-mono` | `next/font/google` JetBrains Mono | Either works; `next/font` self-hosts + avoids layout shift automatically. Fontsource preferred if you need the font in non-Next contexts (canvas text). |

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| `@react-google-maps/api` | Community lib, laggy feature parity, React 19/StrictMode issues, component-only API fights imperative animation | `@vis.gl/react-google-maps` 1.9 |
| Deprecated `google.maps.Marker` | Officially deprecated Feb 2024; won't get new features | `google.maps.marker.AdvancedMarkerElement` (via `useMapsLibrary('marker')`) |
| GSAP "Club/Shockingly Green" paid tier mentions | Obsolete — since v3.13 (2024) ALL plugins incl. DrawSVG/MotionPath are free under Webflow | Plain `npm install gsap@3.15.0` |
| Loading Maps with `v=weekly` in prod | Ships breaking changes weekly | Pin `version: 'quarterly'` in `<APIProvider>` |
| `@sentry/nextjs` v7/v8 patterns (`sentry.client.config` + `sentry.properties`) | v10 replaced them with the `instrumentation.ts` hook + `withSentryConfig` | Run the v10 wizard; use instrumentation hook |
| Deprecated WorkOS SSO SDK / manual OAuth | Superseded by AuthKit | `@workos-inc/authkit-nextjs` 4.x middleware + `withAuth()` |
| Convex `useQuery` in a Server Component | Convex React hooks are client-only | Mark `'use client'`; wrap tree in `ConvexProviderWithAuth` inside a client provider component imported by the server layout |
| Next.js 16.x (latest) for this milestone | Too fresh; Convex/WorkOS/Sentry integration guides target 15.x | Pin Next 15.5.20 |
| Animating hundreds of Polylines by re-`setPath()` every frame on main thread | Jank/GC pressure | Animate `strokeOpacity`/`icons` offset, or move flows to an SVG `OverlayView` and tween with GSAP; simplify geometry with `simplify-js` first |

## Stack Patterns by Variant

### Variant A — Pulsing volume-flow polylines (red/yellow/green)
- Fetch corridor geometry once (from Convex or Directions `overview_path`), run `simplify-js` (tolerance ~0.0002) to cut vertex count.
- Render as native `google.maps.Polyline`. Encode volume state → stroke color. Create the "pulse" with the **animated symbol / dashed-offset trick**: attach an `icons: [{icon: {path: 'M 0,-1 0,1', strokeOpacity:1, scale:4}, offset:'0%', repeat:'20px'}]` and drive `offset` `0%→100%` on a `setInterval`/RAF loop, or animate `strokeOpacity` sinusoidally via GSAP for a breathing pulse. Color severity: green `#00d17a`, yellow `#ffc400`, red `#ff3b30`.
- Keep flow count curated (dozens, not thousands) so main-thread mutation stays smooth.

### Variant B — Class-8 truck SVG marker traveling the flow
- Preferred CAD-aesthetic path: custom `google.maps.OverlayView` hosting an SVG layer; project the polyline to pixel space (`OverlayView.getProjection().fromLatLngToDivPixel`) into an SVG `<path>`, then `gsap.to(truck, {motionPath:{path: svgPath, autoRotate:true}, duration, repeat:-1, ease:'none'})`. Re-project on `bounds_changed`/`zoom_changed`.
- Geo-locked alternative: `AdvancedMarkerElement` whose position is set each RAF frame by interpolating along the path with `@turf/along` + `@turf/bearing` for heading. Use when zoom independence matters more than eased motion.

### Variant C — Convex real-time in Next 15 App Router
- Create `app/ConvexClientProvider.tsx` (`'use client'`) wrapping `ConvexProviderWithAuth` (WorkOS token via `@convex-dev/workos` / `useAuth` fetching the WorkOS access token). Import it in the server `app/layout.tsx`.
- All map/filter components are `'use client'`; call `useQuery(api.flows.list, {dateRange, mode})`. Changing the date filter (`5yr/1yr/Live`) just changes query args → Convex re-pushes. "Live" mode: a Convex scheduled/cron mutation writes sim ticks; the same `useQuery` streams them with zero extra plumbing.

### Variant D — GSAP masked-reveal + SVG stroke-draw + blueprint grid
- Register plugins client-side only: `gsap.registerPlugin(DrawSVGPlugin, MotionPathPlugin, useGSAP)` inside `useGSAP(() => {...}, {scope})` from `@gsap/react`.
- Dimension-callout popups: draw leader lines with `DrawSVGPlugin` (`drawSVG: '0%'→'100%'`); reveal the framed InfoWindow content with a clip-path/mask tween.
- Blueprint grid background: `<canvas>` (2D) sized to container, draw grid lines each frame with a GSAP-driven `offset` for a slow drift/parallax; or CSS `repeating-linear-gradient` if static. WebGL only if you layer glow/shader noise.
- Frame container + `@fontsource/jetbrains-mono` for all labels/ticks.

## Version Compatibility

| Package | Version | Requires / Notes |
|---|---|---|
| next | 15.5.20 | React 19; App Router; Node 18.18+ / 20+ |
| react / react-dom | 19.2.7 | Peer for vis.gl 1.9 (`^19`) and Convex 1.42 |
| @vis.gl/react-google-maps | 1.9.0 | react ≥16.8 \|\| 19; bundles js-api-loader ^2.0.2, @types/google.maps ^3.64 |
| convex | 1.42.1 | React 18/19; ships `convex/react`, codegen; works with Next 15 App Router |
| @convex-dev/workos | latest | convex ≥1.4x + @workos-inc/authkit-nextjs ≥4 |
| @workos-inc/authkit-nextjs | 4.2.0 | Next 15 App Router middleware + `withAuth()`; Node runtime for middleware |
| gsap | 3.15.0 | All plugins free (≥3.13); use `@gsap/react` `useGSAP` for React 19 |
| @sentry/nextjs | 10.63.0 | Next 15 instrumentation hook; `withSentryConfig` in `next.config` |
| tailwindcss | 4.3.2 | CSS-first `@theme`; Shadcn CLI v4-aware |
| @googlemaps/markerclusterer | 2.6.2 | Works with AdvancedMarkerElement |
| @turf/turf | 7.2.0 | ESM; tree-shake `@turf/along`, `@turf/bearing` |

## Sources

- npm registry `registry.npmjs.org/<pkg>/latest` — live version data for all packages, fetched 2026-07-06 (HIGH)
- @vis.gl/react-google-maps GitHub + docs (visgl.github.io/react-google-maps) — API surface, hooks, React 19 support (HIGH)
- Google Maps Platform docs — Polyline symbols/`icons` animation, AdvancedMarkerElement, deprecation of `Marker`, version channels (HIGH)
- Convex docs — Next.js App Router + `ConvexProviderWithAuth`, WorkOS integration (`@convex-dev/workos`) (HIGH)
- WorkOS AuthKit Next.js SDK docs — middleware + `withAuth()` (HIGH)
- GSAP docs / Webflow announcement — full plugin suite free since v3.13; `@gsap/react` `useGSAP` (HIGH)
- Sentry Next.js SDK v10 docs — instrumentation-hook setup, wizard (HIGH)
- Deck.gl TripsLayer docs — considered-alternative scaling rationale (MEDIUM)

---
*Stack research for: Freight-flow geospatial visualization*
*Researched: 2026-07-06*
