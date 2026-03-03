package verification

import (
	"strings"
	"testing"
)

func TestGenerateUUID_Format(t *testing.T) {
	id := generateUUID()
	parts := strings.Split(id, "-")
	if len(parts) != 5 {
		t.Fatalf("expected UUID-like 5-part string, got %q", id)
	}
}

func TestGenerateNumericCode_LengthAndDigits(t *testing.T) {
	code, err := generateNumericCode(6)
	if err != nil {
		t.Fatalf("generate numeric code: %v", err)
	}
	if len(code) != 6 {
		t.Fatalf("expected length 6, got %d (%q)", len(code), code)
	}
	for _, r := range code {
		if r < '0' || r > '9' {
			t.Fatalf("expected digits only, got %q", code)
		}
	}
}

func TestVerificationStatusConstants(t *testing.T) {
	if StatusPending != "pending" {
		t.Fatalf("unexpected StatusPending: %s", StatusPending)
	}
	if StatusApproved != "approved" {
		t.Fatalf("unexpected StatusApproved: %s", StatusApproved)
	}
	if StatusRejected != "rejected" {
		t.Fatalf("unexpected StatusRejected: %s", StatusRejected)
	}
}
