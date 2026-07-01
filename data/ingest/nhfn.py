"""BTS NHFN shapefile ingest clipped to Southern California (D-04).

Downloads the National Highway Freight Network from geodata.bts.gov, clips to
the SoCal bounding box, and loads into PostGIS ``nhfn_network`` with provenance
(D-16).

Coverage gap (RESEARCH Pitfall 2): Critical Urban Freight Corridors (CUFC) are
not included in the BTS GIS layer — urban drayage legs near POLB may be absent.
Phase 2 relies on Valhalla truck routing for those segments.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import geopandas as gpd
import requests
from shapely.geometry import LineString, MultiLineString, box
from shapely.geometry.base import BaseGeometry
from sqlalchemy import text
from sqlalchemy.orm import Session

REPO_ROOT = Path(__file__).resolve().parents[2]
SOCAL_BBOX_PATH = REPO_ROOT / "data" / "corridors" / "socal_bbox.json"
RAW_NHFN_DIR = REPO_ROOT / "data" / "raw" / "nhfn"

# Canonical BTS NHFN shapefile download (HTTPS geodata.bts.gov — T-02-02 accepted)
NHFN_SHAPEFILE_URL = (
    "https://geodata.bts.gov/datasets/"
    "usdot::national-highway-freight-network-nhfn.zip"
)

logger = logging.getLogger(__name__)


def load_socal_bbox(path: Path = SOCAL_BBOX_PATH) -> tuple[float, float, float, float]:
    """Return (west, south, east, north) for the SoCal regional extract."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    return (
        float(payload["west"]),
        float(payload["south"]),
        float(payload["east"]),
        float(payload["north"]),
    )


def _find_column(columns: list[str], *candidates: str) -> str | None:
    upper = {col.upper(): col for col in columns}
    for candidate in candidates:
        match = upper.get(candidate.upper())
        if match:
            return match
    return None


def _linestring_parts(geom: BaseGeometry) -> list[LineString]:
    if geom is None or geom.is_empty:
        return []
    if isinstance(geom, LineString):
        return [geom]
    if isinstance(geom, MultiLineString):
        return [part for part in geom.geoms if not part.is_empty]
    return []


def _row_name(props: dict, sign_col: str | None, lname_col: str | None) -> str | None:
    for col in (sign_col, lname_col):
        if col and props.get(col) not in (None, ""):
            return str(props[col])
    return None


def _row_phfs_flag(props: dict, nhfn_col: str | None, phfs_col: str | None) -> bool | None:
    if nhfn_col and props.get(nhfn_col) is not None:
        return str(props[nhfn_col]).upper() == "PHFS"
    if phfs_col and props.get(phfs_col) is not None:
        value = props[phfs_col]
        if isinstance(value, bool):
            return value
        try:
            return int(value) == 1
        except (TypeError, ValueError):
            return str(value).upper() in {"1", "Y", "YES", "TRUE", "PHFS"}
    return None


def _row_state(props: dict, state_col: str | None) -> str | None:
    if not state_col or props.get(state_col) is None:
        return None
    value = props[state_col]
    if isinstance(value, (int, float)):
        return f"{int(value):02d}"
    return str(value)


def prepare_nhfn_gdf(
    source_path: Path,
    bbox: tuple[float, float, float, float] | None = None,
) -> gpd.GeoDataFrame:
    """Load and clip NHFN linework to the SoCal bbox."""
    gdf = gpd.read_file(source_path)
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    else:
        gdf = gdf.to_crs("EPSG:4326")

    if bbox is not None:
        west, south, east, north = bbox
        clip_box = box(west, south, east, north)
        gdf = gdf[gdf.intersects(clip_box)].copy()
        gdf["geometry"] = gdf.geometry.intersection(clip_box)
        gdf = gdf[~gdf.geometry.is_empty].copy()

    return gdf


def load_nhfn(
    session: Session,
    *,
    source_path: Path,
    download_year: int,
    bbox: tuple[float, float, float, float] | None = None,
) -> int:
    """Delete prior BTS NHFN rows and bulk-insert clipped segments."""
    if bbox is None:
        bbox = load_socal_bbox()

    gdf = prepare_nhfn_gdf(source_path, bbox)
    if gdf.empty:
        logger.warning("No NHFN features remain after SoCal clip")
        return 0

    nhfn_col = _find_column(list(gdf.columns), "NHFN", "NHFN_TYPE", "NHFN_CODE")
    phfs_col = _find_column(list(gdf.columns), "PHFS")
    sign_col = _find_column(list(gdf.columns), "SIGN1", "SIGN")
    lname_col = _find_column(list(gdf.columns), "LNAME", "NAME")
    state_col = _find_column(list(gdf.columns), "STFIPS", "STATE", "STATE_NAME")

    source_label = f"BTS NHFN {download_year}"
    ingested_at = datetime.now(tz=UTC)

    session.execute(
        text("DELETE FROM nhfn_network WHERE source LIKE :pattern"),
        {"pattern": "BTS NHFN%"},
    )

    insert_sql = text(
        """
        INSERT INTO nhfn_network (
            geom,
            phfs_flag,
            corridor_type,
            state,
            name,
            attributes,
            source,
            ingested_at
        )
        VALUES (
            ST_GeogFromText(:wkt, 4326),
            :phfs_flag,
            :corridor_type,
            :state,
            :name,
            CAST(:attributes AS jsonb),
            :source,
            :ingested_at
        )
        """
    )

    inserted = 0
    for _, row in gdf.iterrows():
        props = {
            key: (None if value is None else str(value))
            for key, value in row.items()
            if key != "geometry"
        }
        corridor_type = (
            str(row[nhfn_col]) if nhfn_col and row.get(nhfn_col) is not None else None
        )
        for part in _linestring_parts(row.geometry):
            session.execute(
                insert_sql,
                {
                    "wkt": part.wkt,
                    "phfs_flag": _row_phfs_flag(props, nhfn_col, phfs_col),
                    "corridor_type": corridor_type,
                    "state": _row_state(props, state_col),
                    "name": _row_name(props, sign_col, lname_col),
                    "attributes": json.dumps(props),
                    "source": source_label,
                    "ingested_at": ingested_at,
                },
            )
            inserted += 1

    logger.info("Loaded %s NHFN segments (source=%s)", inserted, source_label)
    return inserted


def download_nhfn(target_dir: Path = RAW_NHFN_DIR) -> Path:
    """Download BTS NHFN shapefile zip and return path to extracted .shp."""
    target_dir.mkdir(parents=True, exist_ok=True)
    zip_path = target_dir / "nhfn.zip"

    logger.info("Downloading NHFN shapefile from %s", NHFN_SHAPEFILE_URL)
    response = requests.get(NHFN_SHAPEFILE_URL, timeout=120)
    response.raise_for_status()
    zip_path.write_bytes(response.content)

    with zipfile.ZipFile(zip_path, "r") as archive:
        archive.extractall(target_dir)

    shapefiles = sorted(target_dir.rglob("*.shp"))
    if not shapefiles:
        msg = f"No .shp found after extracting {zip_path}"
        raise FileNotFoundError(msg)

    shp_path = shapefiles[0]
    logger.info("Extracted NHFN shapefile to %s", shp_path)
    return shp_path


def _resolve_source_path(source: Path | None) -> Path:
    if source is not None:
        return source

    existing = sorted(RAW_NHFN_DIR.rglob("*.shp"))
    if existing:
        return existing[0]

    return download_nhfn()


def _log_extent(session: Session) -> None:
    row = session.execute(
        text(
            """
            SELECT
                COUNT(*) AS row_count,
                ST_AsText(ST_Extent(geom::geometry)) AS extent
            FROM nhfn_network
            WHERE source LIKE 'BTS NHFN%'
            """
        ),
    ).one()
    logger.info("NHFN rows=%s extent=%s", row.row_count, row.extent)


def main(argv: list[str] | None = None) -> int:
    if str(REPO_ROOT) not in sys.path:
        sys.path.insert(0, str(REPO_ROOT))

    parser = argparse.ArgumentParser(description="Ingest BTS NHFN linework for SoCal")
    parser.add_argument(
        "--download",
        action="store_true",
        help="Download shapefile from geodata.bts.gov before loading",
    )
    parser.add_argument(
        "--load",
        action="store_true",
        help="Clip to SoCal bbox and load into PostGIS nhfn_network",
    )
    parser.add_argument(
        "--source",
        type=Path,
        help="Local shapefile or GeoJSON path (skips download lookup)",
    )
    parser.add_argument(
        "--year",
        type=int,
        default=datetime.now(tz=UTC).year,
        help="Download year for provenance source label",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if not args.download and not args.load:
        parser.error("Specify at least one of --download or --load")

    source_path = args.source
    if args.download:
        source_path = download_nhfn()

    if args.load:
        simulator_root = REPO_ROOT / "services" / "simulator"
        if str(simulator_root) not in sys.path:
            sys.path.insert(0, str(simulator_root))

        from app.db import SessionLocal

        if source_path is None:
            source_path = _resolve_source_path(None)
        if not source_path.exists():
            raise FileNotFoundError(f"NHFN source not found: {source_path}")

        session = SessionLocal()
        try:
            count = load_nhfn(
                session,
                source_path=source_path,
                download_year=args.year,
            )
            session.commit()
            _log_extent(session)
            logger.info("NHFN load complete (%s segments)", count)
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
