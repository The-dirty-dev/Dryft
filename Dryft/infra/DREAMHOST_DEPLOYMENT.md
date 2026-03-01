# DreamHost VPS Deployment Runbook

This runbook deploys the Dryft API to a DreamHost VPS using a Linux binary, Supervisor, and NGINX.

## Prerequisites

- SSH access to DreamHost VPS
- Go toolchain on build machine
- `supervisor` and `nginx` installed on VPS
- Production env file available (`.env.prod`)

## 1. Build Linux Binary

Run from repository root:

```bash
cd backend
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o dryft-api ./cmd/dryft-api
```

## 2. Upload Binary and Env

```bash
scp backend/dryft-api user@your-vps:/opt/dryft/bin/dryft-api
scp /Volumes/dryft-code/.env.prod user@your-vps:/opt/dryft/.env
scp infra/nginx/dreamhost-api.dryft.site.conf user@your-vps:/tmp/dreamhost-api.dryft.site.conf
```

## 3. Configure Supervisor

Create `/etc/supervisor/conf.d/dryft-api.conf`:

```ini
[program:dryft-api]
command=/opt/dryft/bin/dryft-api
user=dryft
directory=/opt/dryft
autostart=true
autorestart=true
stopsignal=TERM
stdout_logfile=/var/log/dryft/api.stdout.log
stderr_logfile=/var/log/dryft/api.stderr.log
environment=ENVIRONMENT="production"
```

Apply and start:

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl restart dryft-api
```

## 4. Configure NGINX Reverse Proxy

Install the provided config:

```bash
sudo cp /tmp/dreamhost-api.dryft.site.conf /etc/nginx/conf.d/api.dryft.site.conf
sudo nginx -t
sudo systemctl reload nginx
```

The config proxies `api.dryft.site` to `127.0.0.1:8080` and keeps WebSocket upgrade headers.

## 5. TLS Certificates (Let's Encrypt)

```bash
sudo certbot --nginx -d api.dryft.site
```

## 6. Post-Deploy Verification

```bash
curl -fsS https://api.dryft.site/health
curl -fsS https://api.dryft.site/ready
curl -fsS https://api.dryft.site/metrics | head
sudo supervisorctl status dryft-api
```

## 7. Rollback

- Keep previous binary at `/opt/dryft/bin/dryft-api.prev`
- Roll back by swapping binaries and restarting Supervisor:

```bash
mv /opt/dryft/bin/dryft-api /opt/dryft/bin/dryft-api.bad
mv /opt/dryft/bin/dryft-api.prev /opt/dryft/bin/dryft-api
sudo supervisorctl restart dryft-api
```
