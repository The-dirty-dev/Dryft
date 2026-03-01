# Backup Strategy

This document summarizes the current backup approach for Dryft.

## Postgres Backups

- Use `infra/scripts/backup-postgres.sh` to generate logical backups (`pg_dump`).
- Store backups in a secure, access-controlled location (e.g., encrypted S3 bucket).
- Schedule backups via cron or a managed scheduler (e.g., AWS EventBridge).

Example cron (daily at 02:00):

```cron
0 2 * * * /opt/dryft/infra/scripts/backup-postgres.sh
```

## Restore Procedure

- Use `infra/scripts/restore-postgres.sh <backup-file>` to restore.
- Verify schema + application health with `/health` after restore.

## Retention

- Recommended retention: 7–30 days depending on compliance requirements.
- Ensure backups are encrypted at rest and in transit.

## TODO

- Validate RDS automated backups or snapshot schedules for production.
- Add periodic restore tests to ensure backups are viable.
