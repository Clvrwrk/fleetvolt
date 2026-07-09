#!/usr/bin/env python3
"""Prep Major_Traffic_Generators.csv → trafficGenerators JSON for Convex ingest.

Source: data/raw/CA GEO Data/Frieght Data/Major_Traffic_Generators.csv
Coordinates are Web Mercator (EPSG:3857) X/Y — reprojected to WGS84 here.
"""

from __future__ import annotations

import csv
import json
import math
import os
import sys
from typing import Callable, Optional

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
CSV_PATH = os.path.join(
    REPO,
    "data",
    "raw",
    "CA GEO Data",
    "Frieght Data",
    "Major_Traffic_Generators.csv",
)
OUT_DIR = os.path.join(HERE, "out")
OUT = os.path.join(OUT_DIR, "traffic_generators.json")

# City / county / assoc heuristics → nearest FleetVolt port code.
PORT_HINTS: list[tuple[str, Callable[[dict], bool]]] = [
    (
        "POLB",
        lambda r: (
            "LONG BEACH" in r["city"].upper()
            or "WILMINGTON" in r["city"].upper()
            or "PORT OF LONG BEACH" in r["assoc"].upper()
            or ("LA" == r["county"] and "PIER" in r["name"].upper())
        ),
    ),
    (
        "POLA",
        lambda r: (
            "SAN PEDRO" in r["city"].upper()
            or "TERMINAL ISLAND" in r["city"].upper()
            or "PORT OF LOS ANGELES" in r["assoc"].upper()
        ),
    ),
    (
        "OAK",
        lambda r: r["city"].upper() in {"OAKLAND", "RICHMOND"}
        or r["county"] in {"ALA", "CC"},
    ),
    (
        "SF",
        lambda r: r["city"].upper() in {"SAN FRANCISCO", "SOUTH SAN FRANCISCO"},
    ),
    (
        "SD",
        lambda r: r["city"].upper() == "SAN DIEGO" or r["county"] == "SD",
    ),
]


def web_mercator_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """EPSG:3857 meters → WGS84 lat/lng."""
    lon = (x / 20037508.34) * 180.0
    lat = (y / 20037508.34) * 180.0
    lat = (180.0 / math.pi) * (
        2.0 * math.atan(math.exp(lat * math.pi / 180.0)) - math.pi / 2.0
    )
    return lat, lon


def clean(s: Optional[str]) -> str:
    if s is None:
        return ""
    return " ".join(str(s).replace("\n", " ").replace("\r", " ").split()).strip()


def infer_port(row: dict) -> Optional[str]:
    for code, pred in PORT_HINTS:
        try:
            if pred(row):
                return code
        except Exception:
            continue
    # LA county leftovers → POLB cluster (San Pedro / LB basin generators)
    if row["county"] == "LA":
        return "POLB"
    return None


def main() -> int:
    if not os.path.exists(CSV_PATH):
        print(f"FATAL: missing {CSV_PATH}", file=sys.stderr)
        return 1

    rows_out = []
    with open(CSV_PATH, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        for raw in reader:
            try:
                x = float(raw.get("X") or raw.get("\ufeffX") or "")
                y = float(raw.get("Y") or "")
            except (TypeError, ValueError):
                continue
            lat, lng = web_mercator_to_wgs84(x, y)
            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                continue
            object_id = clean(raw.get("OBJECTID"))
            if not object_id:
                continue
            city = clean(raw.get("CITY"))
            county = clean(raw.get("CO"))
            name = clean(raw.get("NAME"))
            assoc = clean(raw.get("ASSOC"))
            row = {
                "generatorId": f"MTG-{object_id}",
                "name": name,
                "assoc": assoc,
                "address": clean(raw.get("ADDRESS")),
                "city": city,
                "zip": clean(raw.get("ZIP")),
                "district": clean(raw.get("DIST")),
                "county": county,
                "location": {"lat": round(lat, 6), "lng": round(lng, 6)},
            }
            port = infer_port(row)
            if port:
                row["portCode"] = port
            rows_out.append(row)

    if not rows_out:
        print("FATAL: zero generators parsed", file=sys.stderr)
        return 1

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, "w") as fh:
        json.dump(
            {
                "source": "Major_Traffic_Generators.csv",
                "count": len(rows_out),
                "rows": rows_out,
            },
            fh,
            indent=2,
        )
    print(f"Wrote {len(rows_out)} generators → {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
