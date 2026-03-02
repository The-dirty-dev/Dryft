#!/usr/bin/env bash
# =============================================================================
# deploy-vps.sh — Cross-compile dryft-api and deploy to DreamHost VPS
#
# Usage:
#   export DRYFT_VPS_HOST=thedirtyadmin@YOUR_VPS_IP
#   ./infra/scripts/deploy-vps.sh
#
#   Or pass host as first arg:
#   ./infra/scripts/deploy-vps.sh thedirtyadmin@YOUR_VPS_IP
#
# Requirements (on your Mac):
#   - Go toolchain
#   - ssh + scp access to VPS
#   - DRYFT_VPS_HOST env var or $1 argument
#
# Requirements (on VPS):
#   - ~/api.dryft.site/opt/dryft/ directory exists
#   - ~/api.dryft.site/opt/dryft/.env.prod exists with all required vars
#   - pm2 installed (npm install -g pm2)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
BINARY_NAME="dryft-api"
BACKEND_DIR="$REPO_ROOT/backend"
LOCAL_BINARY="$BACKEND_DIR/$BINARY_NAME"
# DreamHost VPS: user thedirtyadmin, site directory under $HOME
VPS_USER="${DRYFT_VPS_USER:-thedirtyadmin}"
VPS_DEPLOY_DIR="/home/$VPS_USER/api.dryft.site/opt/dryft"
VPS_HOST="${1:-${DRYFT_VPS_HOST:-}}"

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
if [[ -z "$VPS_HOST" ]]; then
  echo "ERROR: VPS host not set."
  echo "  Set DRYFT_VPS_HOST env var, or pass it as the first argument."
  echo "  Example: DRYFT_VPS_HOST=thedirtyadmin@1.2.3.4 $0"
  exit 1
fi

echo ""
echo "========================================"
echo "  Dryft VPS Deploy"
echo "  Target: $VPS_HOST:$VPS_DEPLOY_DIR"
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Cross-compile for Linux amd64
# ---------------------------------------------------------------------------
echo "==> [1/4] Cross-compiling for linux/amd64..."
cd "$BACKEND_DIR"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -ldflags="-s -w" -o "$BINARY_NAME" ./cmd/dryft-api
echo "    Built: $(du -sh "$LOCAL_BINARY" | cut -f1)  $LOCAL_BINARY"

# ---------------------------------------------------------------------------
# Step 2: Upload binary as .new (atomic swap avoids serving partial binary)
# ---------------------------------------------------------------------------
echo ""
echo "==> [2/4] Uploading binary to $VPS_HOST:$VPS_DEPLOY_DIR/$BINARY_NAME.new ..."
scp -q "$LOCAL_BINARY" "$VPS_HOST:$VPS_DEPLOY_DIR/$BINARY_NAME.new"
echo "    Upload complete."

# ---------------------------------------------------------------------------
# Step 3: Hot-swap binary and restart on VPS
# ---------------------------------------------------------------------------
echo ""
echo "==> [3/4] Hot-swapping and restarting on VPS..."
ssh "$VPS_HOST" bash -s -- "$VPS_DEPLOY_DIR" "$BINARY_NAME" <<'REMOTE'
  set -euo pipefail
  DEPLOY_DIR="$1"
  BINARY_NAME="$2"
  BINARY="$DEPLOY_DIR/$BINARY_NAME"

  # Keep previous binary for rollback
  if [[ -f "$BINARY" ]]; then
    cp "$BINARY" "$BINARY.prev"
  fi

  # Atomic swap
  chmod +x "$BINARY.new"
  mv "$BINARY.new" "$BINARY"
  echo "    Binary swapped."

  # Restart via pm2 if managing this process, else nohup fallback
  if command -v pm2 &>/dev/null && pm2 describe "$BINARY_NAME" &>/dev/null 2>&1; then
    pm2 restart "$BINARY_NAME" --update-env
    echo "    Restarted via pm2."
  else
    echo "    pm2 not managing $BINARY_NAME — using nohup fallback."
    # Kill any existing process
    pkill -f "$BINARY" 2>/dev/null || true
    sleep 1

    # Load env (binary has no dotenv loader)
    ENV_FILE="$DEPLOY_DIR/.env.prod"
    if [[ ! -f "$ENV_FILE" ]]; then
      echo "ERROR: $ENV_FILE not found on VPS. Create it before deploying."
      exit 1
    fi
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a

    # Start in background; logs in working directory
    cd "$DEPLOY_DIR"
    nohup "$BINARY" > "$DEPLOY_DIR/dryft.log" 2>&1 &
    NEW_PID=$!
    echo "    Started via nohup (PID $NEW_PID)."
    echo "    Logs: $DEPLOY_DIR/dryft.log"
    echo "$NEW_PID" > "$DEPLOY_DIR/dryft-api.pid"
  fi
REMOTE

# ---------------------------------------------------------------------------
# Step 4: Health check
# ---------------------------------------------------------------------------
echo ""
echo "==> [4/4] Waiting 4 seconds then verifying health..."
sleep 4

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://api.dryft.site/health" || echo "000")
if [[ "$HTTP_STATUS" == "200" ]]; then
  echo "    ✅ https://api.dryft.site/health → HTTP 200 OK"
else
  echo "    ❌ Health check returned HTTP $HTTP_STATUS"
  echo "    Check logs on VPS:"
  echo "      ssh $VPS_HOST 'pm2 logs dryft-api --lines 50'"
  echo "      ssh $VPS_HOST 'tail -50 $VPS_DEPLOY_DIR/dryft.log'"
  exit 1
fi

echo ""
echo "========================================"
echo "  Deploy complete!"
echo "  Rollback: ssh $VPS_HOST 'cd $VPS_DEPLOY_DIR && mv dryft-api dryft-api.bad && mv dryft-api.prev dryft-api && pm2 restart dryft-api'"
echo "========================================"
echo ""
