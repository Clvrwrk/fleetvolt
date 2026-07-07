# FleetVolt Raw Data Inventory — `data/raw/`

**Inspected:** 2026-07-07 · **Total:** ~22 GB, 356 files, 9 source folders.
Focus lens for scoring: **freight movement OUT of the Port of Long Beach / LA (POLB/POLA)**.

FAF domestic zone **061 = "Los Angeles-Long Beach, CA"** is the port region key used throughout.

---

## 1. FAF — Freight Analysis Framework (FHWA/BTS)  ·  20.8 GB / 281 files  ·  ⭐ CORE

The authoritative US freight origin→destination flow dataset. **Directly answers "what
freight moves out of the port, where to, by what mode, of what commodity, how much."**

| Artifact | What it is | Rows | On-target? |
|---|---|---|---|
| `FAF5.7.1/FAF5.7.1.csv` (1.1 GB) | **Master OD flow matrix** v5.7.1. Cols: `fr_orig, dms_orig, dms_dest, fr_dest, fr_inmode, dms_mode, fr_outmode, sctg2, trade_type, dist_band, tons_2017..2050, value_2017..2050`. | 2,671,387 | ⭐⭐⭐ |
| `06 - California/1.County-to-County.csv` (55 MB) | CA-filtered **county↔county** flows w/ `dms_mode`, `sctgG5`, `tons_2022`. Finer geo than zone-level. | 1,053,819 | ⭐⭐⭐ |
| `06 - California/2.County-to-FAF.csv`, `2.FAF-to-County.csv`, `3.FAF-to-FAF.csv` | CA flows at mixed county/FAF-zone resolution. | ~ | ⭐⭐ |
| `FAF5.7.1_2018-2024/…csv` (695 MB) | **Recent actuals** 2018-2024 (vs the master's forecast blend). Best for "current" freight. | ~ | ⭐⭐⭐ |
| `FAF5.7.1_State*` (several) | State-level aggregation of the above. | | ⭐ |
| `FAF5.7.1 State Summary by *` (Top10 Commodity, SCTG2, Top50 OD Pairs, Dmsmode+Trade, Top5 Trading Partners) | Pre-aggregated summary cuts 1997-2050. Fast for charts/overlays without touching the 1 GB file. | | ⭐⭐ |
| `FAF5_2017/2022/2050_HighwayAssignmentResults_*.zip` (~530-713 MB ea) | **Freight assigned to actual highway network segments** — truck volumes per road link. Enables map-accurate flow rendering. | | ⭐⭐⭐ (viz) |
| `Forecast2050BaselineNetworksAndAssignments/` (2.8 GB, 82 files) | Network + assignment for 2050 forecast. | | ⭐ |
| `Assignment Flow Tables /2 /3` (2.1 GB ea, dup'd x3) | Highway link flow tables. **Likely triplicate — dedupe.** | | ⭐⭐ / redundant |
| `FAF4.5.1_database.csv` (1.6 GB), `FAF4.5.1_state_database.csv` (593 MB) | **Prior FAF v4** generation. Superseded by v5.7.1 — keep only for historical back-compat. | | ▽ superseded |
| `faf4_esri_arcgis/` (453 MB) | FAF4 GIS network shapes (Esri). v5 equivalents exist. | | ▽ |
| `CFS-area-code-FAF5-zone-id.xlsx` | **Crosswalk** CFS area ↔ FAF zone ↔ state FIPS. Join key. | 133 | ⭐⭐ (join) |
| `FAF5_metadata.xlsx` | **Codebook**: zones, states, SCTG2 commodities, modes, trade types, distance bands. Required to decode everything. | | ⭐⭐⭐ (essential) |

**Proven extraction (2024, zone 061 outbound):** 558,428 kilotons / **$1.32 trillion** total; **truck (mode 1) = 394,903 ktons**; top dests 061(intra), 064(SF Bay), 063(San Diego), 069(rest-CA), 041(Phoenix); top commodities SCTG 17 (gravel), 19 (mixed freight), 31 (nonmetal min), 12 (gasoline). 80,703 flow rows originate from the port zone.

---

## 2. POLB — Port of Long Beach  ·  241 KB / 1 file  ·  ⭐ CORE / UNIQUE

| Artifact | What it is | Rows |
|---|---|---|
| `POLB-Status-Update-07-01-26.xlsx` | **Registry of drayage trucking companies operating out of POLB.** Cols: HD Registration #, company name, contact, full address, city/state/zip, phone. | 3,151 |

Literally the roster of carriers moving freight out of the port. Unique — not available from any public API. Geocodable to map carrier home-base density (fleet-electrification TAM by operator).

---

## 3. CalTrans  ·  17 MB / 61 files  ·  ⭐ corridor traffic

| Artifact | What it is | Rows |
|---|---|---|
| `Truck__Average_Daily_Traffic.csv` | **Truck AADT per highway postmile segment**, broken out **by axle class** (2/3/4/5-axle counts + %). 5-axle ≈ Class-8. Cols incl RTE, CNTY, POSTMILE, VEHICLE_AADT_TOTAL, TOT_TRK_AADT, TRK_5_AXLE(_PCT), EAL, EST_YEAR. | 6,865 |
| `Truck_Volumes_AADT.geojson` / `.gdb` / `.kml` / `.zip` | Same truck AADT as **mappable geometry** (segments). | |
| `Hydrogen_Fueling_Network_Delivery_Type.csv` | CA H2 fueling stations (lat/lon, capacity, existing/planned). Alt-fuel infra. | |

Truck AADT by axle class = real congestion/volume weighting for corridor rendering and the pulse-flow intensity model. On-target for SoCal corridors.

---

## 4. NATD (NTAD — National Transportation Atlas)  ·  2.3 MB / 6 files

| Artifact | What it is |
|---|---|
| `NTAD_Alternative_Fuel_Corridors_*.csv` | Federally designated **alt-fuel corridors** (EV/CNG/LNG/H2 "signage-ready" flags) per highway. Routing/eligibility context. |
| `NTAD_Truck_Stop_Parking_*.csv/.geojson/.gpkg/.kmz/.geodatabase` | **Truck stop + rest-area parking** locations w/ `number_of_spots`, lat/lon (nationwide → filter CA). Charging-siting + hotspot layer. |

---

## 5. Supporting / reference  ·  small

| Artifact | What it is | Verdict |
|---|---|---|
| `osm/california-latest.osm.pbf` (1.2 GB) | OSM routing base for all-CA. | ▽ superseded by PTV routing (Phase 11); keep only if we ever self-host routing |
| `nrel/chargers_sample.csv` (6 rows) | **Fixture/sample** of AFDC charger schema (incl. synthetic "POLB Depot MCS Hub 400kW"). | template only — real data comes live from AFDC/NLR API |
| `elevation/sample_profile.json` | **Fixture** — corridor elevation profile format (matches sim cache). | template only |
| `Open Data Gov/open_data_us.csv, _intl.csv` | Directory of open-data portal **URLs** (state/international). | metadata index, not data |
| `Database Design/FleetVolt_Database_Schema.md`, `Supabase_Dev_Configuration_README.md` | Existing FleetVolt Supabase schema + dev config docs. | ⭐ reference for Phase 12 Convex modeling |

---

## Cleanup / dedupe flags
- `Assignment Flow Tables` / ` 2` / ` 3` appear **triplicated** (~6.3 GB total) — verify + keep one.
- Most FAF `.zip` files have an already-extracted sibling folder — **~3.8 GB of zips are redundant** once extraction is confirmed.
- FAF4.5.1 (`~2.2 GB` csv+gis) is **superseded by FAF5.7.1** — archive.
- `osm/*.pbf` (1.2 GB) superseded by PTV.
- **Potential reclaim: ~13 GB** of the 22 GB is redundant/superseded.
