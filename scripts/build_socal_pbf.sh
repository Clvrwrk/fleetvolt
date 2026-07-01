#!/usr/bin/env bash
# Build SoCal regional OSM extract for Valhalla (D-14).
# Bbox covers POLB, Inland Empire, Cajon Pass, and southern NV border.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_DIR="${ROOT_DIR}/data/raw/osm"
OUTPUT_DIR="${ROOT_DIR}/data/valhalla/custom_files"
GEOFABRIK_URL="https://download.geofabrik.de/north-america/us/california-latest.osm.pbf"
CA_PBF="${RAW_DIR}/california-latest.osm.pbf"
SOCAL_PBF="${OUTPUT_DIR}/socal.osm.pbf"
BBOX="-121.0,32.5,-114.0,37.0"
VERIFY_SCRIPT="${ROOT_DIR}/scripts/verify_valhalla_pbf.sh"

mkdir -p "${RAW_DIR}" "${OUTPUT_DIR}"

if [[ -f "${SOCAL_PBF}" ]]; then
  echo "SoCal extract already present: ${SOCAL_PBF}"
  bash "${VERIFY_SCRIPT}"
  exit 0
fi

if [[ -n "${VALHALLA_SOCAL_PBF_URL:-}" ]]; then
  echo "Downloading prebuilt SoCal extract from VALHALLA_SOCAL_PBF_URL (HTTPS)..."
  curl -fsSL --retry 3 --retry-delay 5 -o "${SOCAL_PBF}" "${VALHALLA_SOCAL_PBF_URL}"
  echo "Download complete: ${SOCAL_PBF}"
  bash "${VERIFY_SCRIPT}"
  exit 0
fi

if [[ ! -f "${CA_PBF}" ]]; then
  echo "Downloading California OSM extract from Geofabrik (HTTPS)..."
  curl -fsSL --retry 3 --retry-delay 5 -o "${CA_PBF}" "${GEOFABRIK_URL}"
  echo "Download complete: ${CA_PBF}"
else
  echo "Using cached California extract: ${CA_PBF}"
fi

if command -v osmium >/dev/null 2>&1; then
  echo "Clipping to SoCal bbox ${BBOX}..."
  osmium extract -b "${BBOX}" "${CA_PBF}" -o "${SOCAL_PBF}" --overwrite
  echo "SoCal extract written: ${SOCAL_PBF}"
else
  echo "ERROR: osmium-tool not found." >&2
  echo "Install osmium-tool (e.g. brew install osmium-tool) and re-run." >&2
  echo "Fallback: set VALHALLA_SOCAL_PBF_URL to a trusted prebuilt artifact — see data/valhalla/README.md" >&2
  exit 1
fi

bash "${VERIFY_SCRIPT}"

echo "Next: docker compose up valhalla (first tile build may take 30–90 minutes)"
