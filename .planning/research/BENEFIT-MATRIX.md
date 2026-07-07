# FleetVolt Data Benefit / Enrichment Matrix

**Date:** 2026-07-07 · Companion to `DATA-INVENTORY.md`.

## Scoring method

Each artifact scored 0-3 on four axes, against the app's core value —
**modeling & visualizing freight movement OUT of the Port of Long Beach/LA and the
feasibility of electrifying those moves.**

- **REL** — Relevance to freight-out-of-port (0 none … 3 directly answers it)
- **UNIQ** — Uniqueness (0 trivially re-fetchable via API … 3 not available elsewhere)
- **READY** — Ingestion readiness (0 needs heavy processing … 3 clean/tabular now)
- **ENR** — Enrichment: does it make the app's output *more credible or more sellable*? (0 … 3)

**Verdict:** INGEST (Phase 12 priority) · SECONDARY (nice enrichment) · REFERENCE (docs/join only) · ARCHIVE (superseded/redundant).

| # | Artifact | REL | UNIQ | READY | ENR | Score/12 | Verdict | Why |
|---|---|---|---|---|---|---|---|---|
| 1 | **FAF5.7.1 master OD matrix** | 3 | 2 | 3 | 3 | **11** | **INGEST** | The freight-flow spine: origin 061→dest, mode, commodity, tons+value 2017-2050. Proven $1.3T / 395M truck-ktons out of the port. |
| 2 | **FAF5.7.1_2018-2024 actuals** | 3 | 2 | 3 | 3 | **11** | **INGEST** | Recent measured flows (not forecast blend) → "current" freight the demo shows. |
| 3 | **POLB drayage carrier registry** (xlsx, 3,151) | 3 | 3 | 3 | 3 | **12** | **INGEST** | Unique. Actual carriers hauling out of POLB → geocode to TAM/fleet-electrification targeting. No API equivalent. |
| 4 | **CalTrans Truck AADT by axle** (6,865 seg) | 3 | 2 | 3 | 3 | **11** | **INGEST** | Class-8 (5-axle) volumes per highway postmile → pulse-flow intensity + congestion weighting on real geometry. |
| 5 | **FAF Highway Assignment Results** (2017/2022/2050) | 3 | 2 | 1 | 3 | **9** | **INGEST** | Freight assigned to actual road links → map-accurate flow rendering. Heavier to parse (network+assignment). |
| 6 | **CalTrans Truck Volumes geo** (geojson/gdb/kml) | 3 | 2 | 3 | 2 | **10** | **INGEST** | Mappable geometry of #4 — drop straight onto the map. |
| 7 | **FAF CA County-to-County** (1.05M rows) | 3 | 2 | 2 | 2 | **9** | **INGEST** | County-granular CA flows; finer than zone level for last-mile/inland detail. |
| 8 | **FAF State Summary cuts** (Top10 Commodity, SCTG2, OD Pairs, Trading Partners) | 2 | 1 | 3 | 3 | **9** | **SECONDARY** | Pre-aggregated → cheap TAM/SAM/commodity overlays without touching 1 GB file. |
| 9 | **NATD Truck Stop Parking** (spots, lat/lon) | 2 | 2 | 3 | 2 | **9** | **SECONDARY** | Charging-siting + queue/parking hotspots (the solar-charger rec layer). Filter to CA. |
| 10 | **NATD Alt-Fuel Corridors** (EV/H2 signage) | 2 | 2 | 3 | 2 | **9** | **SECONDARY** | Alt-fuel corridor eligibility overlay; supports electrification-readiness story. |
| 11 | **CalTrans Hydrogen Fueling Network** | 1 | 2 | 3 | 2 | **8** | **SECONDARY** | Alt-fuel infra; H2 is a counter-scenario (per PROJECT.md v2 note), not core EV. |
| 12 | **FAF metadata codebook** (xlsx) | 3 | 1 | 3 | 1 | **8** | **REFERENCE** | Required to decode zones/modes/commodities. Ingest as lookup tables. |
| 13 | **CFS↔FAF zone crosswalk** (xlsx) | 2 | 1 | 3 | 1 | **7** | **REFERENCE** | Join key between CFS areas and FAF zones. |
| 14 | **Database Design docs** (Supabase schema md) | 1 | 3 | 3 | 1 | **8** | **REFERENCE** | Existing schema → informs Phase 12 Convex data model. |
| 15 | nrel/chargers_sample.csv (6 rows) | 2 | 0 | 3 | 1 | 6 | **REFERENCE** | Fixture only; real charger data comes LIVE from AFDC/NLR API (see DATA-SOURCES-VERIFICATION.md). |
| 16 | elevation/sample_profile.json | 1 | 0 | 3 | 1 | 5 | **REFERENCE** | Fixture; real elevation via API/PTV. |
| 17 | Open Data Gov URL lists | 0 | 0 | 3 | 0 | 3 | **REFERENCE** | Portal directory, not data. |
| 18 | FAF4.5.1 db + GIS (~2.2 GB) | 2 | 1 | 2 | 1 | 6 | **ARCHIVE** | Superseded by FAF5.7.1. Keep only for historical trend. |
| 19 | osm/california-latest.osm.pbf (1.2 GB) | 1 | 1 | 1 | 0 | 3 | **ARCHIVE** | Superseded by PTV routing (Phase 11). |
| 20 | Assignment Flow Tables /2 /3 (6.3 GB) | 2 | 1 | 1 | 2 | 6 | **DEDUPE** | Triplicated — keep one copy. |

## Priority ingest order for Phase 12 (freight-out-of-port first)

1. **FAF5 metadata + crosswalk** → lookup tables (zones 061=port, modes, SCTG2). *Foundation.*
2. **FAF5.7.1_2018-2024 actuals**, filtered to `dms_orig=061` (+ optionally 063/064 other ports) → the outbound-freight core.
3. **POLB carrier registry** → geocode → carrier-density / TAM layer (unique differentiator).
4. **CalTrans Truck AADT (geo)** → Class-8 volume weighting on real highway geometry (drives the pulse-flow intensity).
5. **FAF Highway Assignment** → map-accurate link-level flow (heavier; can follow).
6. **NATD parking + alt-fuel corridors** → charging-siting / hotspot enrichment (the solar-charger rec story).
7. State-summary cuts → fast TAM/SAM/commodity overlays.

## Headline takeaways

- **Freight-out-of-port is fully covered** by FAF5 (flows, mode, commodity, value, 2018-2024 actuals + forecast to 2050) — proven extractable at zone 061.
- **The POLB carrier registry is the unique, un-buyable asset** — nothing else ties named carriers to the port.
- **CalTrans axle-class AADT** gives credible, real Class-8 volume weighting (not synthetic) — key to the "data is accurate" promise.
- **Chargers are NOT in the raw data** (only a 6-row fixture) — they come live from AFDC/NLR (see DATA-SOURCES-VERIFICATION.md). Raw data + live API are complementary.
- **~13 GB of the 22 GB is superseded/redundant/dupe** (FAF4, OSM, triplicated flow tables, extracted-zip pairs) — reclaimable.
