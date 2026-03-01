# Scaling Guide

This document describes how to scale the Dryft API and supporting services.

## Current Scaling Model

- **API**: HorizontalPodAutoscaler (HPA) targets CPU and memory.
- **Database**: Postgres runs as a single StatefulSet pod (scale vertically).
- **Redis**: Single deployment (scale vertically or switch to managed Redis).
- **Ingress**: NGINX or cloud ingress with WebSocket support.

## API Autoscaling

Configured in `infra/k8s/hpa.yaml`:

- Min replicas: 2
- Max replicas: 6
- CPU target: 70% utilization
- Memory target: 75% utilization

### When to Scale Up

- Sustained increase in request rate and P95/P99 latency
- High CPU or memory in API pods
- Increase in concurrent WebSocket connections

### When to Scale Down

- Sustained low traffic
- P95 latency stable and CPU < 40%

## Vertical Scaling

- Postgres: increase memory first, then CPU
- Redis: increase memory for cache-heavy workloads

## Scaling Checklist

1. Check dashboards (CPU, memory, request rate, latency).
2. Verify error rate is stable (< 1%).
3. Scale API replicas (HPA) or adjust thresholds.
4. If DB is saturated, scale Postgres vertically.
5. Confirm `/health` and `/ready` are green.

## Future Improvements

- Add read replicas for Postgres
- Move Redis to managed service (ElastiCache)
- Add queue for background jobs
