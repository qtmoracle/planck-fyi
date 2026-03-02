#!/usr/bin/env bash
set -euo pipefail

INTAKE_ID="${1:-}"
NOTES="${2:-Completed on-site. Photos verified.}"

if [ -z "${INTAKE_ID}" ]; then
  echo "usage: $0 <intake_id> [notes]"
  exit 2
fi

BASE="${PLANCK_BASE_URL:-http://127.0.0.1:8788}"
TECH_TOKEN="${TECH_TOKEN:-}"
ADMIN_USER="${ADMIN_USER:-}"
ADMIN_PASS="${ADMIN_PASS:-}"

if [ -z "${TECH_TOKEN}" ]; then
  echo "ERROR: TECH_TOKEN is empty. (source ./scripts/dev_env.sh)"
  exit 2
fi
if [ -z "${ADMIN_USER}" ] || [ -z "${ADMIN_PASS}" ]; then
  echo "ERROR: ADMIN_USER or ADMIN_PASS is empty. (source ./scripts/dev_env.sh)"
  exit 2
fi

JOB_ID="job_${INTAKE_ID}"

echo "== Planck job flow =="
echo "intake_id: ${INTAKE_ID}"
echo "job_id:    ${JOB_ID}"
echo

auth_admin=(-u "${ADMIN_USER}:${ADMIN_PASS}")
auth_tech=(-H "x-tech-token: ${TECH_TOKEN}")

# ---- helpers ----
curlj() { curl -sS "$@"; }

get_intake_state() {
  curlj "${auth_admin[@]}" "${BASE}/admin/intake/state/${INTAKE_ID}" || true
}

extract_status() {
  # prints lowercase status or empty
  python3 - <<'PY'
import json,sys
try:
  obj=json.load(sys.stdin)
  st=(obj.get("state") or obj).get("status","")
  print(str(st).lower())
except Exception:
  print("")
PY
}

echo "1) Repair intake state (idempotent)"
curlj -X POST "${auth_admin[@]}" "${BASE}/admin/intake/repair/${INTAKE_ID}" | head -n 120
echo

# Determine intake status AFTER repair
STATE_JSON="$(get_intake_state)"
INTAKE_STATUS="$(printf '%s' "${STATE_JSON}" | extract_status)"

echo "intake_status: ${INTAKE_STATUS:-"(unknown)"}"
echo

# If pending, approve it
if [ "${INTAKE_STATUS}" = "pending" ]; then
  echo "2) Approve intake"
  curlj -X POST "${auth_admin[@]}" "${BASE}/admin/intake/approve/${INTAKE_ID}" | head -n 120
  echo
  # refresh status
  STATE_JSON="$(get_intake_state)"
  INTAKE_STATUS="$(printf '%s' "${STATE_JSON}" | extract_status)"
else
  echo "2) Approve intake: SKIP (status=${INTAKE_STATUS})"
  echo
fi

# If approved, create job
if [ "${INTAKE_STATUS}" = "approved" ]; then
  echo "3) Create job (requires approved)"
  curlj -X POST "${auth_admin[@]}" "${BASE}/admin/job/create/${INTAKE_ID}" | head -n 120
  echo
else
  echo "3) Create job:     SKIP (status=${INTAKE_STATUS})"
  echo
fi

echo "4) Fetch job by id (tech)"
curlj "${auth_tech[@]}" "${BASE}/api/job/by_id/${JOB_ID}" | head -n 120
echo

echo "5) Pull queued (tech)"
curlj "${auth_tech[@]}" "${BASE}/api/job/current" | head -n 120
echo

echo "6) Claim (tech)"
curlj -X POST "${auth_tech[@]}" "${BASE}/api/job/claim" | head -n 120
echo

echo "7) Complete (tech)"
python3 - "$NOTES" <<'PY' | curlj "${auth_tech[@]}" -H "content-type: application/json" -X POST --data-binary @- "${BASE}/api/job/complete" | head -n 160
import json, sys
notes = sys.argv[1] if len(sys.argv) > 1 else ""
print(json.dumps({"notes": notes}))
PY
echo
echo "DONE ✅"
