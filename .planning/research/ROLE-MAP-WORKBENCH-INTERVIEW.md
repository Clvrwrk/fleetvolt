# FleetVolt Role-Based Map Workbench — Product Interview Notes

**Date:** 2026-07-08  
**Source:** Chris live product feedback after Phase 16 UX navigation overhaul  

## Core Correction

The Technical Brand Geometry design language is good, but the product interaction model must shift from centered cards/walls of text to a role-specific map workbench experience.

The dashboard is not the primary work surface. The dashboard is a **launcher**.

Each role dashboard should summarize the user’s context and give one obvious planning action:

- Driver → Start Day Plan
- Fleet Manager → Plan Contract
- CaaS → Find Charger Gaps / Start Opportunity Analysis

After the user starts planning, the app should use the full viewport as a Google Maps-style / GIS-style workbench.

## Driver Job-to-be-Done

**Primary job:** Pre-plan tomorrow’s driving day.

Driver inputs:
- Route A → B
- Number of round trips they want/need to complete
- Truck / driver profile / workday constraints

FleetVolt answers:
- Can the driver complete the planned day?
- Where will they need to charge?
- Which chargers are Class 8 + trailer friendly?
- If no Class 8-friendly charger exists on-route:
  - show detour routes
  - show nearest viable Class 8 charger
  - show how to get in/out of that charging area
- Give the driver pre-day confidence: charge locations, site access, risk.

## Fleet Manager Job-to-be-Done

**Primary job:** Plan a new freight contract.

Fleet manager inputs:
- Contract route: Port A → inland destination
- Date / schedule
- Required volume, e.g. 3 containers/day
- Workday assumptions: gate hours, dwell, 10-hour shift, yard return, driver constraints

FleetVolt answers:
- How many trucks are required?
- How many drivers are required?
- How many charge events occur?
- Where do trucks charge?
- Are Class 8-friendly chargers available on-route?
- What amenities exist along the route:
  - chargers
  - rest stops
  - parking
  - food/fuel/driver amenities
- If no good charger exists:
  - nearest viable detour charger
  - or true gap
  - recommend mobile CaaS support at specific locations/times
- Show whether the contract can be satisfied operationally.

## CaaS Job-to-be-Done

**Primary job:** Find charger gaps and target fleets/opportunities.

CaaS user quickly:
- clicks a port or location
- chooses/asks “where do you want to go from here?”
- receives route-based Class 8 charging gap analysis

FleetVolt shows:
- where there are no Class 8-friendly chargers
- which gaps are true gaps vs detour-solvable
- which fleets/carriers to target
- where mobile charging assets should be pre-positioned
- where charging demand will occur by route and time

## Required Workbench Experience

The workbench should feel like Google Maps + logistics command center:

- full-screen map/work surface
- left planning toolbar
- contextual overlays
- right/slide-out metadata cards
- route building from real addresses / ports / yards / chargers
- autocomplete everywhere
- click assets on the map to open high-level metadata cards
- route overlays colored by severity / freight volume / charging feasibility

## Required APIs / Data Fusion

The user should not need to know our database structure. The app should use APIs and lookups to help them build a plan naturally:

- Google Places Autocomplete / Geocoding
- Google Maps route display and route editing affordances
- PTV APIs for truck-aware route feasibility where needed
- Census APIs for geographic context
- Convex data layers:
  - chargers
  - carriers
  - truck configs
  - parking
  - POIs/amenities
  - highways / truck flow
  - FAF freight flow
  - geoRegions / air districts / zip codes
- Class 8 trailer-friendly charger classification
- Detour generation
- Mobile charging recommendation when true gap exists

## Viewport Rule

Desktop:
- maximize the work surface
- map dominates the viewport
- toolbars/panels use available screen area
- avoid small centered cards except for dialogs

Mobile:
- show only necessary tools to get a plan going
- map still matters, but controls collapse to bottom sheet / step flow

## Product Principle

FleetVolt should make planning feel interactive, spatial, and obvious:

Dashboard → one role-specific planning CTA → full-viewport map workbench → data-backed route/gap/asset decisions.

No more walls of text as primary output. AI should translate user intent into map actions, overlays, structured plans, and explainable result cards.
