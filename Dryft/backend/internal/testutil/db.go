//go:build integration

package testutil

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/ory/dockertest/v3"
	"github.com/ory/dockertest/v3/docker"
	"gorm.io/gorm"

	"github.com/dryft-app/backend/internal/database"
)

// TestDB holds all database connections for integration tests.
type TestDB struct {
	DB     *database.DB
	GormDB *gorm.DB
	pool   *dockertest.Pool
	res    *dockertest.Resource
	dbURL  string
}

// SetupTestDB spins up a PostgreSQL container and runs migrations.
func SetupTestDB() (*TestDB, error) {
	pool, err := dockertest.NewPool("")
	if err != nil {
		return nil, fmt.Errorf("create docker pool: %w", err)
	}

	pool.MaxWait = 30 * time.Second

	resource, err := pool.RunWithOptions(&dockertest.RunOptions{
		Repository: "postgres",
		Tag:        "16-alpine",
		Env: []string{
			"POSTGRES_USER=dryft_test",
			"POSTGRES_PASSWORD=dryft_test",
			"POSTGRES_DB=dryft_test",
			"listen_addresses='*'",
		},
	}, func(config *docker.HostConfig) {
		config.AutoRemove = true
		config.RestartPolicy = docker.RestartPolicy{Name: "no"}
	})
	if err != nil {
		return nil, fmt.Errorf("start postgres container: %w", err)
	}

	port := resource.GetPort("5432/tcp")
	dbURL := fmt.Sprintf("postgres://dryft_test:dryft_test@localhost:%s/dryft_test?sslmode=disable", port)

	// Wait for Postgres to be ready
	var db *database.DB
	if err := pool.Retry(func() error {
		var err error
		db, err = database.Connect(dbURL)
		if err != nil {
			return err
		}
		return db.Ping(context.Background())
	}); err != nil {
		pool.Purge(resource)
		return nil, fmt.Errorf("connect to test database: %w", err)
	}

	// Run migrations
	if err := db.Migrate(context.Background()); err != nil {
		pool.Purge(resource)
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	// Open GORM connection
	gormDB, err := database.OpenGorm(dbURL)
	if err != nil {
		pool.Purge(resource)
		return nil, fmt.Errorf("open gorm connection: %w", err)
	}

	log.Printf("[testutil] PostgreSQL container ready on port %s", port)

	return &TestDB{
		DB:     db,
		GormDB: gormDB,
		pool:   pool,
		res:    resource,
		dbURL:  dbURL,
	}, nil
}

// Teardown stops the PostgreSQL container.
func (t *TestDB) Teardown() {
	if t.DB != nil {
		t.DB.Close()
	}
	if t.pool != nil && t.res != nil {
		if err := t.pool.Purge(t.res); err != nil {
			log.Printf("[testutil] failed to purge container: %v", err)
		}
	}
}

// TruncateAll removes all data from user-created tables, preserving schema.
func (t *TestDB) TruncateAll(ctx context.Context) error {
	_, err := t.DB.Pool.Exec(ctx, `
		DO $$ DECLARE
			r RECORD;
		BEGIN
			FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'schema_migrations' AND tablename != 'ice_servers') LOOP
				EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
			END LOOP;
		END $$;
	`)
	return err
}

// DatabaseURL returns the connection string for the test database.
func (t *TestDB) DatabaseURL() string {
	return t.dbURL
}
