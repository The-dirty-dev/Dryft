# GitHub Actions Secrets and Variables

This document lists secrets and variables required by CI/CD workflows.

## Required Secrets

| Name | Used By | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | All workflows (implicit) | GitHub API auth for workflow actions |
| `CODECOV_TOKEN` | `ci.yml` (if Codecov is enabled) | Upload coverage reports to Codecov |
| `SNYK_TOKEN` | `security-scan.yml` | Authenticate Snyk scans |
| `EXPO_TOKEN` | `eas-build.yml` | Authenticate Expo EAS builds |
| `VERCEL_TOKEN` | `preview.yml` | Trigger Vercel preview deployments |
| `VERCEL_ORG_ID` | `preview.yml` | Vercel organization target |
| `VERCEL_PROJECT_ID` | `preview.yml` | Vercel project target |
| `UNITY_LICENSE` | VR-related workflows (if enabled) | Unity build licensing |

## Optional Secrets

| Name | Used By | Purpose |
| --- | --- | --- |
| `SLACK_WEBHOOK_URL` | `nightly.yml` / alert workflows | Send workflow notifications to Slack |
| `DISCORD_WEBHOOK_URL` | `nightly.yml` / alert workflows | Send workflow notifications to Discord |

## Required Repository Variables

| Name | Used By | Default |
| --- | --- | --- |
| `STAGING_HEALTHCHECK_URL` | `deploy-staging.yml` | `https://api.dryft.site/health` |
| `PRODUCTION_HEALTHCHECK_URL` | `deploy-production.yml` | `https://api.dryft.site/health` |
| `NIGHTLY_HEALTHCHECK_URL` | `nightly.yml` | `https://api.dryft.site/health` |

## Environments

Create these protected environments in GitHub:

1. `staging`
2. `production`

Recommended protection:

1. Required reviewers for production deploys.
2. Wait timer before production jobs.
3. Restrict which branches can deploy.
