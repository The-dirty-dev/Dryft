# Dryft Backend Deployment Guide

## Prerequisites

- Go 1.22+
- PostgreSQL 14+ (16+ recommended)
- Redis 7+ (optional; in-memory fallback if omitted)
- AWS account (S3, Rekognition)
- Stripe account
- Firebase project (for push notifications)
- Sentry account (for error tracking)

## Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Fill in all required environment variables (see `.env.example` for descriptions)

## Database Setup

### 1. Apply SQL Migrations (First Time)

If this is a fresh deployment with no existing schema:

```bash
# Apply all migration files in order
for f in internal/database/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done

# Or apply individually:
# psql "$DATABASE_URL" -f internal/database/migrations/001_initial.sql
# psql "$DATABASE_URL" -f internal/database/migrations/002_matching_chat.sql
# ... etc.
```

Alternatively, use [golang-migrate](https://github.com/golang-migrate/migrate):

```bash
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
migrate -path internal/database/migrations -database "$DATABASE_URL" up
```

### 2. Apply Migrations (Subsequent Deployments)

For production deployments, apply only new migration files that haven't been run yet. If using golang-migrate, it tracks which migrations have been applied automatically.

## Deployment Steps

### Local Development

```bash
# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
for f in internal/database/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done

# Start development server (with hot reload via go run)
go run ./cmd/dryft-api
```

### Production (Docker)

1. Build the Docker image:
   ```bash
   docker build -t dryft-backend .
   ```

2. Run with Docker Compose:
   ```bash
   docker-compose up -d
   ```

The `docker-compose.yml` mounts migration SQL files into Postgres's `initdb.d` directory, so migrations are applied automatically on first container start.

### Production (Cloud Providers)

#### Railway / Render / Fly.io

1. Connect your repository
2. Set environment variables in the dashboard
3. Set build command: `go build -o drift-api ./cmd/dryft-api`
4. Set start command: `./dryft-api`
5. Run migrations via a release command or one-off task before deploy

#### AWS ECS / EKS

1. Push image to ECR
2. Configure task definition with environment variables
3. Set up Application Load Balancer
4. Configure RDS for PostgreSQL
5. Configure ElastiCache for Redis

## Post-Deployment Checklist

- [ ] Verify health endpoint: `GET /health`
- [ ] Test authentication flow
- [ ] Verify Stripe webhook connectivity
- [ ] Check Redis connection (if configured)
- [ ] Verify S3 uploads
- [ ] Test push notifications
- [ ] Monitor error tracking (Sentry)

## Rollback Procedure

If a migration fails:

```bash
# If using golang-migrate, roll back one step:
migrate -path internal/database/migrations -database "$DATABASE_URL" down 1

# Or manually revert by running a rollback SQL script
# (create down migrations alongside each up migration for this to work)

# For development only - drop and recreate the database:
dropdb drift && createdb drift
for f in internal/database/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

## Monitoring

### Health Check
```
GET /health
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-25T...",
  "version": "v1"
}
```

### Logs
- Application logs: stdout/stderr
- Request logs: via chi middleware (RequestID, Logger, Recoverer)
- Error tracking: Sentry dashboard

## Security Checklist

- [ ] All secrets in environment variables (not hardcoded)
- [ ] ALLOWED_ORIGINS configured for production domains
- [ ] Rate limiting enabled
- [ ] HTTPS enforced (via load balancer)
- [ ] Database not publicly accessible
- [ ] Redis not publicly accessible
- [ ] Stripe webhook secret configured
- [ ] JWT_SECRET_KEY is strong and at least 32 characters
- [ ] ENCRYPTION_KEY is exactly 32 bytes (required in production)

## Scaling Considerations

- **Horizontal scaling**: The backend is stateless and can run multiple instances
- **Database**: Use connection pooling (PgBouncer) for high concurrency; pgxpool is configured with 25 max connections per instance
- **Redis**: Use Redis Cluster for high availability
- **WebSockets**: Use sticky sessions or a shared pub/sub layer (Redis) for multi-instance WebSocket support

## Troubleshooting

### "Database connection failed"
- Check DATABASE_URL format: `postgres://user:pass@host:5432/dbname?sslmode=disable`
- Verify database is running
- Check network/firewall rules

### "Redis connection failed"
- Check REDIS_URL format
- Verify Redis is running
- Caching will be disabled if Redis is unavailable

### "Stripe webhook signature failed"
- Verify STRIPE_WEBHOOK_SECRET matches Stripe dashboard
- Ensure the webhook endpoint receives the raw request body

### "Migration failed"
- Check database permissions
- Verify no conflicting schema changes
- Review migration SQL for errors
