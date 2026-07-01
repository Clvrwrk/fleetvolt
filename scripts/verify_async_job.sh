#!/usr/bin/env bash
# Optional manual async job verification — requires docker compose stack up.
set -euo pipefail

API_URL="${API_URL:-http://localhost:4000}"
BODY='{"route":{"corridor_key":"polb_cajon_pass"},"truck":{"slug":"ecascadia_438"},"conditions":{"weather_preset":"ideal","payload_lbs":34000,"port_drayage_enabled":false},"overrides":{},"options":{"include_charging":true}}'

echo "POST ${API_URL}/v1/simulations"
SUBMIT=$(curl -sf -X POST "${API_URL}/v1/simulations" \
  -H "Content-Type: application/json" \
  -d "${BODY}")
echo "${SUBMIT}"

JOB_ID=$(echo "${SUBMIT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["job_id"])')
STATUS=$(echo "${SUBMIT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')

if [ "${STATUS}" = "COMPLETE" ]; then
  echo "Cache hit — job already complete."
  exit 0
fi

echo "Polling GET ${API_URL}/v1/simulations/${JOB_ID}"
for _ in $(seq 1 60); do
  POLL=$(curl -sf "${API_URL}/v1/simulations/${JOB_ID}")
  STATUS=$(echo "${POLL}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')
  echo "status=${STATUS}"
  if [ "${STATUS}" = "COMPLETE" ] || [ "${STATUS}" = "FAILED" ]; then
    echo "${POLL}" | python3 -m json.tool
    exit 0
  fi
  sleep 2
done

echo "Timed out waiting for job ${JOB_ID}" >&2
exit 1
