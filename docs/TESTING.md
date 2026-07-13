# FleetVolt — External Testing Guide

**Production:** https://fleetvolt.network  
**Status (2026-07-09):** Live on Vercel + Convex. Maps apex referrer fixed. Workbench soft-fails if Maps auth fails.

## Who can test

Anyone with a WorkOS-invited login (or existing CleverWork account wired to FleetVolt). Unauthenticated visitors see the welcome page and must **Get Started** → role select → sign in.

## Tester path (15 minutes)

1. Open https://fleetvolt.network and click **Get Started**.
2. Pick a role (**Driver**, **Fleet Manager**, or **CaaS**).
3. Sign in when prompted.
4. From the role dashboard, use the primary CTA:
   - Driver → **Start Day Plan**
   - Fleet → **Plan Contract**
   - CaaS → **Find Charger Gaps**
5. Confirm the workbench is map-first (left tool rail + full-bleed map).
6. Set origin/destination (e.g. Port of Long Beach → Barstow) and run **Calculate**.
7. Confirm result cards show assumptions (not a prose wall) and map pins update.

Optional: browse https://fleetvolt.network/catalog for HVIP EPA truck cards (public).

## What “good” looks like

| Surface | Pass criteria |
|---------|----------------|
| Welcome | Loads; one primary Get Started CTA |
| Driver workbench | Map + tool rail; Calculate → route + charge/feasibility cards |
| Fleet workbench | Contract inputs; Calculate → trucks/drivers/charging/gap cards with assumption labels |
| CaaS workbench | US/opportunity framing; deferred drilldowns labeled, not crashing |
| Map | Google tiles load on `fleetvolt.network` (hard-refresh if you hit an older cached error) |
| Failures | Honest “unavailable” / labeled assumptions — never a blank white-screen for Maps issues |

## CaaS freight overview (road-traced corridors)

On `/caas` (freight overview phase):

1. Map frames full California (San Diego → Crescent City). Dotted corridors follow roads after rebuild.
2. **Pulse:** heavy truck AADT = slow red dash; light = fast green dash.
3. **Geo boundaries:** Air districts → Counties → ZIP (red/yellow/green; fill opacity ≤50%).
4. Toggle **chargers / parking / carriers** in Full map suite — they load on the overview.
5. Click a region, port, or generator → popup includes **See carriers in this region**.
6. **Energy Forward ZE** cards: Long Beach → Shafter and Long Beach → Otay/Tijuana (60-truck interim + US/MX capacity questions).
7. Corridor compare (Both / I-15 / I-40) still filters POLB→Vegas dual paths.

Operator rebuild (dev):

```bash
python3 data/ingest/caltrans/prep_traffic_generators.py
node scripts/generators_load.mjs
# requires GOOGLE_MAPS_API_KEY on Convex:
npx convex run faf/buildCorridors:run
# optional — only ZE corridors:
npx convex run faf/buildCorridors:run '{"corridorKeys":["polb-shafter-ze","polb-tijuana-ze","oak-crescent-city-us101","sd-la-i5"]}'
```

## Known follow-ups (not blockers for first testers)

- Air-district / ZIP choropleth uses county bbox unions until true CARB / ZCTA polygons are ingested
- Generator→port spokes are straight (road-trace deferred); statewide generator coverage depends on CalTrans ingest
- Parking/POI corridor density thinner than chargers
- Catalog OEM alias (Daimler vs Freightliner) for some physics truck links
- AI command bar may use client fallback until `OPENAI_API_KEY` is set on Convex prod
- I-40 east of CA has thinner CalTrans AADT samples (CA postmiles only)
- Mexico-side charger inventory for Tijuana is assumption-labeled until verified sources land

## Report bugs

Include: role, URL, steps, screenshot, and console errors (especially any `RefererNotAllowedMapError` or `Something went wrong`).

## Operator smoke (no login)

```bash
curl -s https://fleetvolt.network/health
# expect: {"status":"ok",...,"services":{"convex":true,"googleMaps":true}}
```

Protected routes redirect unauthenticated users to `/?redirect=…`.
