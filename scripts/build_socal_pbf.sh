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

mkdir -p "${RAW_DIR}" "${OUTPUT_DIR}"

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
  echo "Fallback: download a pre-built socal.osm.pbf manually — see data/valhalla/README.md" >&2
  exit 1
fi

if command -v shasum >/dev/null 2>&1; then
  echo "SHA256: $(shasum -a 256 "${SOCAL_PBF}" | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  echo "SHA256: $(sha256sum "${SOCAL_PBF}" | awk '{print $1}')"
fi

echo "Next: docker compose up valhalla (first tile build may take 30–90 minutes)"
