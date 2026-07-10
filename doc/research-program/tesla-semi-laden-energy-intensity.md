---
type: research-plan
title: Tesla Semi fully-laden energy intensity — source-backed physics inputs
author: cw-cowork (autopilot crew, gap analysis)
date: "2026-07-10"
status: queued
tags: [research-plan, tesla-semi, physics, energy-intensity, demo]
---

# Tesla Semi fully-laden energy intensity

## Gap (why this would fail under scrutiny)

The genesis vision ([[genesis-fleetvolt]]) demands "actual fully-laden performance — never EPA fiction," and the demo places a hotspot "where a fully-laden Semi, driver running cold-cab, hits its charge floor" ([[monday-demo-script]]). The demo rules say numbers spoken aloud must survive an engineer audience. The vault holds no citable source for the laden kWh/mi assumption driving hotspot placement, nor for usable pack capacity under 20–80% discipline. That single unsourced number is the highest-leverage attack surface in the whole demo.

## Objective (falsifiable)

Establish a defensible kWh/mi range for a Tesla Semi at or near max GCW (~82,000 lbs) with published evidence: central estimate, spread, and the three biggest sensitivity drivers (grade — Grapevine on I-5 matters for this exact corridor, ambient/HVAC, driver behavior), plus usable-energy math under a 10/20%-floor–80%-ceiling discipline.

## Named sources

- NACFE Run on Less — Electric DEPOT (2023): PepsiCo Sacramento Tesla Semi telemetry (public dashboards + final report)
- PepsiCo/Tesla public statements on Semi range and consumption (dated primary quotes)
- DOE/NREL heavy-duty BEV studies (e.g., NREL fleet electrification reports)
- Tesla Semi spec claims (semi page / investor materials) — recorded as manufacturer claims, kept distinct from measured data

## Done-when

A report exists in `output/` giving: cited laden kWh/mi central value + range, usable kWh between charge floor and 80% ceiling, resulting laden range figure(s), and an explicit comparison table (measured vs manufacturer-claimed), every number footnoted to a named source with date. The plan's number set is adopted (or explicitly rejected with reasons) as the workbench's physics provenance card for the Shafter Triangle. Plan status flipped to complete with a wikilink to the report.
