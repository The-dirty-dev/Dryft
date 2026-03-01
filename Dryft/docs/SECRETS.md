# Secrets Management

This guide outlines how to manage Dryft secrets safely across environments.

## Principles

- Never commit real secrets to git.
- Use environment variables or secret managers for all sensitive values.
- Rotate secrets regularly and after any suspected exposure.

## Local Development

- Copy `backend/.env.example` to `backend/.env` and fill in values.
- Keep `.env` files out of source control.
- For Docker Compose, pass secrets via your shell or an `.env` file in the compose directory.

## Docker Compose (Prod)

- Provide secrets via environment variables when running `docker-compose.prod.yml`.
- Example (shell):

```sh
export JWT_SECRET_KEY="..."
export ENCRYPTION_KEY="..."
export POSTGRES_USER="drift"
export POSTGRES_PASSWORD="..."
```

## Kubernetes

- Store secrets in a `Secret` resource (or use an external secrets operator).
- Example (create secret values via CLI):

```sh
kubectl -n drift create secret generic drift-secrets \
  --from-literal=DATABASE_URL="..." \
  --from-literal=REDIS_URL="..." \
  --from-literal=JWT_SECRET_KEY="..." \
  --from-literal=ENCRYPTION_KEY="..."
```

- Reference secrets in deployments with `secretKeyRef` (see `infra/k8s/api-deployment.yaml`).

## AWS Secrets Manager (Recommended)

- Store production secrets in AWS Secrets Manager.
- Grant ECS/Kubernetes access via IAM roles.
- Fetch secrets at deploy time or via sidecar/agent (e.g., External Secrets Operator).

## Rotation & Audit

- Rotate JWT and encryption keys carefully; coordinate client invalidation.
- Log secret access in your cloud provider and restrict IAM permissions.

## Checklist

- [ ] Secrets are not committed to git
- [ ] Secret values injected via env vars or secret manager
- [ ] Rotations documented and scheduled
