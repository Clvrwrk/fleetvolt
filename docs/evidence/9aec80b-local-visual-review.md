# Local visual review — `9aec80b`

Review URL: `http://localhost:3000/api/review-session?next=/caas`

This evidence is local-only. ScreenshotOne receipts remain pending explicit approval to transmit the unpublished FleetVolt images to the external service.

## Road geometry + layer controls + marker sizing

Screenshot: `/Users/chussey/.codex/visualizations/2026/07/11/019f52c6-d57b-7c73-b2a3-0d6b979369b6/fleetvolt-polb-barstow-road-snapped.png`

- Fix: routes with fewer than eight road points are not drawn; PTV failure falls back to Google road geometry when available.
- Fix: non-road-traced freight arcs are suppressed.
- Fix: every role starts with all icon sets enabled; rail toggles persist each role's last profile in local storage.
- Fix: POI, charger, parking, carrier, yard, and highway markers share a 36px marker height.
- Agent result: PASS — POLB → Barstow reported `Road-snapped` and rendered 800 PTV road points.
- Chris review: select each quick corridor and confirm the line stays on streets/highways; toggle Amenities off, reload, confirm it remains off, then restore it.

## Route-focus planning state + card close

Screenshot: `/Users/chussey/.codex/visualizations/2026/07/11/019f52c6-d57b-7c73-b2a3-0d6b979369b6/fleetvolt-route-focus-repaired.png`

- Fix: selecting `Focus this route` hides ports, freight flows, region overlays, and assets farther than 800m from the route.
- Fix: every selected-asset card has a visible Close button; double-click dismissal remains available.
- Agent result: PASS — marker count fell from 1,206 to 47 route-related assets, port anchors fell to zero, and Close restored the full map.
- Chris review: click `Focus this route`, inspect the route card, use its Close button, then repeat using double-click.

## Fleet Manager route bootstrap

Screenshot: `/Users/chussey/.codex/visualizations/2026/07/11/019f52c6-d57b-7c73-b2a3-0d6b979369b6/fleetvolt-fleet-road-snapped-repaired.png`

- Fix: centralized mode reset before corridor bootstrap, removing the race that cleared Fleet origin/destination.
- Fix: removed the Fleet sample straight line; the map stays in an honest loading state until road geometry exists.
- Agent result: PASS — Fleet Manager reported `Road-snapped · 797 pts` and the line followed the road network.
- Chris review: open Fleet Manager, confirm the route loads without a crow-flies preview, then choose another quick corridor.

## Loading signature

- Fix: the light logo now keeps its blue bolt and adds a blue tracer on the pale instrumentation ring.
- Fix: map, AI-command, place-search, and plan-calculation delays use the pulsing/rotating FleetVolt bolt loader; reduced-motion users receive a static mark.
- Agent result: PASS — the animated mark rendered in the rail and map loading state without horizontal overflow.
- Chris review: hard refresh once and assess the one-second bolt rotation; confirm it feels intentional rather than distracting.

