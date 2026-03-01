# Dryft Security Overview

This document summarizes security-relevant flows in the Dryft platform. It is a high-level overview and should be kept in sync with the backend implementation.

## Authentication Flow

- **Auth endpoints**: `POST /v1/auth/register`, `POST /v1/auth/login`, `POST /v1/auth/refresh`.
- **Tokens**: JWT access tokens are required for protected routes.
- **Headers**: `Authorization: Bearer <access_token>`.

## Verification Pipeline

Dryft uses a layered verification approach:

1. **Age gate** (`/v1/age-gate/*`)
   - Card and ID verification flows with status polling.
2. **Verification services** (`/v1/verification/*`)
   - Photo, phone, email, ID, and social verification endpoints.

Certain routes (profile, discovery, matches, sessions, haptics) require a verified user.

## Content Moderation & Safety

Safety-related endpoints:

- Block/unblock users: `/v1/safety/block`, `/v1/safety/block/:userId`
- Reports: `/v1/safety/report`, `/v1/safety/reports`
- Warnings & admin tooling: `/v1/admin/safety/*`

Moderation warnings are delivered via WebSocket events (`safety_warning`).

## Rate Limiting

The API applies IP-based rate limits:

- Default: **100 requests / 15 minutes per IP**.
- Redis is used when configured; otherwise an in-memory limiter is used.

## Data Encryption

- **At rest**: `ENCRYPTION_KEY` is required in production and should be 32 bytes.
- **In transit**: All production traffic should use TLS (HTTPS/WSS).
- **Secrets**: Stripe, Firebase, APNs, and AWS credentials must be provided via environment variables.

## WebSocket Security

- WebSocket access requires authentication and verified status.
- Browser clients may use `?token=<JWT>` for the WebSocket upgrade.
- Origins are validated in production via `ALLOWED_ORIGINS`.

## Reporting Security Issues

If you discover a vulnerability, please report it privately to the Dryft security team rather than opening a public issue.
