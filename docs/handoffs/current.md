# Project Handoff — FleetVolt.Network Desktop

**Date:** 2026-07-12 16:05 PT
**Owner lane:** cw-codex
**Delivery rule:** dedicated branch and pull request only; never commit, push, or merge directly to the default branch

## Current objective

Make the CaaS desktop path honest, stable, and visually reviewable for the Monday demo. Fleet Manager is secondary and begins only if the CaaS acceptance path passes. Tablet/mobile implementation is owned by FleetVolt.Network Mobile/Tablet Design and is not a desktop release gate.

## Production architecture

- Next.js web application
- Convex data and compute
- Google Maps/Routes for map and road geometry
- Vercel preview/production hosting
- WorkOS authentication

Docker, PostGIS, Valhalla, Fastify, Python services, and the former Freight Pulse milestone are historical context only.

## Resume here

1. Continue on the existing non-default PR branch; verify `git status` before staging anything.
2. Finish and test the dataset-filter repair: controls must change visible assets, POI/amenity filtering must work, first use defaults supported sets on, and the last profile must restore.
3. Run the exact CaaS acceptance path: authenticated CaaS → Energy Forward/POLB to Shafter → road geometry → filter interaction → GAP marker/card → Executive Briefing demo.
4. Capture local visual evidence only after the focused automated checks pass.
5. Hand the localhost or preview URL to Chris at the physical visual gate.

## Known release blockers

- Local WorkOS entry is canonicalized before PKCE cookie creation, and the callback derives its final redirect from the browser-facing host. Verified flow: `127.0.0.1:3100` entry → WorkOS → `localhost:3100/caas`.
- Google Maps now loads successfully at `http://localhost:3100/caas`; a fresh authenticated browser check rendered the full vector map and markers with zero console errors. The workbench also installs `gm_authFailure` before loading Maps so any future key rejection renders an actionable fallback instead of crashing Advanced Marker with `getRootNode`.
- Convex authentication is synchronized and live-verified on `sensible-oriole-832`: issuer `client_01KX0RP6HZNMC4A2JQ4XQV3KKP`, audience/application `client_01KX0S9KEV1QKMBEYCVKBSJWWQ`, and the application JWKS now validate the active WorkOS token. A fresh authenticated CaaS load produced no Convex authentication errors.
- Air District and County currently use centroid/bounding-box fallbacks, not authoritative clickable polygons; automatic Air District → County → ZIP filtering is incomplete.
- Route focus uses approximately 0.5-mile geometric proximity, not the approved maximum 10-mile road-detour rule.
- Charger markers do not yet implement red/yellow/green Class-7/8/trailer validation states.
- GAP candidates contain modeled fallback arrival-SoC/dwell/power claims and must be labeled modeled until route-energy calculations drive them.
- Workbench result/export controls include visibly enabled actions without handlers.
- The public Executive Briefing is a static demo; the simulation export is a separate template and live Google map capture currently returns unavailable.
- The canonical POLB → Shafter CaaS path lacks complete end-to-end coverage.

## Honest demo boundary

The Monday demo may show the public briefing only with a page-level `DEMO / MODELED` disclosure. Do not claim that the downloadable production Executive Briefing, authoritative district polygons, road-detour filtering, or verified carrier targeting are complete.

## Linear reconciliation

- FLE-5: primary CaaS desktop delivery path.
- FLE-9: canonical Monday demo rehearsal and evidence.
- FLE-18: authoritative geo hierarchy, route scoping, 10-mile road-detour inclusion, charger trust states, and blocking Apply/Calculate loader.
- FLE-36: POI/filter binding, persistence, and helper explanations.
- FLE-37: Executive Briefing HTML/download design and parity decision gate.
- FLE-7: report/export implementation after FLE-37 decisions.
- FLE-33: Fleet Manager Alpha, secondary priority.
- FLE-34: recovery audit/control issue; retain UI defects and canonical test receipt.

## Required report decisions before FLE-7

Chris must approve one canonical report renderer/schema, PDF behavior, map-render method, synthetic-data policy, carrier ranking contract, access model, accessibility/print gate, parity test, and legacy export retirement. Until then, the static briefing and production export are separate products.

## Physical gates

- Google Maps and Convex authentication have both passed in the user-controlled Chrome session. Continue with the canonical POLB → Shafter interaction and visual acceptance gate.
- Desktop visual review at the approved viewport.
- Chris review of a localhost or preview link after internal review passes.
- Linear ledger synchronization from an authorized in-harness connector; do not use a CLI/API workaround.
