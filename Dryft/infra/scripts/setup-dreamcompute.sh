#!/usr/bin/env bash
# Provision a fresh Ubuntu 22.04+ DreamCompute VM for Dryft API.
# Supports --dry-run to print actions without executing.

set -euo pipefail

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  shift
fi

if [[ $# -ne 0 ]]; then
  echo "Usage: $0 [--dry-run]"
  exit 1
fi

DOMAIN="api.dryft.site"
EMAIL="admin@dryft.site"
APP_USER="dryft"
APP_GROUP="dryft"
APP_HOME="/opt/dryft"
SERVICE_NAME="dryft-api.service"
NGINX_SITE="/etc/nginx/sites-available/${DOMAIN}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}.conf"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NGINX_SOURCE="${REPO_ROOT}/infra/nginx/api.dryft.site.conf"
SERVICE_SOURCE="${REPO_ROOT}/infra/dryft-api.service"

if [[ ! -f "${NGINX_SOURCE}" ]]; then
  echo "ERROR: Missing ${NGINX_SOURCE}"
  exit 1
fi
if [[ ! -f "${SERVICE_SOURCE}" ]]; then
  echo "ERROR: Missing ${SERVICE_SOURCE}"
  exit 1
fi

SUDO=""
if [[ "${EUID}" -ne 0 ]]; then
  SUDO="sudo"
fi

run_cmd() {
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

echo "==> DreamCompute provisioning (domain: ${DOMAIN})"
if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "==> Running in dry-run mode"
fi

echo "==> Installing base packages"
run_cmd ${SUDO} apt-get update
run_cmd ${SUDO} apt-get install -y nginx snapd ufw

echo "==> Installing certbot (snap)"
run_cmd ${SUDO} snap install core
run_cmd ${SUDO} snap refresh core
run_cmd ${SUDO} snap install --classic certbot
run_cmd ${SUDO} ln -sfn /snap/bin/certbot /usr/bin/certbot

# If nginx plugin is unavailable in the snap build, install distro plugin as fallback.
if command -v certbot >/dev/null 2>&1; then
  if ! certbot plugins 2>/dev/null | grep -q "nginx"; then
    echo "==> Installing certbot nginx plugin fallback"
    run_cmd ${SUDO} apt-get install -y python3-certbot-nginx
  fi
fi

echo "==> Creating dryft system account"
if id -u "${APP_USER}" >/dev/null 2>&1; then
  echo "User ${APP_USER} already exists; skipping user creation"
else
  run_cmd ${SUDO} useradd --system --create-home --home-dir "${APP_HOME}" --shell /usr/sbin/nologin "${APP_USER}"
fi

echo "==> Preparing directories"
run_cmd ${SUDO} mkdir -p "${APP_HOME}"
run_cmd ${SUDO} mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
run_cmd ${SUDO} chown -R "${APP_USER}:${APP_GROUP}" "${APP_HOME}"

echo "==> Installing Nginx site config"
run_cmd ${SUDO} install -m 0644 "${NGINX_SOURCE}" "${NGINX_SITE}"
run_cmd ${SUDO} ln -sfn "${NGINX_SITE}" "${NGINX_ENABLED}"
run_cmd ${SUDO} nginx -t
run_cmd ${SUDO} systemctl enable --now nginx
run_cmd ${SUDO} systemctl reload nginx

echo "==> Configuring firewall"
run_cmd ${SUDO} ufw allow 22/tcp
run_cmd ${SUDO} ufw allow 80/tcp
run_cmd ${SUDO} ufw allow 443/tcp

echo "==> Obtaining TLS certificate (Let's Encrypt)"
if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  echo "Certificate already exists for ${DOMAIN}; skipping cert request"
else
  run_cmd ${SUDO} certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}"
fi

echo "==> Installing systemd service"
run_cmd ${SUDO} install -m 0644 "${SERVICE_SOURCE}" "/etc/systemd/system/${SERVICE_NAME}"
run_cmd ${SUDO} systemctl daemon-reload
run_cmd ${SUDO} systemctl enable --now "${SERVICE_NAME}"

echo "==> Enabling certbot auto-renew timer"
if systemctl list-unit-files 2>/dev/null | grep -q '^snap\.certbot\.renew\.timer'; then
  run_cmd ${SUDO} systemctl enable --now snap.certbot.renew.timer
elif systemctl list-unit-files 2>/dev/null | grep -q '^certbot\.timer'; then
  run_cmd ${SUDO} systemctl enable --now certbot.timer
else
  echo "No certbot timer found; check certbot installation"
fi

cat <<'EOF'

==> Verification checklist
1. Check listening ports:
   sudo ss -tulpn | grep -E ':22|:80|:443|:8080'
2. Check TLS certificate:
   sudo certbot certificates
3. Check API service:
   sudo systemctl status dryft-api.service --no-pager
4. Check Nginx status:
   sudo systemctl status nginx --no-pager
5. Test public health endpoint:
   curl -i https://api.dryft.site/health

EOF

