# On-Call Procedures

This document provides a lightweight on-call playbook for Dryft.

## Severity Levels

- **SEV1**: Full outage, login broken, data loss
- **SEV2**: Major feature degraded (matching/chat/store)
- **SEV3**: Partial degradation, elevated latency, minor errors

## First Response Checklist

1. Acknowledge the alert (Alertmanager/Slack).
2. Check dashboards (API latency, error rate, CPU/memory).
3. Check `/health` and `/ready` endpoints.
4. Inspect logs in Grafana (Loki) for recent errors.
5. Identify scope: single pod vs global.

## Common Actions

- **High error rate**: inspect recent deploy, rollback if needed.
- **High latency**: check DB load, increase API replicas.
- **DB issues**: verify Postgres health, consider restore if corrupted.
- **Redis issues**: restart Redis, verify cache rebuild.

## Escalation

- Notify CLAUDE-Architect or HUMAN-Grant for SEV1/SEV2.
- Document the incident timeline and mitigation steps.

## Post-Incident

- Create a brief postmortem (impact, cause, fix, follow-up items).
- Update runbooks and alerts if gaps were found.
