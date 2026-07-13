# FleetVolt data inventory (local raw + credential capabilities)

Generated for CaaS map / geospatial work. **No secret values** — key *names* only from the master project `.env`.

## Local raw datasets (`data/raw`)

| Folder | Size (approx) | What it unlocks |
|--------|---------------|-----------------|
| **Open Data Gov / tl_2022_us_zcta520** | ~1.3 GB shp | Census ZCTA5 polygons → CA ZIP choropleth (`geoZcta`) |
| **CA GEO Data** | ~129 MB | Air-district polygons (GeoJSON/GDB/KML), Caltrans districts, park-and-ride, freight yards, NMHD ZEIM, RTPA, HVIP voucher xlsx |
| **CalTrans** | ~17 MB | Truck AADT volumes (postmile) + GDB — already feeding corridor truck AADT |
| **FAF** | ~21 GB | FAF5 OD / networks / forecasts — freight OD + corridor demand |
| **NATD** | ~2.3 MB | Truck parking / alt-fuel corridor extracts |
| **nrel** | ~2.2 MB | AFDC charger sample (API refresh preferred via `NLR_API_KEY`) |
| **osm** | ~1.2 GB | OSM extract for POIs / roads |
| **geo** | small | `ca_air_districts.json` (county→district codes) |
| **HVIP Vehicle Data** | small | Catalog vehicle rows |
| **POLB** | small | Port-local extracts |
| **elevation** | sample | Elevation profile sample |
| **Skill Library** | docs | Runtime AI skill sources (Route Planning) |

Prep outputs live under `data/ingest/**/out/` (e.g. `census/out/ca_zcta.json`, `geo_regions.json`).

## APIs we can refresh (credential **names** present)

### Maps / routing / geo
- `PTV_DEVELOPER_API_KEY` — Class-8 truck routing (default for workbench + `faf/buildCorridors`)
- `GOOGLE_MAPS_*` / `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` / `NEXT_PUBLIC_GOOGLE_MAP_ID` — basemap tiles only (not truck routing)
- `GOOGLE_GEOCODING_API_KEY` — geocoding refresh
- `CENSUS_DATA_API_KEY` / `API_DATA_GOV_API_KEY` — Census ACS / data.gov pulls
- `511_SF_BAY_API_KEY` — Bay Area open transit/traffic feeds

### Chargers / energy / freight-adjacent
- `NLR_API_KEY` — NREL AFDC charger refresh into `chargers`
- (Local) CalTrans AADT + FAF files already on disk — API optional for refresh

### App platform
- Convex deploy keys, WorkOS keys, Vercel, Sentry, Resend/SMTP, etc. (product infra — not domain datasets)

### Research / scrape (optional enrichment)
- `FIRECRAWL_API_KEY`, `SERPAPI_API_KEY`, `SERPER_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, `PERPLEXITY_API_KEY`, etc.

## Ingest posture

- Prefer **local files in `data/raw`** for geometry (ZCTA, air districts, FAF, CalTrans).
- Prefer **API pulls only to refresh** volatile layers (AFDC chargers, Census ACS names, geocoding).
- ZIP polygons: `prep_ca_zcta.py` → `scripts/zcta_load.mjs` → `geoZcta` table.
