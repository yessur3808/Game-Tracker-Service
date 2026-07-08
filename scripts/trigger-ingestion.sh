#!/usr/bin/env bash
set -euo pipefail

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*"
}

if [[ -n "${INGEST_CRON_ENV_FILE:-}" ]]; then
  if [[ ! -f "${INGEST_CRON_ENV_FILE}" ]]; then
    log "ERROR: INGEST_CRON_ENV_FILE not found: ${INGEST_CRON_ENV_FILE}"
    exit 1
  fi

  # shellcheck disable=SC1090
  source "${INGEST_CRON_ENV_FILE}"
fi

if [[ -z "${ADMIN_API_KEY:-}" ]]; then
  log "ERROR: ADMIN_API_KEY is not set"
  exit 1
fi

INGEST_BASE_URL="${INGEST_BASE_URL:-http://localhost:${PORT:-3000}}"
INGEST_ENDPOINT="${INGEST_ENDPOINT:-/ingest/run}"
INGEST_HTTP_TIMEOUT_SEC="${INGEST_HTTP_TIMEOUT_SEC:-60}"
INGEST_LOCK_FILE="${INGEST_LOCK_FILE:-/tmp/game-tracker-ingest.lock}"
INGEST_EXTRA_CURL_ARGS="${INGEST_EXTRA_CURL_ARGS:-}"
INGEST_URL="${INGEST_BASE_URL%/}${INGEST_ENDPOINT}"

if command -v flock >/dev/null 2>&1; then
  exec 9>"${INGEST_LOCK_FILE}"
  if ! flock -n 9; then
    log "INFO: skipped trigger because another ingestion trigger is running"
    exit 0
  fi
else
  log "WARN: flock not found; overlap protection disabled"
fi

CURL_BIN="$(command -v curl || true)"
if [[ -z "${CURL_BIN}" ]]; then
  log "ERROR: curl is required but not installed"
  exit 1
fi

log "INFO: triggering ingestion at ${INGEST_URL}"
set +e
# shellcheck disable=SC2086
response="$(${CURL_BIN} --silent --show-error --fail \
  --max-time "${INGEST_HTTP_TIMEOUT_SEC}" \
  -X POST "${INGEST_URL}" \
  -H "X-Admin-Key: ${ADMIN_API_KEY}" \
  -H "Content-Type: application/json" \
  ${INGEST_EXTRA_CURL_ARGS})"
status=$?
set -e

if [[ ${status} -ne 0 ]]; then
  log "ERROR: ingestion trigger failed (curl exit ${status})"
  exit ${status}
fi

if [[ -n "${response}" ]]; then
  log "INFO: ingestion trigger accepted: ${response}"
else
  log "INFO: ingestion trigger accepted"
fi
