package database

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool *pgxpool.Pool
}

func Connect(databaseURL string) (*DB, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}

	// Connection pool settings — configurable via env vars for HPA scaling.
	// Default 25/5; set DB_MAX_CONNS=8 per replica when running multiple replicas
	// to stay within RDS db.t4g.micro connection limit (~85 total).
	maxConns := int32(25)
	if v, err := strconv.Atoi(os.Getenv("DB_MAX_CONNS")); err == nil && v > 0 {
		maxConns = int32(v)
	}
	minConns := int32(5)
	if v, err := strconv.Atoi(os.Getenv("DB_MIN_CONNS")); err == nil && v > 0 {
		minConns = int32(v)
	}
	config.MaxConns = maxConns
	config.MinConns = minConns
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute
	config.HealthCheckPeriod = time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return &DB{Pool: pool}, nil
}

func (db *DB) Close() {
	db.Pool.Close()
}

func (db *DB) Ping(ctx context.Context) error {
	return db.Pool.Ping(ctx)
}
