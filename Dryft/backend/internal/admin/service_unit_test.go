package admin

import (
	"testing"

	"github.com/dryft-app/backend/internal/database"
)

func TestNewService_AssignsDB(t *testing.T) {
	db := &database.DB{}
	svc := NewService(db)
	if svc == nil {
		t.Fatal("expected service instance")
	}
	if svc.db != db {
		t.Fatal("expected service to retain provided DB reference")
	}
}

func TestAdminErrorSentinels_AreDefinedAndDistinct(t *testing.T) {
	errors := []error{
		ErrUserNotFound,
		ErrVerificationNotFound,
		ErrReportNotFound,
		ErrNotAdmin,
	}

	seen := map[string]bool{}
	for _, err := range errors {
		if err == nil {
			t.Fatal("expected non-nil sentinel error")
		}
		msg := err.Error()
		if msg == "" {
			t.Fatal("expected non-empty sentinel error message")
		}
		if seen[msg] {
			t.Fatalf("expected unique sentinel error message, duplicate: %q", msg)
		}
		seen[msg] = true
	}
}
