package links

import (
	"strings"
	"testing"
)

func TestServiceUnitGenerateCode_Length(t *testing.T) {
	code, err := GenerateCode(12)
	if err != nil {
		t.Fatalf("generate code: %v", err)
	}
	if len(code) != 12 {
		t.Fatalf("expected length 12, got %d", len(code))
	}
}

func TestServiceUnitBuildLinkURL(t *testing.T) {
	svc := &Service{baseURL: "https://app.dryft.site"}

	tests := []struct {
		linkType LinkType
		wantPath string
	}{
		{linkType: LinkTypeProfile, wantPath: "/profile/abc123"},
		{linkType: LinkTypeVRInvite, wantPath: "/vr/invite/abc123"},
		{linkType: LinkTypePasswordReset, wantPath: "/reset-password/abc123"},
		{linkType: LinkType("custom"), wantPath: "/link/abc123"},
	}

	for _, tc := range tests {
		got := svc.BuildLinkURL(tc.linkType, "abc123")
		if !strings.HasSuffix(got, tc.wantPath) {
			t.Fatalf("expected suffix %q, got %q", tc.wantPath, got)
		}
	}
}

func TestServiceUnitGenerateUUID_Format(t *testing.T) {
	id := generateUUID()
	parts := strings.Split(id, "-")
	if len(parts) != 5 {
		t.Fatalf("expected 5-part uuid-like format, got %q", id)
	}
}
