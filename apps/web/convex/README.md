# FleetVolt Convex Backend (Phase 7)

Reactive data layer for the `/pulse` Freight Pulse surface. Provenance-tagged
multi-source freight data + anonymous view state.

## Dependency audit (T-07-SC)

All net-new npm dependencies for Phase 7 are installed **once** in Wave 0
(this plan, `apps/web`) so downstream map/ingest waves never install packages —
a single reviewable supply-chain trust point. Versions pinned exactly. Download
counts are npm last-month figures from `07-RESEARCH.md § Package Legitimacy Audit`
(fetched 2026-07-06); all first-party or foundation-maintained, no typosquats.

| Package | Resolved | Downloads/mo | Verdict |
|---|---|---|---|
| `convex` | 1.42.1 | 3,677,297 | ✅ First-party (Convex Inc.); client + React bindings + codegen |
| `@vis.gl/react-google-maps` | 1.9.0 | 7,782,691 | ✅ vis.gl/OpenJS + Google-team maintained |
| `gsap` | 3.15.0 | 15,212,003 | ✅ Webflow-owned; all plugins free ≥3.13 |
| `@gsap/react` | 2.1.2 | 4,206,910 | ✅ Official GSAP React adapter |
| `simplify-js` | 1.2.4 | 613,909 | ✅ mourner (Leaflet author); stable/low-churn |
| `@types/google.maps` (dev) | 3.65.2 | (DefinitelyTyped) | ✅ Bundled transitively by @vis.gl; pinned for editor types |

`@turf/turf` 7.3.5 was already installed (kept, no change). `@fontsource/jetbrains-mono`
was intentionally NOT added — JetBrains Mono already loads via `next/font/google`
in `layout.tsx`. No peer-dependency errors reported against React 19.2.7.
