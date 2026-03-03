#!/usr/bin/env bash
# Roll back dryft-api on DreamCompute.
# - Backs up current binary with timestamp suffix
# - Restores /opt/dryft/dryft-api.prev as active binary
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

run_cmd() {
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

echo "==> Rollback target: ${TARGET}"
if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "==> Running in dry-run mode"
fi

echo "==> Creating timestamped backup of current binary and restoring .prev"
ROLLBACK_CMD=$(cat <<'EOF'
set -euo pipefail
ts="$(date +%Y%m%d-%H%M%S)"
if [ ! -f "$REMOTE_PREV_PATH" ]; then
  echo "ERROR: missing previous binary at $REMOTE_PREV_PATH"
  exit 1
fi
if [ -f "$REMOTE_BINARY_PATH" ]; then
  sudo cp "$REMOTE_BINARY_PATH" "$REMOTE_BINARY_PATH.rollback-$ts"
fi
sudo cp "$REMOTE_PREV_PATH" "$REMOTE_BINARY_PATH"
EOF
)

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "[dry-run] ssh ${TARGET} \"REMOTE_BINARY_PATH='${REMOTE_BINARY_PATH}' REMOTE_PREV_PATH='${REMOTE_PREV_PATH}' bash -s\" <<'EOF'"
  echo "${ROLLBACK_CMD}"
  echo "EOF"
else
  ssh "${TARGET}" "REMOTE_BINARY_PATH='${REMOTE_BINARY_PATH}' REMOTE_PREV_PATH='${REMOTE_PREV_PATH}' bash -s" <<<"${ROLLBACK_CMD}"
fi

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

echo "Rollback completed."
