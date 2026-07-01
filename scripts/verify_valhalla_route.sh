#!/usr/bin/env bash
# Verify POLB → San Bernardino truck route via simulator → Valhalla (D-14 / PLAT-01).
set -euo pipefail

VALHALLA_URL="${VALHALLA_URL:-http://localhost:8002}"
SIMULATOR_URL="${SIMULATOR_URL:-http://localhost:8000}"
POLL_TIMEOUT="${POLL_TIMEOUT:-120}"

# Corridor endpoints — must match app.routes.routing constants
ORIGIN_LAT=33.754
ORIGIN_LON=-118.216
DEST_LAT=34.108
DEST_LON=-117.290

poll_valhalla_ready() {
  local elapsed=0
  while [[ "${elapsed}" -lt "${POLL_TIMEOUT}" ]]; do
    if status_json=$(curl -sf "${VALHALLA_URL}/status" 2>/dev/null); then
      if python3 -c "
import json, sys
s = json.loads(sys.argv[1])
actions = s.get('available_actions') or []
ready = 'route' in actions or s.get('tileset_last_modified') is not None
sys.exit(0 if ready else 1)
" "${status_json}" 2>/dev/null; then
        return 0
      fi
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo "ERROR: Valhalla not route-ready at ${VALHALLA_URL} after ${POLL_TIMEOUT}s" >&2
  echo "Check: curl -s ${VALHALLA_URL}/status" >&2
  return 1
}

poll_simulator_health() {
  local elapsed=0
  while [[ "${elapsed}" -lt "${POLL_TIMEOUT}" ]]; do
    if curl -sf "${SIMULATOR_URL}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo "ERROR: Simulator not healthy at ${SIMULATOR_URL}/health after ${POLL_TIMEOUT}s" >&2
  return 1
}

main() {
  echo "Polling Valhalla route readiness at ${VALHALLA_URL} ..."
  poll_valhalla_ready

  echo "Polling simulator health at ${SIMULATOR_URL} ..."
  poll_simulator_health

  route_url="${SIMULATOR_URL}/v1/routing/route?origin_lat=${ORIGIN_LAT}&origin_lon=${ORIGIN_LON}&dest_lat=${DEST_LAT}&dest_lon=${DEST_LON}"
  echo "GET ${route_url}"

  response=$(curl -sf -w "\n%{http_code}" "${route_url}" 2>/dev/null) || {
    echo "ERROR: Route request failed (curl error)" >&2
    exit 1
  }

  http_code=$(echo "${response}" | tail -n1)
  body=$(echo "${response}" | sed '$d')

  if [[ "${http_code}" != "200" ]]; then
    echo "ERROR: Expected HTTP 200, got ${http_code}" >&2
    echo "${body}" >&2
    exit 1
  fi

  python3 -c "
import json, sys

body = sys.argv[1]
try:
    payload = json.loads(body)
except json.JSONDecodeError as exc:
    print(f'ERROR: Invalid JSON response: {exc}', file=sys.stderr)
    sys.exit(1)

distance_m = payload.get('distance_m')
coordinates = payload.get('coordinates') or []
valhalla_status = payload.get('valhalla_status')

errors = []
if not isinstance(distance_m, (int, float)) or distance_m <= 50000:
    errors.append(f'distance_m must be > 50000, got {distance_m!r}')
if len(coordinates) <= 10:
    errors.append(f'coordinates must have > 10 points, got {len(coordinates)}')
if valhalla_status != 'ready':
    errors.append(f'valhalla_status must be \"ready\", got {valhalla_status!r}')

if errors:
    for err in errors:
        print(f'ERROR: {err}', file=sys.stderr)
    sys.exit(1)

print(f'OK: distance_m={distance_m:.0f}, coordinates={len(coordinates)}, valhalla_status={valhalla_status}')
" "${body}"

  echo "POLB → San Bernardino truck route verification passed."
}

main "$@"
