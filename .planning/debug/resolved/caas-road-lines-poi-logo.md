---
status: resolved
trigger: "CaaS route lines do not follow actual roads; traffic-generator POIs render as small red dots; logo bolt should rotate only once per minute while the ring continues."
created: 2026-07-11
updated: 2026-07-11
---

# CaaS road lines, POI sizing, and logo cadence

## Symptoms

- Expected: every route-like line follows road geometry; all POI icons use the same visual footprint as the normalized marker system; the bolt rotates once per minute.
- Actual: red dashed generator spokes were straight point-to-point lines, traffic-generator POIs were tiny red dots, and the bolt rotated continuously once per second.
- Reproduction: open `/caas`, zoom into POLB/Wilmington, inspect red dashed lines and generator points; observe the FleetVolt bolt.

## Current Focus

- hypothesis: confirmed and repaired.
- test: Docker production build plus browser visual verification.
- expecting: no endpoint-pair spokes; no detour fallback without road geometry; 36px labeled POI controls in 44px footprints; one one-second bolt rotation per 60-second cycle.
- next_action: none.

## Evidence

- 2026-07-11: `listWithPortSpokes` returned only port/generator endpoints and explicitly described road tracing as deferred.
- 2026-07-11: `GeneratorSpokesLayer` built `google.maps.Polyline` objects directly from those two endpoints.
- 2026-07-11: both generator marker components used `h-2.5 w-2.5` (10px) buttons rather than the shared 36px marker treatment.
- 2026-07-11: `DetourLegsLayer` constructed straight fallback coordinates when routing returned fewer than two points or threw.
- 2026-07-11: both logo SVGs and the loader CSS used a one-second infinite bolt rotation.
- 2026-07-11: rebuilt Docker image passed Next production compilation and container health.
- 2026-07-11: browser rendered 69 traffic-generator POIs; sampled control measured 36px high, labeled `POI`; visual screenshot showed road-traced freight flow with endpoint spokes absent.

## Eliminated

- hypothesis: the red dashed lines were the validated A→B route layer. Evidence: they came from the separate generator-spoke layer and never used routing geometry.

## Resolution

- root_cause: three independent render paths bypassed the intended visual contract—generator association spokes used raw endpoints, detour legs retained a straight fallback, and generator POIs used bespoke 10px dots. Logo timing was embedded independently in both SVG assets and loader CSS.
- fix: removed generator association polylines; made detour rendering fail closed unless at least eight road points exist; standardized generator POIs to labeled 36px sky-blue controls in 44px footprints; changed bolt animation to a one-second rotation followed by a hold within a 60-second cycle while retaining the 1.2-second ring.
- verification: ESLint pass; route-proximity tests pass; Docker production build pass; container healthy; browser marker measurement and screenshot pass.
- files_changed: generator-spokes-layer.tsx, generator-markers.tsx, detour-legs-layer.tsx, globals.css, fleetvolt-logo-horizontal-light.svg, fleetvolt-logo-vertical-light.svg.

