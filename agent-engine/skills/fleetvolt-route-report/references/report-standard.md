# FleetVolt Route Report Standard v1.0.0

Protocol: **Command Brief narrative / Corridor White Paper design**. Status: **LOCKED**.

## Ten-part sequence

1. Cover and board answer
2. Executive finding
3. Corridor evidence
4. Vehicle and energy model
5. Charging landscape
6. Operational emissions
7. Origin-side carrier prospects
8. Destination-side carrier prospects
9. Commercial interpretation
10. Method, limitations, and authorization

## Evidence rules

- Label material evidence `VERIFIED`, `MODELED`, `ASSUMPTION`, `SOURCE`, `GATE`, or `OPEN`.
- No fabricated values, contacts, route use, field observations, or charger capability.
- Use `Not verified` or `Research required` for missing data.
- Proximity is a prospecting signal, not proof a carrier uses the route.
- Every number must be traceable to an evidence manifest.

## Mandatory emissions analysis

Compare standard diesel and modeled battery-electric Class-8 tractors over equal work and equal distance. State distance/cycle, MPG and factor, kWh/mile, battery/reserve, charging efficiency, grid basis, per-trip results, annual/fleet scenario, boundary, and exclusions. Do not conflate tailpipe, grid-operational, well-to-wheel, and lifecycle values.

## Visual system

- Paper `#FBFAF5`; ink `#172330`; muted `#59636C`; blue `#176B87`; copper `#B75A3B`; green `#2B765D`; rules `#BFC4C2`; wash `#EEF1ED`.
- Editorial typography: Georgia/Times. Technical labels: Arcline/Arial.
- Paper logo: black FLEET, blue VOLT, blue bolt.
- Road-geometry route maps with visible endpoints.
- Fully ruled tables; never semicolon-delimited prospect prose.
- No clipping, overflow, footer collision, broken borders, or unfinished regions.

## Carrier tables

Separate origin and destination prospects. Columns: Carrier; City/proximity; Tractors; Website; Contact; Phone; Email; Verification/route-use gate. Populate only verified attributes; write `Not verified` otherwise.

## Required artifact QA

Generate HTML and PDF, render every PDF page, inspect each page at full-page and readable zoom, verify arithmetic/evidence, and record `fleetvolt-route-report-v1.0.0` in artifact metadata.
