# Monitoring (Prometheus + Grafana)

This directory contains a minimal monitoring scaffold for the Dryft API.

## Prerequisites

- Docker Compose v2
- A running Dryft API container on the `dryft` Docker network

If the `dryft` network does not exist, create it once:

```sh
docker network create dryft
```

## Run (alongside prod compose)

```sh
# Start the app stack first

docker compose -f docker-compose.prod.yml up -d

# Start monitoring

docker compose -f docker-compose.monitoring.yml up -d
```

## Endpoints

- Prometheus: http://localhost:9090
- Alertmanager: http://localhost:9093
- Loki: http://localhost:3100
- Grafana: http://localhost:3001 (anonymous viewer enabled)

## Health Checks

- API health: `GET /health` (expects HTTP 200 + JSON status)
- Readiness: `GET /ready` (DB + Redis checks; pending backend support)
- Metrics scrape: `GET /metrics` (Prometheus format)
- Postgres: `pg_isready -U <user> -d <db>`
- Redis: `redis-cli ping`

## Logs

- Grafana Explore → select the **Loki** datasource to query logs.
- Promtail is configured with a placeholder path (`/var/log/dryft/*.log`).
  Update `infra/monitoring/promtail.yml` to match your container or host log path.
- Loki retention is set to 7 days (`retention_period: 168h`) in `infra/monitoring/loki.yml`.

## Notes

- Prometheus scrapes `dryft-api:8080/metrics` by default.
- Update `infra/monitoring/prometheus.yml` if your API runs elsewhere.
- Alert rules live in `infra/monitoring/alerts.yml`.
- Grafana dashboards are provisioned from `infra/monitoring/grafana/provisioning/`.
