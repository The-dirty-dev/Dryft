# Resource Limits

This document summarizes resource requests/limits for Dryft services.

## Kubernetes (Current)

### API (`infra/k8s/api-deployment.yaml`)

- Requests: CPU 250m, Memory 512Mi
- Limits: CPU 1, Memory 1Gi

### Postgres (`infra/k8s/postgres-statefulset.yaml`)

- Requests: CPU 250m, Memory 512Mi
- Limits: CPU 1, Memory 1Gi

### Redis (`infra/k8s/redis-deployment.yaml`)

- Requests: CPU 100m, Memory 128Mi
- Limits: CPU 500m, Memory 512Mi

## Guidance

- Keep requests conservative but realistic for scheduling stability.
- Adjust limits if throttling or OOM kills appear in logs.
- Review limits after load tests and production traffic patterns.
