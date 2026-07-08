#!/usr/bin/env python3
"""Streaming OSM POI extraction (P12-14) from california-latest.osm.pbf.

Reverses the BENEFIT-MATRIX "ARCHIVE osm.pbf" verdict: the 1.3GB pbf is now the
free, no-new-paid-dependency amenities source. A single streaming pyosmium pass
(NEVER loads the whole pbf into memory) filters the P12-14 tag set, bounds to the
SoCal/POLB-corridor bbox, and emits data/ingest/osm/out/osm_pois.json:
    [{osmId, elementType, type, name, lat, lng, tags:{matched osm tags}}]

TAG -> TYPE PRECEDENCE (most-specific first; mirrored EXACTLY in
apps/web/convex/pois/classify.ts so the Python + Convex classifiers cannot drift):
    1. amenity=fuel                                   -> fuel
    2. amenity=parking AND (hgv=yes OR access=hgv)    -> truck_parking
    3. highway in {services, rest_area}              -> rest_area
    4. shop=convenience                               -> convenience
    5. amenity=fast_food                             -> fast_food
    else                                             -> None (skip)
Precedence rationale: a fuel station that is ALSO a convenience store classifies
as `fuel` (the most specific truck-relevant amenity); a plain amenity=parking
with no hgv/access=hgv tag is NOT truck_parking (returns None) so we never
over-count generic car parks as truck parking (T-12-07d).

SoCal/POLB-corridor bbox (documented bound, T-12-07a): statewide convenience/
fast_food would be tens of thousands of rows; the 12-08 report query only needs
the corridor region, so POIs are bounded to:
    minLat 33.4  minLng -118.7  maxLat 34.5  maxLng -116.9

Nodes use their own lat/lon. Ways (parking/rest-area polygons) use a member-node
centroid via pyosmium's locations-on-ways cache (a second cheap pass over the
way's node refs) — bounded to the same bbox.

FAIL LOUDLY if osmium is missing (prints the pip line); never fabricate POIs.

Run (isolated venv):
    env -i HOME="$HOME" PATH="/usr/bin:/bin" .venv/bin/python data/ingest/osm/extract_pois.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PBF = os.path.join(REPO, "data", "raw", "osm", "california-latest.osm.pbf")
OUT_DIR = os.path.join(HERE, "out")

# SoCal / POLB-corridor bounding box (documented bound).
BBOX = {"minLat": 33.4, "minLng": -118.7, "maxLat": 34.5, "maxLng": -116.9}

try:
    import osmium
except ImportError:
    sys.exit(
        "FATAL: pyosmium not importable. Install it into the ingest venv:\n"
        "    env -i HOME=\"$HOME\" PATH=\"/usr/bin:/bin\" .venv/bin/pip install osmium\n"
        "Refusing to fabricate POIs."
    )


def classify_poi(tags):
    """Return exactly one pois.type or None. Mirror of classify.ts (keep in sync)."""
    amenity = tags.get("amenity")
    if amenity == "fuel":
        return "fuel"
    if amenity == "parking" and (tags.get("hgv") == "yes" or tags.get("access") == "hgv"):
        return "truck_parking"
    if tags.get("highway") in ("services", "rest_area"):
        return "rest_area"
    if tags.get("shop") == "convenience":
        return "convenience"
    if amenity == "fast_food":
        return "fast_food"
    return None


# Only the tags relevant to classification + provenance are retained per POI.
KEEP_TAG_KEYS = ("amenity", "highway", "shop", "hgv", "access", "name", "brand", "operator")


def in_bbox(lat, lng):
    return (
        BBOX["minLat"] <= lat <= BBOX["maxLat"]
        and BBOX["minLng"] <= lng <= BBOX["maxLng"]
    )


class PoiHandler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.counts = {}
        self.seen = set()

    def _emit(self, osm_id, element_type, tagobj, lat, lng):
        if lat is None or lng is None:
            return
        if not in_bbox(lat, lng):
            return
        tags = {k: tagobj.get(k) for k in KEEP_TAG_KEYS if k in tagobj}
        poi_type = classify_poi(tags)
        if poi_type is None:
            return
        dedup = (element_type, osm_id)
        if dedup in self.seen:
            return
        self.seen.add(dedup)
        self.rows.append(
            {
                "osmId": int(osm_id),
                "elementType": element_type,
                "type": poi_type,
                "name": tagobj.get("name"),
                "lat": round(lat, 7),
                "lng": round(lng, 7),
                "tags": tags,
            }
        )
        self.counts[poi_type] = self.counts.get(poi_type, 0) + 1

    def node(self, n):
        if not n.tags:
            return
        try:
            loc = n.location
            if not loc.valid():
                return
            self._emit(n.id, "node", n.tags, loc.lat, loc.lon)
        except Exception:
            return

    def way(self, w):
        # Parking / rest-area polygons are ways. With locations=True every node
        # ref carries a coordinate; average the valid ones for a centroid point
        # (good enough for a POI marker). Streams — no whole-pbf load.
        if not w.tags:
            return
        # Cheap pre-check: only bother computing a centroid for candidate tags.
        if classify_poi({k: w.tags.get(k) for k in KEEP_TAG_KEYS if k in w.tags}) is None:
            return
        lat_sum = 0.0
        lng_sum = 0.0
        cnt = 0
        try:
            for nd in w.nodes:
                loc = nd.location
                if loc.valid():
                    lat_sum += loc.lat
                    lng_sum += loc.lon
                    cnt += 1
        except Exception:
            return
        if cnt == 0:
            return
        self._emit(w.id, "way", w.tags, lat_sum / cnt, lng_sum / cnt)


def main():
    if not os.path.exists(PBF):
        sys.exit(f"FATAL: pbf not found at {PBF} — cannot extract POIs.")
    os.makedirs(OUT_DIR, exist_ok=True)

    print(f"streaming {PBF} ({os.path.getsize(PBF) / 1e9:.2f} GB) ...")
    h = PoiHandler()
    # locations=True builds the node-location cache so area() centroids resolve;
    # this streams — it does NOT load the whole pbf into RAM.
    h.apply_file(PBF, locations=True)

    out_path = os.path.join(OUT_DIR, "osm_pois.json")
    with open(out_path, "w") as f:
        json.dump(h.rows, f)

    print(f"total POIs: {len(h.rows)}")
    for t in ("truck_parking", "rest_area", "fuel", "convenience", "fast_food"):
        print(f"  {t}: {h.counts.get(t, 0)}")
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
