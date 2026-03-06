package admin

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

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
		ErrReasonRequired,
		ErrInvalidStatusFilter,
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

func TestNormalizeVerificationStatus(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		want   string
		hasErr bool
	}{
		{name: "empty", input: "", want: ""},
		{name: "all", input: "all", want: ""},
		{name: "pending", input: "pending", want: "PENDING"},
		{name: "manual_review", input: "manual_review", want: "MANUAL_REVIEW"},
		{name: "verified", input: "verified", want: "VERIFIED"},
		{name: "rejected", input: "rejected", want: "REJECTED"},
		{name: "invalid", input: "foo", hasErr: true},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			got, err := normalizeVerificationStatus(tc.input)
			if tc.hasErr {
				if !errors.Is(err, ErrInvalidStatusFilter) {
					t.Fatalf("expected ErrInvalidStatusFilter, got %v", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("expected %q, got %q", tc.want, got)
			}
		})
	}
}

func TestGetVerifications_InvalidStatusFilter(t *testing.T) {
	svc := NewService(&database.DB{})
	_, _, err := svc.GetVerifications(context.Background(), "bad-status", 10, 0)
	if !errors.Is(err, ErrInvalidStatusFilter) {
		t.Fatalf("expected ErrInvalidStatusFilter, got %v", err)
	}
}

func TestApproveVerification_RequiresAdminRole(t *testing.T) {
	svc := NewService(&database.DB{})
	err := svc.ApproveVerification(context.Background(), uuid.Nil, uuid.New(), "ok")
	if !errors.Is(err, ErrNotAdmin) {
		t.Fatalf("expected ErrNotAdmin, got %v", err)
	}
}

func TestRejectVerification_RequiresReason(t *testing.T) {
	svc := NewService(&database.DB{})
	err := svc.RejectVerification(context.Background(), uuid.New(), uuid.New(), "   ", "note")
	if !errors.Is(err, ErrReasonRequired) {
		t.Fatalf("expected ErrReasonRequired, got %v", err)
	}
}

func TestBanUser_RequiresAdminRole(t *testing.T) {
	svc := NewService(&database.DB{})
	err := svc.BanUser(context.Background(), uuid.Nil, uuid.New(), "violation", "note")
	if !errors.Is(err, ErrNotAdmin) {
		t.Fatalf("expected ErrNotAdmin, got %v", err)
	}
}

func TestBanUser_RequiresReason(t *testing.T) {
	svc := NewService(&database.DB{})
	err := svc.BanUser(context.Background(), uuid.New(), uuid.New(), " ", "note")
	if !errors.Is(err, ErrReasonRequired) {
		t.Fatalf("expected ErrReasonRequired, got %v", err)
	}
}

func TestUnbanUser_RequiresAdminRole(t *testing.T) {
	svc := NewService(&database.DB{})
	err := svc.UnbanUser(context.Background(), uuid.Nil, uuid.New(), "note")
	if !errors.Is(err, ErrNotAdmin) {
		t.Fatalf("expected ErrNotAdmin, got %v", err)
	}
}

func TestReviewReport_RequiresAdminRole(t *testing.T) {
	svc := NewService(&database.DB{})
	err := svc.ReviewReport(context.Background(), uuid.Nil, uuid.New(), "dismiss", "note")
	if !errors.Is(err, ErrNotAdmin) {
		t.Fatalf("expected ErrNotAdmin, got %v", err)
	}
}
