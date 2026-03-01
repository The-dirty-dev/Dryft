#!/usr/bin/env bash
set -euo pipefail

POSTGRES_CONTAINER=${POSTGRES_CONTAINER:-dryft-postgres}
POSTGRES_USER=${POSTGRES_USER:-dryft}
POSTGRES_DB=${POSTGRES_DB:-dryft}

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DEFAULT_BACKUP="./backups/${POSTGRES_DB}-${TIMESTAMP}.sql"
BACKUP_FILE=${1:-${BACKUP_FILE:-$DEFAULT_BACKUP}}

mkdir -p "$(dirname "${BACKUP_FILE}")"

echo "Backing up ${POSTGRES_DB} from ${POSTGRES_CONTAINER} -> ${BACKUP_FILE}"

docker exec "${POSTGRES_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" > "${BACKUP_FILE}"

echo "Backup complete."
