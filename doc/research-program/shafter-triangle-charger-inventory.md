---
type: research-plan
title: Shafter Triangle Class-8 charger inventory — verifiable ground truth
author: cw-cowork (autopilot crew, gap analysis)
date: "2026-07-10"
status: queued
tags: [research-plan, shafter-triangle, chargers, afdc, demo]
---

# Shafter Triangle Class-8 charger inventory

## Gap (why this would fail under scrutiny)

The Monday demo (see [[monday-demo-script]], Beat 2/3) claims "every charger on the route" and "real inventory" at the hotspot, and the genesis vision ([[genesis-fleetvolt]]) sets the law that every rendered feature must open its provenance. The vault currently holds NO independent, citable inventory of DC fast chargers with Class-8 access along the triangle's three legs. If an Energy Forward engineer clicks a charger card and the underlying record is wrong or stale, the demo's credibility fails. FLE-4 tests whether OUR data can produce the report; this plan builds the external ground truth to check it against.

## Objective (falsifiable)

Produce a complete, citable list of public DC fast-charging stations (≥150 kW, with a flagged ≥350 kW subset) within 5 road-miles of each corridor leg — Shafter→Long Beach (CA-99/I-5/I-710), Long Beach→Ontario (I-710/SR-60), Ontario→Shafter (I-15/CA-58/CA-99) — each record carrying: station ID, operator, max power, connector types, port count, and a Class-8 accessibility assessment (pull-through/drive-in clearance where determinable).

## Named sources

- DOE Alternative Fuels Data Center (AFDC) Station Locator API (developer.nrel.gov) — primary
- NEVI/AFC corridor designations (FHWA Alternative Fuel Corridors, Round 1–8 tables)
- Operator networks for Class-8 specifics: Tesla Semi Charger sites, WattEV, Forum Mobility, Greenlane (public site data / press releases, dated)
- CEC (California Energy Commission) EV charger station data where AFDC lags

## Done-when

A report exists in `output/` containing the per-leg station table with every row citing its source + retrieval date, a count of ≥350 kW Class-8-capable sites per leg (explicitly zero if zero — that IS the demo's punchline), and a delta section comparing this external inventory against what FleetVolt's wired data currently renders. Plan status flipped to complete with a wikilink to the report.
