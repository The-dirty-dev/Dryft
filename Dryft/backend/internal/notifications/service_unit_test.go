package notifications

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestRegisterDevice_RejectsEmptyToken(t *testing.T) {
	svc := &Service{}
	_, err := svc.RegisterDevice(context.Background(), uuid.New(), "", PlatformIOS, "device-1", "1.0.0")
	if !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("expected ErrInvalidToken, got %v", err)
	}
}

func TestRegisterVoIPDevice_RejectsMissingFields(t *testing.T) {
	svc := &Service{}
	_, err := svc.RegisterVoIPDevice(context.Background(), uuid.New(), "", "")
	if !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("expected ErrInvalidToken, got %v", err)
	}
}

func TestGetRateLimitStats_ContainsExpectedKeys(t *testing.T) {
	svc := &Service{
		rateLimiter: NewRateLimiter(),
	}
	defer svc.rateLimiter.Stop()

	stats := svc.GetRateLimitStats(uuid.New())
	limits, ok := stats["limits"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected limits map in stats, got %+v", stats)
	}
	keys := []string{"new_match", "new_message", "new_like", "system"}
	for _, key := range keys {
		if _, ok := limits[key]; !ok {
			t.Fatalf("expected stats key %q", key)
		}
	}
}
