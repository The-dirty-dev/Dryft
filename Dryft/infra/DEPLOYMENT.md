# Dryft Infrastructure Deployment Guide

This guide covers deployment patterns used in Dryft infrastructure: Docker Compose for local/prod-like environments, Kubernetes for clusters, TLS termination, monitoring, and backup/restore.

## Docker Compose

### Local/Single-Host

The backend includes a compose file at `backend/docker-compose.yml` for local stacks (API + Postgres + Redis).

Typical flow:

```bash
cd backend
# Copy env variables
cp .env.example .env

# Start services
docker-compose up -d
```

If a dev overlay exists (e.g., `docker-compose.dev.yml`), run:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## Kubernetes (Cluster)

If Kubernetes manifests are available under `infra/k8s/`, apply them via:

```bash
kubectl apply -k infra/k8s
```

Expected components:
- Namespace
- API Deployment + Service
- Postgres StatefulSet
- Redis Deployment
- Ingress

Adjust image tags and secrets before applying to production.

## TLS / SSL Termination

Common approaches:

- **Ingress Controller**: NGINX Ingress with cert-manager for Let's Encrypt.
- **Reverse Proxy**: NGINX/Traefik at the edge, forwarding to the Go API.

Make sure WebSocket upgrades are enabled (`Upgrade`/`Connection` headers) for `/v1/ws`.

## Monitoring Stack

If present under `infra/monitoring/`, the monitoring stack typically includes:

- Prometheus (metrics)
- Grafana (dashboards)
- Alertmanager (alerts)
- Loki/Promtail (logs)

Ensure the API exposes `/metrics` and `/health` endpoints and that they are scraped by Prometheus.

## Backup & Restore

For PostgreSQL:

```bash
# Backup
pg_dump "$DATABASE_URL" | gzip > dryft-$(date +%F).sql.gz

# Restore
zcat dryft-YYYY-MM-DD.sql.gz | psql "$DATABASE_URL"
```

If scripted backups exist (e.g., `infra/scripts/backup-postgres.sh`), prefer those to standardize cron usage.

## Environment & Secrets

- Store secrets in your deployment platform's secret manager (not in git).
- Ensure `ENCRYPTION_KEY` is set in production.
- Configure Stripe, Firebase, and APNs credentials before launch.

## Health Checks

- `GET /health` should be reachable internally and via load balancers.
- Configure readiness probes for `/ready` and liveness probes for `/health` with appropriate timeouts.

## DreamHost VPS

For the DreamHost-specific production flow (Linux build, `scp`, Supervisor, and NGINX reverse proxy), use:

- `infra/DREAMHOST_DEPLOYMENT.md`
