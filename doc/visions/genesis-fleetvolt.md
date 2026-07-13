---
type: vision
title: Genesis — FleetVolt (CEO interview)
author: cw-cowork (Agent Boss) ← Chris Hussey (CEO)
date: "2026-07-10"
status: canonical
tags: [genesis, vision, fleetvolt, dev-engine, shafter-triangle]
---

# Genesis — FleetVolt

**Read this before touching the product.** Source: CEO vision interview (voice + text), 2026-07-10, 4:00 PM. The CEO's opening words about the current build: *"we got misaligned during development, and now it's almost unworkable for me."* Re-alignment to THIS document is the mandate.

## Structure
Cleverwork is a 1099/retained asset of Zero Emission Advisors. FleetVolt is a **ZEA consulting weapon built by Cleverwork** — its users are ZEA's clients (public entities, large logistics companies, infrastructure providers). It borrows ZEA's credibility; its knowledge cross-pollinates with the Energy Forward vault.

## Thesis
A diesel Class-8 refuels every quarter-mile of the US highway system; the EV truck market has nothing comparable. With ~120,000 Tesla Semis on order, a logistics catastrophe is scheduled. **Nobody has the planning layer** that identifies hotspot gaps in charging, parking, and supporting infrastructure BEFORE the trucks arrive. FleetVolt is that layer. PTV chosen deliberately (best routing/emissions math).

## The architecture law: ONE workbench, filtered
Not three products. One truth layer with three zoom levels — the same engine, filtered per persona:
1. **The Hunter (PRIMARY — infrastructure providers: power, solar, batteries, CaaS).** First login → rich data instantly: US map, state red/yellow/green EV-freight readiness. Drill by geography layers — **state → air district → county → zip** — each with metadata (freight through-flow, Class-8-qualified chargers, traffic counts, hot zones, AFC corridor status). Then: top routes out of a port (target: top-50 per port), truck profile × driver profile × load profile → where trucks WILL need charge → the siting opportunity (where to put solar, batteries, chargers). "Show me the SCAQMD zone, the freight flows, the gaps, and where I fill them."
2. **Fleet manager (filter 2).** Build fleet (trucks) + driver profiles; assign truck + driver to route; answer: "new contract — how many trucks, can they charge en route, is it economic, what do I bid?"
3. **Driver (filter 3).** One load: Oakland→Barstow. Route, Class-8 chargers, detour distance, and **actual fully-laden performance — never EPA fiction** — from load profile (weight distribution) × driver profile (the guy who blasts AC with windows up).

**Audit question for the current build:** was route/energy/gap logic built ONCE and filtered (vision) or three times diverging (drift)? That answer defines the re-alignment scope.

## The Shafter Triangle — canonical acceptance scenario (real client)
Client: **Energy Forward** (mobile battery supplier, vertically integrated — owns solar farm; their vault is our ZEA knowledge base). Their client won a contract hauling Wonderful Co freight **Shafter → Long Beach (export)** with Tesla Class-8s; realistic cycle continues **Long Beach → Ontario (SCAQMD drop) → Shafter**. Energy Forward is evaluating land in Shafter for solar — but the truck leaves Shafter FULL, so the battery likely belongs elsewhere. The workbench must answer:
1. Where are the Class-8 charger gaps on the triangle (all three legs, fully-laden physics)?
2. Where will the Tesla Semi require charge — under battery-preferred discipline (charge to ~80%, never below 10–20%)?
3. What charging infrastructure exists at those need-points today?
4. **Therefore: where should Energy Forward's mobile battery be positioned?**
5. What does the charging plan do to trips-per-day (driver/fleet economics)?

**The bar (CEO's words):** first, demonstrate that OUR DATA can produce this report at all; then CEO + Agent Boss design its visualization in the workbench. Data-report-first, UI second.

## The "unworkable" indictment (CEO, verbatim substance — the re-alignment work order)
Current state: the map is a pretty picture. A weird orange square around California; no SCAQMD/air-district layer, no county layer, no zip layer; freight lines render but aren't clickable; endpoints and moving dotted lines reference nothing; ports (Long Beach, LA, Oakland, Hueneme) aren't clickable POIs exposing their truck parking, fleet parking, and chargers; the sidebar is crammed and cognitively overwhelming. Net effect: *"I show up and I can't do anything… I just don't want to look at it anymore."*

**The UX law this writes (binding on all FleetVolt work): NO PIXEL WITHOUT PROVENANCE.** Everything rendered must be clickable and must explain itself — every line, point, boundary, and badge opens the data it references. Geographic boundary layers (state / air district / county / zip) are first-class, toggleable, and each click yields that geography's metadata card (freight through-flow, qualified chargers, traffic, hot-zone status). Ports are asset-rich POIs. The sidebar shrinks to navigation + context of the current selection — the MAP is the interface; the story lives in the layers (genesis §architecture). Executed-check translation: Playwright walkthroughs assert click→data-card for every rendered feature class.

## The five-minute demo bar (CEO, verbatim substance)
Click **Port of LA → Shafter**. Click **"AI plan route."** The workbench draws the dotted route, marks every charger, marks every required detour, drops the **hotspot where the truck will run out of charge**, then serves the charge-event card: what infrastructure is available there, what NEEDS to be there, what planning is required — **and which carriers run that corridor, so outreach can target them.** Five minutes, unassisted, in front of an infrastructure-planning committee.

**Note the last beat: the demo ends in a sales list.** FleetVolt's terminal output for the hunter isn't analysis — it's *targets* (carriers to sign, sites to acquire). Same pattern as the EHSMatch outreach engine: intelligence → segmented outreach. The carrier-identification layer (FAF flows + port data → who hauls this corridor) is therefore product-critical, not nice-to-have, and its natural export destination is GHL.

## Known data gaps vs this scenario
Current wired data = FAF zone 061 (LA–Long Beach) only. Shafter is Kern County → needs additional FAF zone ingestion + Kern-corridor data (note: the ZEA Kern curtailment research program and Energy Forward vault hold relevant Kern grid/solar context — cross-vault synergy, use it).

## Metrics & priorities
Sprint 1 = Stabilization + Truth: (1) preserve the dirty working tree, (2) Shafter Triangle data-feasibility report, (3) re-alignment audit (one-engine-filtered check), (4) UAT closure rides behind the triangle test — if the workbench can answer Energy Forward's question, UAT Test 4 is trivially satisfiable. FAF beyond the triangle's needs stays cold storage until the hunter journey demands it.
