# Phase 17 Context — Role-Based Map Workbench

## Source of Truth

See `.planning/research/ROLE-MAP-WORKBENCH-INTERVIEW.md` for Chris's live product feedback. This is the locked product intent for Phase 17.

## Core Correction

The design language is good. The product interaction model is wrong.

Dashboards are launchpads. The real product surface is a full-viewport map workbench.

## Role Workflows

### Driver — Day Planner

Driver pre-plans tomorrow:
- route A → B
- round trips target
- truck/profile/workday constraints

FleetVolt outputs:
- feasible or not
- charging locations
- Class 8 + trailer-friendly chargers
- detours if no charger on-route
- site access guidance

### Fleet Manager — Contract Planner

Fleet manager plans new contract:
- port A → inland destination
- date/schedule
- containers/day
- gate hours, dwell, shift length, yard return

FleetVolt outputs:
- trucks required
- drivers required
- charge events
- charging downtime
- route amenities
- true gaps
- mobile CaaS support points/times

### CaaS — Gap / Opportunity Map

CaaS user clicks a location/port and chooses destination. FleetVolt outputs:
- route-based Class 8 charger gaps
- true gaps vs detour-solvable gaps
- target fleets/carriers
- mobile charging asset positioning
- demand by route/time

## Workbench Requirements

- Full-viewport map/work surface
- Left planning toolbar
- Right/slide-out metadata cards
- Google Maps-style route interaction
- Autocomplete for addresses/ports/yards/chargers
- Clickable assets: ports, chargers, carriers, yards, parking, amenities
- Map layers: freight flow, charger coverage, Class 8 gaps, dwell/parking, carriers, air districts, census/zip/county
- AI translates intent into map actions and overlays, not prose walls

## Viewport Rule

Desktop: use the entire viewport; map dominates; panels scale with available screen area.
Mobile: collapse tools to bottom sheet/stepper; show only necessary controls.

## Existing Foundations

- Phase 16: auth boundary, role nav, dashboards, app shell
- Google Maps app-wide migration exists from Phase 11
- Convex data layers: chargers, carriers, trucks, parking, POIs, highways, FAF, geoRegions
- Physics actions from Phase 13
- AI planner action from Phase 15/16
- Truck configs enriched with OEM + Street + HVIP + CARB data

## Non-Goals

- Do not create another centered card report as primary UX
- Do not output long AI prose without map/result-card translation
- Do not ask users to know raw DB names or internal data model
