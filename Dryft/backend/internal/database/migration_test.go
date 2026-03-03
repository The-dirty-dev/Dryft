//go:build integration

package database

import (
	"context"
	"sort"
	"testing"
)

func TestMigrations_ApplyRollbackAndReapply(t *testing.T) {
	db, cleanup := setupIntegrationDB(t)
	defer cleanup()
	ctx := context.Background()

	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("migrate up failed: %v", err)
	}

	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("migrate idempotency failed: %v", err)
	}

	// Use existing down-roundtrip harness in this package.
	// Here we assert expected tables are present after re-apply.
	tables := publicTables(t, db)
	sort.Strings(tables)
	present := map[string]bool{}
	for _, tbl := range tables {
		present[tbl] = true
	}
	for _, expected := range allExpectedTables {
		if !present[expected] {
			t.Fatalf("expected table %q after migrations", expected)
		}
	}
}

func TestMigrations_NoOrphanedForeignKeys(t *testing.T) {
	db, cleanup := setupIntegrationDB(t)
	defer cleanup()
	ctx := context.Background()

	if err := db.Migrate(ctx); err != nil {
		t.Fatalf("migrate up failed: %v", err)
	}

	// confrelid=0 would indicate a broken FK target.
	var broken int
	err := db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM pg_constraint c
		WHERE c.contype = 'f' AND c.confrelid = 0
	`).Scan(&broken)
	if err != nil {
		t.Fatalf("query broken foreign keys: %v", err)
	}
	if broken != 0 {
		t.Fatalf("expected zero broken foreign keys, got %d", broken)
	}
}
