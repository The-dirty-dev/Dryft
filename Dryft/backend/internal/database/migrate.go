package database

import (
	"context"
	"embed"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"time"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// Migrate runs all pending SQL migrations in order.
// It tracks applied migrations in a schema_migrations table.
func (db *DB) Migrate(ctx context.Context) error {
	// Create migrations tracking table
	_, err := db.Pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("create schema_migrations table: %w", err)
	}

	// Read available migration files
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations directory: %w", err)
	}

	// Sort by filename (ensures numeric order)
	// Only include "up" migrations (exclude .down.sql files)
	var filenames []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") && !strings.HasSuffix(e.Name(), ".down.sql") {
			filenames = append(filenames, e.Name())
		}
	}
	sort.Strings(filenames)

	// Get already-applied migrations
	rows, err := db.Pool.Query(ctx, "SELECT version FROM schema_migrations")
	if err != nil {
		return fmt.Errorf("query applied migrations: %w", err)
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return fmt.Errorf("scan migration version: %w", err)
		}
		applied[version] = true
	}

	// Run pending migrations
	for _, filename := range filenames {
		if applied[filename] {
			continue
		}

		slog.Info("running migration", "file", filename)
		start := time.Now()

		content, err := migrationFS.ReadFile("migrations/" + filename)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", filename, err)
		}

		tx, err := db.Pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("begin transaction for %s: %w", filename, err)
		}

		if _, err := tx.Exec(ctx, string(content)); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("execute migration %s: %w", filename, err)
		}

		if _, err := tx.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", filename); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("record migration %s: %w", filename, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit migration %s: %w", filename, err)
		}

		slog.Info("migration applied", "file", filename, "duration", time.Since(start))
	}

	return nil
}
