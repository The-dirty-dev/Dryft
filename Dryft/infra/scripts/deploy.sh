#!/usr/bin/env bash
# Deploy dryft-api to DreamCompute.
# - Cross-compiles linux/amd64 binary
# - Uploads binary to remote host
# - Restarts systemd service
# - Verifies /health returns HTTP 200

set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  shift
fi

if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [--dry-run] [user@host]"
  exit 1
fi

DEFAULT_TARGET="dryft@api.dryft.site"
TARGET="${1:-${DRYFT_DEPLOY_TARGET:-$DEFAULT_TARGET}}"
REMOTE_BINARY_PATH="${DRYFT_REMOTE_BINARY_PATH:-/opt/dryft/dryft-api}"
REMOTE_PREV_PATH="${REMOTE_BINARY_PATH}.prev"
HEALTH_URL="${DRYFT_HEALTH_URL:-https://api.dryft.site/health}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"
LOCAL_BINARY="${BACKEND_DIR}/dryft-api"

run_cmd() {
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

echo "==> Deploy target: ${TARGET}"
if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "==> Running in dry-run mode"
fi

echo "==> Building linux/amd64 binary"
if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "[dry-run] (cd ${BACKEND_DIR} && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o dryft-api ./cmd/dryft-api)"
else
  (
    cd "${BACKEND_DIR}"
    GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o dryft-api ./cmd/dryft-api
  )
fi

echo "==> Uploading binary to ${TARGET}:${REMOTE_BINARY_PATH}"
echo "==> Saving previous binary to ${REMOTE_PREV_PATH} (if present)"
run_cmd ssh "${TARGET}" "if [ -f '${REMOTE_BINARY_PATH}' ]; then sudo cp '${REMOTE_BINARY_PATH}' '${REMOTE_PREV_PATH}'; fi"
run_cmd scp "${LOCAL_BINARY}" "${TARGET}:${REMOTE_BINARY_PATH}"

echo "==> Restarting dryft-api service"
run_cmd ssh "${TARGET}" "sudo systemctl restart dryft-api"

echo "==> Waiting for service to settle"
run_cmd sleep 3

echo "==> Checking health endpoint: ${HEALTH_URL}"
if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "[dry-run] curl -s -o /dev/null -w \"%{http_code}\" ${HEALTH_URL}"
else
  status="$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" || true)"
  if [[ "${status}" != "200" ]]; then
    echo "ERROR: health check failed (HTTP ${status})"
    exit 1
  fi
  echo "Health check OK (HTTP 200)"
fi

echo "Deploy completed."
