#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${ROOT_DIR}/tools/k6/accesscity-frontend-api.js"
BASE_URL="${BASE_URL:-http://127.0.0.1:5099}"
DURATION="${DURATION:-2m}"
SUMMARY_EXPORT="${SUMMARY_EXPORT:-/tmp/accesscity-frontend-api-k6-summary.json}"

if ! command -v k6 >/dev/null 2>&1; then
  printf 'k6 is required. Install it from https://grafana.com/docs/k6/latest/set-up/install-k6/.\n' >&2
  exit 127
fi

printf '[frontend-api-load] BASE_URL=%s DURATION=%s\n' "$BASE_URL" "$DURATION"

BASE_URL="$BASE_URL" \
DURATION="$DURATION" \
k6 run \
  --summary-export "$SUMMARY_EXPORT" \
  "$SCRIPT"

printf '[frontend-api-load] summary: %s\n' "$SUMMARY_EXPORT"
