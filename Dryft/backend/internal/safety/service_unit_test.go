package safety

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestBlockUser_RejectsSelfBlock(t *testing.T) {
	svc := NewService(nil)
	userID := uuid.New()
	err := svc.BlockUser(context.Background(), userID, userID, "reason")
	if !errors.Is(err, ErrCannotBlockSelf) {
		t.Fatalf("expected ErrCannotBlockSelf, got %v", err)
	}
}

func TestSubmitReport_RejectsInvalidCategory(t *testing.T) {
	svc := NewService(nil)
	report := &Report{
		ReporterID:     uuid.New(),
		ReportedUserID: uuid.New(),
		Category:       "not-valid",
		Reason:         "spam",
	}

	err := svc.SubmitReport(context.Background(), report)
	if !errors.Is(err, ErrInvalidCategory) {
		t.Fatalf("expected ErrInvalidCategory, got %v", err)
	}
}

func TestServiceIsValidCategory(t *testing.T) {
	if !isValidCategory("spam") {
		t.Fatal("expected spam to be valid category")
	}
	if isValidCategory("invalid-category") {
		t.Fatal("expected invalid-category to be rejected")
	}
}
