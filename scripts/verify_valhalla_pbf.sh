#!/usr/bin/env bash
# Verify SoCal OSM extract exists and meets minimum size for Valhalla (D-14).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOCAL_PBF="${ROOT_DIR}/data/valhalla/custom_files/socal.osm.pbf"
MIN_BYTES=52428800  # ~50 MB — clipped SoCal extract is typically 100 MB+

if [[ ! -f "${SOCAL_PBF}" ]]; then
  echo "ERROR: ${SOCAL_PBF} not found." >&2
  echo "" >&2
  echo "Build the SoCal extract locally (not committed to git):" >&2
  echo "  make valhalla-pbf" >&2
  echo "" >&2
  echo "Or set VALHALLA_SOCAL_PBF_URL to a trusted prebuilt artifact — see data/valhalla/README.md" >&2
  exit 1
fi

size_bytes=$(stat -f%z "${SOCAL_PBF}" 2>/dev/null || stat -c%s "${SOCAL_PBF}" 2>/dev/null || wc -c < "${SOCAL_PBF}")

if [[ "${size_bytes}" -lt "${MIN_BYTES}" ]]; then
  echo "ERROR: ${SOCAL_PBF} is too small (${size_bytes} bytes; minimum ${MIN_BYTES})." >&2
  echo "Re-run: make valhalla-pbf" >&2
  exit 1
fi

echo "OK: ${SOCAL_PBF} (${size_bytes} bytes)"

if command -v shasum >/dev/null 2>&1; then
  echo "SHA256: $(shasum -a 256 "${SOCAL_PBF}" | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  echo "SHA256: $(sha256sum "${SOCAL_PBF}" | awk '{print $1}')"
fi
