#!/usr/bin/env bash
set -euo pipefail

POSTGRES_CONTAINER=${POSTGRES_CONTAINER:-dryft-postgres}
POSTGRES_USER=${POSTGRES_USER:-dryft}
POSTGRES_DB=${POSTGRES_DB:-dryft}

BACKUP_FILE=${1:-${BACKUP_FILE:-}}

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Usage: restore-postgres.sh <backup-file>"
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "Restoring ${POSTGRES_DB} into ${POSTGRES_CONTAINER} from ${BACKUP_FILE}"

cat "${BACKUP_FILE}" | docker exec -i "${POSTGRES_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

echo "Restore complete."
