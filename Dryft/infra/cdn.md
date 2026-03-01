# CDN Configuration

This document provides a baseline CDN setup for Dryft static assets.

## Recommended CDN

- Cloudflare or AWS CloudFront
- Cache static assets (images, JS, CSS, media)
- Bypass cache for API requests

## Suggested Settings

- **Cache rules**:
  - `/assets/*`, `/images/*`, `/static/*`: cache 7–30 days
  - `/api/*`: bypass cache
- **Compression**: enable Brotli and Gzip
- **TLS**: enforce HTTPS + HSTS (see `infra/nginx/dryft.conf`)

## Invalidation

- Invalidate on deploy (CloudFront) or purge (Cloudflare).
- Automate invalidation as part of release workflow.

## TODO

- Define final CDN provider + custom domain.
- Integrate with asset storage (S3 bucket) and configure cache headers.
