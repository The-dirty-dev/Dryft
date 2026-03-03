package haptic

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/models"
)

func TestJoinStrings(t *testing.T) {
	if got := joinStrings(nil, ","); got != "" {
		t.Fatalf("expected empty string for nil slice, got %q", got)
	}

	if got := joinStrings([]string{"one"}, ","); got != "one" {
		t.Fatalf("expected single value to pass through, got %q", got)
	}

	if got := joinStrings([]string{"one", "two", "three"}, "|"); got != "one|two|three" {
		t.Fatalf("unexpected joined output: %q", got)
	}
}

func TestUpdateDevice_RejectsInvalidIntensityBeforeDB(t *testing.T) {
	svc := &Service{}
	userID := uuid.New()
	deviceID := uuid.New()
	invalid := 1.5

	_, err := svc.UpdateDevice(context.Background(), userID, deviceID, &models.UpdateDeviceRequest{
		MaxIntensity: &invalid,
	})
	if !errors.Is(err, ErrInvalidIntensity) {
		t.Fatalf("expected ErrInvalidIntensity, got %v", err)
	}
}
