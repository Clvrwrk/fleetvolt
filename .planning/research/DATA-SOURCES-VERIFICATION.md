# Data-Source API Key Verification — 2026-07-07

Verification of the API keys in `~/.config/cleverwork/master.env` lines 645–668
(excluding PTV, already in use for routing). Tested for auth, live endpoints, and
what data maps to FleetVolt's EV-charger / spatial layer (Phase 12 ingest target).

## Summary table

| Key (env var) | Line | Endpoint | Status | Use for FleetVolt |
|---|---|---|---|---|
| `NLR_API_KEY` | 666 | `https://developer.nlr.gov/api/alt-fuel-stations/v1.json` | ✅ LIVE | **PRIMARY EV charger source (AFDC)** |
| `API_DATA_GOV_API_KEY` | 652 | `https://api.data.gov/*` (proxy master key) | ✅ auth valid | Generic gov API gateway; also proxies NREL/AFDC |
| `CENSUS_DATA_API_KEY` | 661 | `https://api.census.gov/data/2022/acs/acs5` | ✅ LIVE | Corridor-county demographics (TAM/SAM context) |
| `511_SF_BAY_API_KEY` | 647 | `http://api.511.org/traffic/events` | ✅ LIVE (200) | ⚠️ Northern CA only — OUT of POLB/Cajon region |
| `Fastio` | 646 | (not tested — unknown service) | — | TBD |
| `PTV_DEVELOPER_API_KEY` | 663 | api.myptv.com | (excluded — in use for routing) | Routing (Phase 11) |

## ⚠️ Critical finding: NREL → NLR domain migration

`developer.nrel.gov` was **RETIRED 2026-05-29** and moved to **`developer.nlr.gov`**
(rebranded "National Laboratory of the Rockies"). The old domain no longer resolves
DNS. All AFDC / alt-fuel-station calls must use `developer.nlr.gov` + the `NLR_API_KEY`.
The `NREL`-labeled references in older FleetVolt code (Phase 1 charger ingest,
`01-04-PLAN`) point at the dead domain and **must be updated** — flag for Phase 12.

## EV charger data (AFDC via developer.nlr.gov) — the main prize

**Coverage (live counts, 2026-07-07):**
- **CA total ELEC stations: 21,279** (77,986 individual charging ports)
- **CA DC-fast stations: 2,864**

**Per-station fields that map directly to FleetVolt's charger model:**

| AFDC field | Maps to | Notes |
|---|---|---|
| `latitude` / `longitude` | charger location (PostGIS/Convex geo) | GPS geocode_status |
| `station_name`, `id` | charger identity | AFDC id = stable key |
| `ev_dc_fast_num` | # DC fast ports | HD-relevant count |
| `ev_level2_evse_num`, `ev_level1_evse_num` | slower ports | usually not HD-usable |
| `ev_connector_types` | `["CHADEMO","J1772","J1772COMBO", ...]` | CCS = J1772COMBO; MCS not yet in schema |
| `ev_charging_units[].connectors.<type>.power_kw` | **per-connector kW** | **the ≥350 kW HD filter (D-06)** |
| `maximum_vehicle_class` | `LD` / `MD` / `HD` | **truck-access filter** — most public sites are LD/MD |
| `ev_network` | operator (SHELL_RECHARGE, EVgo, Tesla, Non-Networked…) | provenance |
| `access_code` (public/private), `status_code` (E=available) | availability | filter to public+available |
| `facility_type`, `ev_workplace_charging` | site context | |
| `date_last_confirmed`, `updated_at` | freshness (SRC-01 provenance) | maps to `fetchedAt`/freshness indicator |
| `ev_pricing` | cost | often null |

**Reality check for Class-8:** most public AFDC EV sites are `maximum_vehicle_class` LD/MD
with connector kW in the 20–150 kW range. True 350kW+ HD/MCS truck charging is sparse —
so the ingest should keep the D-06 filter (power ≥ 350 kW AND CCS/MCS) but expect a small
result set; `maximum_vehicle_class` in (MD, HD) is the additional truck-relevant gate.

**Query notes:**
- Working endpoint: `GET /api/alt-fuel-stations/v1.json?api_key=…&fuel_type=ELEC&state=CA&ev_charging_level=dc_fast&limit=N`
- `nearest.json` sub-endpoint currently **404s** on the new NLR host (domain-transition gap) — do radius filtering client-side from `v1.json` (has lat/long) or via bounding box until fixed.
- Response includes `total_results` + `station_counts` for cheap coverage checks.

## Census (corridor demographics)
`api.census.gov` ACS5 works with the key. Pulled the 3 FleetVolt corridor counties live:
LA 9,936,690 · Riverside 2,429,487 · San Bernardino 2,180,563. Useful for TAM/SAM overlays
and freight-demand context, not for charger mapping directly.

## 511 SF Bay (traffic)
Authenticates (HTTP 200, gzipped JSON). BUT it's **San Francisco Bay Area** traffic/transit —
FleetVolt's corridors are **Southern CA** (POLB/Cajon). Not usable for the current corridors;
would need a SoCal equivalent (Caltrans PeMS / District 7/8) for congestion data down here.

## api.data.gov master key
`API_DATA_GOV_API_KEY` is the generic api.data.gov gateway key (valid). It can proxy many
federal APIs including NREL/AFDC, but the direct `developer.nlr.gov` + `NLR_API_KEY` path is
cleaner and confirmed working, so prefer NLR for charger data.

## Recommendations for Phase 12 (Convex data + spatial)
1. **Use `developer.nlr.gov` + `NLR_API_KEY` as the EV-charger source of record.** Update the dead `developer.nrel.gov` references from Phase 1.
2. Ingest CA `fuel_type=ELEC` with provenance `{source:"AFDC/NLR", fetchedAt, date_last_confirmed, ev_network}`.
3. Apply the HD filter: `max(power_kw) >= 350` AND `maximum_vehicle_class in (MD,HD)` AND `access_code=public` AND `status_code=E`. Store the full port/connector detail; label sparse HD coverage honestly.
4. Census ACS5 → optional corridor demographics layer (not charger-critical).
5. Drop 511 SF Bay for these corridors; source SoCal congestion separately if needed.
6. `Fastio` (line 646) — unidentified service; investigate before relying on it.
