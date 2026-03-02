//go:build integration

package database

import (
	"context"
	"fmt"
	"log"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/ory/dockertest/v3"
	"github.com/ory/dockertest/v3/docker"
)

// setupIntegrationDB spins up a fresh postgres:16-alpine container and returns
// a connected *DB. The caller is responsible for calling cleanup().
func setupIntegrationDB(t *testing.T) (db *DB, cleanup func()) {
	t.Helper()

	pool, err := dockertest.NewPool("")
	if err != nil {
		t.Fatalf("create docker pool: %v", err)
	}
	pool.MaxWait = 60 * time.Second

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
		t.Fatalf("start postgres container: %v", err)
	}

	port := resource.GetPort("5432/tcp")
	dbURL := fmt.Sprintf(
		"postgres://dryft_test:dryft_test@localhost:%s/dryft_test?sslmode=disable",
		port,
	)

	var connected *DB
	if err := pool.Retry(func() error {
		var connErr error
		connected, connErr = Connect(dbURL)
		if connErr != nil {
			return connErr
		}
		return connected.Ping(context.Background())
	}); err != nil {
		_ = pool.Purge(resource)
		t.Fatalf("connect to test database: %v", err)
	}

	log.Printf("[migrate_integration_test] postgres ready on port %s", port)

	return connected, func() {
		if connected != nil {
			connected.Close()
		}
		if err := pool.Purge(resource); err != nil {
			log.Printf("[migrate_integration_test] failed to purge container: %v", err)
		}
	}
}

// allExpectedTables is the canonical list of the 31 application tables created
// by migrations 001–010. It excludes schema_migrations (the tracker table).
var allExpectedTables = []string{
	"account_deletion_requests",
	"admin_actions",
	"admins",
	"call_history",
	"companion_sessions",
	"conversations",
	"creator_payouts",
	"creators",
	"haptic_command_log",
	"haptic_devices",
	"haptic_patterns",
	"haptic_permissions",
	"ice_servers",
	"item_categories",
	"item_reviews",
	"matches",
	"messages",
	"notification_history",
	"purchases",
	"push_devices",
	"session_haptic_permissions",
	"session_messages",
	"session_participants",
	"store_items",
	"swipes",
	"user_inventory",
	"user_reports",
	"users",
	"verification_attempts",
	"voip_devices",
	"vr_sessions",
}

// publicTables queries pg_tables for all user-created tables in the public schema.
func publicTables(t *testing.T, db *DB) []string {
	t.Helper()
	ctx := context.Background()

	rows, err := db.Pool.Query(ctx,
		"SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
	)
	if err != nil {
		t.Fatalf("query pg_tables: %v", err)
	}
	defer rows.Close()

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatalf("scan tablename: %v", err)
		}
		tables = append(tables, name)
	}
	return tables
}

// TestMigrate_UpRoundTrip verifies that Migrate() creates every expected table.
func TestMigrate_UpRoundTrip(t *testing.T) {
	db, cleanup := setupIntegrationDB(t)
	defer cleanup()

	ctx := context.Background()
	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("Migrate() returned error: %v", err)
	}

	got := publicTables(t, db)

	// Build a set of present tables (excluding schema_migrations).
	present := make(map[string]bool, len(got))
	for _, tbl := range got {
		if tbl != "schema_migrations" {
			present[tbl] = true
		}
	}

	for _, want := range allExpectedTables {
		if !present[want] {
			t.Errorf("expected table %q to exist after Migrate(), but it was not found", want)
		}
	}

	// Also assert no unexpected extra tables crept in.
	expected := make(map[string]bool, len(allExpectedTables))
	for _, tbl := range allExpectedTables {
		expected[tbl] = true
	}
	for tbl := range present {
		if !expected[tbl] {
			t.Errorf("unexpected table %q found after Migrate()", tbl)
		}
	}
}

// TestMigrate_Idempotent verifies that calling Migrate() twice does not error.
func TestMigrate_Idempotent(t *testing.T) {
	db, cleanup := setupIntegrationDB(t)
	defer cleanup()

	ctx := context.Background()

	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("first Migrate() returned error: %v", err)
	}
	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("second Migrate() returned error: %v", err)
	}
}

// TestMigrate_RecordsAppliedVersions verifies that schema_migrations has exactly
// one row per up-migration file (10 rows for migrations 001–010).
func TestMigrate_RecordsAppliedVersions(t *testing.T) {
	db, cleanup := setupIntegrationDB(t)
	defer cleanup()

	ctx := context.Background()
	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("Migrate() returned error: %v", err)
	}

	rows, err := db.Pool.Query(ctx, "SELECT version FROM schema_migrations ORDER BY version")
	if err != nil {
		t.Fatalf("query schema_migrations: %v", err)
	}
	defer rows.Close()

	var versions []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			t.Fatalf("scan version: %v", err)
		}
		versions = append(versions, v)
	}

	// Collect the up-migration filenames from the embedded FS for comparison.
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		t.Fatalf("read embedded migrations: %v", err)
	}
	var upFiles []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") && !strings.HasSuffix(e.Name(), ".down.sql") {
			upFiles = append(upFiles, e.Name())
		}
	}
	sort.Strings(upFiles)

	if len(versions) != len(upFiles) {
		t.Fatalf("schema_migrations has %d rows, want %d", len(versions), len(upFiles))
	}

	for i, v := range versions {
		if v != upFiles[i] {
			t.Errorf("schema_migrations row %d: got %q, want %q", i, v, upFiles[i])
		}
	}
}

// TestMigrate_DownRoundTrip verifies that running all down migrations in reverse
// order drops every application table, leaving only schema_migrations (which the
// down migrations do not touch).
func TestMigrate_DownRoundTrip(t *testing.T) {
	db, cleanup := setupIntegrationDB(t)
	defer cleanup()

	ctx := context.Background()

	// Step 1: Run all up migrations.
	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("Migrate() returned error: %v", err)
	}

	// Step 2: Collect down-migration files in descending order (reverse of up).
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		t.Fatalf("read embedded migrations: %v", err)
	}
	var downFiles []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".down.sql") {
			downFiles = append(downFiles, e.Name())
		}
	}
	sort.Sort(sort.Reverse(sort.StringSlice(downFiles)))

	// Step 3: Execute each down migration in a transaction.
	for _, filename := range downFiles {
		content, err := migrationFS.ReadFile("migrations/" + filename)
		if err != nil {
			t.Fatalf("read down migration %s: %v", filename, err)
		}

		tx, err := db.Pool.Begin(ctx)
		if err != nil {
			t.Fatalf("begin transaction for %s: %v", filename, err)
		}

		if _, err := tx.Exec(ctx, string(content)); err != nil {
			_ = tx.Rollback(ctx)
			t.Fatalf("execute down migration %s: %v", filename, err)
		}

		if err := tx.Commit(ctx); err != nil {
			t.Fatalf("commit down migration %s: %v", filename, err)
		}
	}

	// Step 4: Assert all application tables are gone.
	remaining := publicTables(t, db)

	// schema_migrations itself is never dropped by down files — that's expected.
	for _, tbl := range remaining {
		if tbl == "schema_migrations" {
			continue
		}
		t.Errorf("table %q still exists after all down migrations were applied", tbl)
	}
}
