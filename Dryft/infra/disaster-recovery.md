# Disaster Recovery Plan

This document outlines a minimal recovery plan for Dryft.

## RTO / RPO Targets

- RTO (Recovery Time Objective): 4 hours
- RPO (Recovery Point Objective): 24 hours

## Recovery Procedure

1. **Assess blast radius**: determine impacted services (API, DB, Redis, storage).
2. **Restore database**: provision a new Postgres instance and restore latest backup.
3. **Restore cache**: recreate Redis (data is ephemeral).
4. **Deploy API**: redeploy the API services with updated DB/Redis endpoints.
5. **Verify health**: `/health` and `/ready` endpoints return healthy status.
6. **Validate**: run smoke tests (auth, store, chat).

## Dependencies

- Database backups (pg_dump or RDS snapshots)
- Docker images / container registry
- DNS provider or ingress controller
- Secret manager (AWS Secrets Manager / Kubernetes secrets)

## TODO

- Define region failover strategy.
- Automate restore + verification scripts.
- Periodically run DR drills.
