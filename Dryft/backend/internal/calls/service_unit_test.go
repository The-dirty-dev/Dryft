package calls

import (
	"testing"
	"time"
)

func TestNullTime(t *testing.T) {
	if got := nullTime(time.Time{}); got != nil {
		t.Fatal("expected nil for zero time")
	}

	now := time.Now().UTC()
	got := nullTime(now)
	if got == nil {
		t.Fatal("expected non-nil for non-zero time")
	}
	if !got.Equal(now) {
		t.Fatalf("expected %s, got %s", now, *got)
	}
}
