---
name: fleetvolt-route-report
description: Generate, revise, or audit any FleetVolt corridor, route, executive briefing, white paper, downloadable report, HTML report, or PDF report. Use whenever FleetVolt route evidence becomes a reader-facing report, through the application or Codex interface. Enforces the locked Command Brief narrative, Corridor White Paper design, evidence labels, equal-work diesel-versus-BEV comparison, carrier-table rules, and page-by-page visual QA.
---

# FleetVolt Route Report

Use FleetVolt Route Report Standard v1.0.0. Do not improvise another narrative or visual system.

## Required reference

Read [report-standard.md](references/report-standard.md) before writing or editing. Use the reference HTML, PDF, and contact sheet in `assets/` as the visual source of truth.

## Workflow

1. Build an evidence manifest. Record source, date, unit, geography, direction, and `VERIFIED`, `MODELED`, `ASSUMPTION`, `SOURCE`, `GATE`, or `OPEN` status.
2. Mark missing facts `Not verified` or `Research required`. Never invent values, contacts, field observations, route use, or charger capability.
3. Draft in the locked sequence: board answer; executive finding; corridor evidence; vehicle and energy; charging; emissions; origin prospects; destination prospects; commercial interpretation; method/limitations/authorization.
4. Compare a standard diesel Class-8 tractor with the modeled BEV over equal work and equal distance. State inputs, boundary, factors, exclusions, and avoided operational emissions.
5. Render origin and destination prospects as separate ruled tables. Include tractors, website, contact, phone, and email only when verified. Proximity is not route-use proof.
6. Apply the Corridor White Paper visual system and FleetVolt paper logo.
7. Produce complete HTML and PDF artifacts and embed the standard version.
8. Render every PDF page and visually inspect full pages and readable zoom.

## Release gate

Reject the report if a material number lacks evidence; work/distance or emissions boundaries differ without disclosure; a missing value is hidden; proximity is represented as route use; content clips, collides, overflows, or disappears; route labels are obscured; table rules are missing; whitespace looks unfinished; or a page was not rendered and inspected.

## Change control

Do not silently change this protocol. Preserve v1 and propose a versioned amendment when a requested output conflicts with it.
