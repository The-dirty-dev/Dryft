package database

import (
	"fmt"
	"sort"
	"strings"
	"testing"
)

// readMigrationFilenames returns the sorted list of .sql filenames from the
// embedded migrations directory. It fails the test if the directory cannot be
// read.
func readMigrationFilenames(t *testing.T) []string {
	t.Helper()

	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		t.Fatalf("failed to read embedded migrations directory: %v", err)
	}

	var filenames []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			filenames = append(filenames, e.Name())
		}
	}
	sort.Strings(filenames)
	return filenames
}

// TestMigrationFS_ContainsExpectedFiles verifies that the embedded filesystem
// contains exactly the migration files numbered 001 through 010, each with
// both an up (.sql) and down (.down.sql) migration.
func TestMigrationFS_ContainsExpectedFiles(t *testing.T) {
	filenames := readMigrationFilenames(t)

	// Separate up and down migrations.
	upPrefixes := make(map[string]bool)
	downPrefixes := make(map[string]bool)
	for _, f := range filenames {
		if len(f) < 3 {
			t.Errorf("migration filename too short to contain a prefix: %q", f)
			continue
		}
		prefix := f[:3]
		if strings.HasSuffix(f, ".down.sql") {
			downPrefixes[prefix] = true
		} else {
			upPrefixes[prefix] = true
		}
	}

	// Expect prefixes 001 through 010 for both up and down.
	for i := 1; i <= 10; i++ {
		prefix := fmt.Sprintf("%03d", i)
		if !upPrefixes[prefix] {
			t.Errorf("expected an up migration file with prefix %s but none was found", prefix)
		}
		if !downPrefixes[prefix] {
			t.Errorf("expected a down migration file with prefix %s but none was found", prefix)
		}
	}

	// 10 up + 10 down = 20 total.
	if len(filenames) != 20 {
		t.Errorf("expected 20 migration files (10 up + 10 down), got %d: %v", len(filenames), filenames)
	}
}

// TestMigrationFS_FilenamesAreSorted verifies that the filenames returned from
// the embedded FS, once collected and sorted with sort.Strings (the same
// approach used by Migrate), are in strictly ascending order.
func TestMigrationFS_FilenamesAreSorted(t *testing.T) {
	filenames := readMigrationFilenames(t)

	if len(filenames) == 0 {
		t.Fatal("no migration files found in embedded FS")
	}

	for i := 1; i < len(filenames); i++ {
		if filenames[i-1] >= filenames[i] {
			t.Errorf("migrations not in strict ascending order: %q should come before %q",
				filenames[i-1], filenames[i])
		}
	}
}

// TestMigrationFS_NoDuplicatePrefixes verifies that no two up migration files
// share the same numeric prefix, and no two down migration files share the same
// numeric prefix (e.g. two up files both starting with "003").
func TestMigrationFS_NoDuplicatePrefixes(t *testing.T) {
	filenames := readMigrationFilenames(t)

	seenUp := make(map[string]string)
	seenDown := make(map[string]string)
	for _, f := range filenames {
		// Extract the prefix up to the first underscore.
		idx := strings.Index(f, "_")
		if idx == -1 {
			t.Errorf("migration filename %q has no underscore separator", f)
			continue
		}
		prefix := f[:idx]

		isDown := strings.HasSuffix(f, ".down.sql")
		if isDown {
			if prev, ok := seenDown[prefix]; ok {
				t.Errorf("duplicate down migration prefix %q: %q and %q", prefix, prev, f)
			}
			seenDown[prefix] = f
		} else {
			if prev, ok := seenUp[prefix]; ok {
				t.Errorf("duplicate up migration prefix %q: %q and %q", prefix, prev, f)
			}
			seenUp[prefix] = f
		}
	}
}
