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

## Known follow-ups (not blockers for first testers)

- Parking/POI corridor density thinner than chargers
- Catalog OEM alias (Daimler vs Freightliner) for some physics truck links
- AI command bar may use client fallback until `OPENAI_API_KEY` is set on Convex prod

## Report bugs

Include: role, URL, steps, screenshot, and console errors (especially any `RefererNotAllowedMapError` or `Something went wrong`).

## Operator smoke (no login)

```bash
curl -s https://fleetvolt.network/health
# expect: {"status":"ok",...,"services":{"convex":true,"googleMaps":true}}
```

Protected routes redirect unauthenticated users to `/?redirect=…`.
