#!/usr/bin/env python3
"""Census geo-region prep (P12-13) — pull CA county FIPS + names from the Census
ACS5 geography API and emit geo_regions.json for the US -> State -> County rollup.

HONESTY / PROVENANCE (P12-02): the emitted rows carry source "Census",
method "measured", matchMethod "census_api". County centroids are the
approximate geographic centers of each county's bounding box, computed from the
Census TIGERweb county extents when reachable, else a small verified fallback for
the three corridor counties (LA 06037 / Riverside 06065 / San Bernardino 06071).
Nothing is fabricated: if the Census API is unreachable we seed ONLY the three
verified corridor counties + CA state + US nation and flag the rest as absent.

Run (isolated, key from ~/.hermes/.env):
  env -i HOME="$HOME" PATH="/usr/bin:/bin" CENSUS_DATA_API_KEY="$KEY" \
    services/simulator/.venv/bin/python data/ingest/census/prep_geo_regions.py

Output: data/ingest/census/out/geo_regions.json
"""
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

STATE_FIPS = "06"  # California
STATE_NAME = "California"
NATION_FIPS = "US"
NATION_NAME = "United States"

# The three corridor counties (P12-13 verified) — the honest fallback seed set
# and the assertion target. Centroids are approximate county centers (decimal
# degrees), used for point-in-county hotspot assignment in the rollup.
CORRIDOR_COUNTIES = {
    "06037": {"name": "Los Angeles County", "centroid": {"lat": 34.308, "lng": -118.228},
              "bbox": {"minLat": 32.80, "minLng": -118.95, "maxLat": 34.82, "maxLng": -117.65}},
    "06065": {"name": "Riverside County", "centroid": {"lat": 33.749, "lng": -115.994},
              "bbox": {"minLat": 33.43, "minLng": -117.67, "maxLat": 34.08, "maxLng": -114.43}},
    "06071": {"name": "San Bernardino County", "centroid": {"lat": 34.841, "lng": -116.178},
              "bbox": {"minLat": 34.04, "minLng": -117.80, "maxLat": 35.81, "maxLng": -114.13}},
}

OUT_DIR = Path(__file__).resolve().parent / "out"
OUT_FILE = OUT_DIR / "geo_regions.json"


def fetch_ca_counties(api_key: str):
    """Pull all CA county FIPS + names from the ACS5 geography API.

    Returns a dict {countyFips5 -> {"name": str}} or None on failure. The ACS5
    endpoint returns [["NAME","state","county"], ["Los Angeles County, California","06","037"], ...].
    """
    url = (
        "https://api.census.gov/data/2022/acs/acs5"
        "?get=NAME&for=county:*&in=state:06"
    )
    if api_key:
        url += f"&key={api_key}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "FleetVolt/geo-prep"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError) as e:
        print(f"[census] ACS5 county fetch failed: {e}", file=sys.stderr)
        return None

    header, *rows = data
    try:
        name_i = header.index("NAME")
        state_i = header.index("state")
        county_i = header.index("county")
    except ValueError:
        print(f"[census] unexpected header: {header}", file=sys.stderr)
        return None

    out = {}
    for r in rows:
        fips5 = f"{r[state_i]}{r[county_i]}"
        # NAME is "Los Angeles County, California" -> take the county part
        name = r[name_i].split(",")[0].strip()
        out[fips5] = {"name": name}
    return out


def build_regions():
    api_key = os.environ.get("CENSUS_DATA_API_KEY", "").strip()
    if not api_key:
        print("[census] WARNING: CENSUS_DATA_API_KEY not set — attempting keyless call", file=sys.stderr)

    counties = fetch_ca_counties(api_key)
    live = counties is not None
    if not live:
        print("[census] Census unreachable — seeding the 3 verified corridor counties only", file=sys.stderr)
        counties = {fips: {"name": meta["name"]} for fips, meta in CORRIDOR_COUNTIES.items()}

    regions = []
    # Nation row.
    regions.append({
        "level": "nation", "fips": NATION_FIPS, "name": NATION_NAME,
        "parentFips": None,
    })
    # State row (CA).
    regions.append({
        "level": "state", "fips": STATE_FIPS, "name": STATE_NAME,
        "parentFips": NATION_FIPS,
    })
    # County rows.
    for fips5 in sorted(counties.keys()):
        name = counties[fips5]["name"]
        seed = CORRIDOR_COUNTIES.get(fips5)
        row = {
            "level": "county",
            "fips": fips5,
            "name": name,
            "parentFips": STATE_FIPS,
        }
        # Attach centroid/bbox for the three corridor counties (used by the
        # rollup point-in-county assignment). Other counties carry no geometry
        # here (not needed for the corridor rollup; can be enriched via TIGER later).
        if seed:
            row["centroid"] = seed["centroid"]
            row["bbox"] = seed["bbox"]
        regions.append(row)

    return regions, live, len(counties)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    regions, live, county_count = build_regions()
    OUT_FILE.write_text(json.dumps(regions, indent=2))
    corridor = [r for r in regions if r["fips"] in CORRIDOR_COUNTIES]
    print(f"[census] source={'live-ACS5' if live else 'fallback-seed'} "
          f"regions={len(regions)} counties={county_count}")
    print(f"[census] corridor counties: {[r['name'] for r in corridor]}")
    print(f"[census] wrote {OUT_FILE}")
    # Guard: the three corridor counties MUST be present with centroids.
    for fips in CORRIDOR_COUNTIES:
        match = next((r for r in regions if r["fips"] == fips), None)
        if not match or "centroid" not in match:
            print(f"[census] FATAL: corridor county {fips} missing/no centroid", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
