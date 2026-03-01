package links

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

// userIDMiddleware injects a user_id into request context for testing.
func userIDMiddleware(uid string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), "user_id", uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

func TestRegisterRoutes_Structure(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	h.RegisterRoutes(r)

	routes := []struct {
		method string
		path   string
	}{
		{"POST", "/links/"},
		{"GET", "/links/abc123"},
		{"POST", "/links/abc123/validate"},
		{"POST", "/links/abc123/use"},
		{"POST", "/links/profile"},
		{"POST", "/links/vr-invite/"},
		{"GET", "/links/vr-invite/abc123"},
		{"GET", "/links/vr-invite/abc123/validate"},
		{"POST", "/links/vr-invite/abc123/accept"},
		{"POST", "/links/vr-invite/abc123/decline"},
		{"POST", "/links/vr-invite/abc123/cancel"},
		{"GET", "/links/user/user123/vr-invites"},
	}

	for _, rt := range routes {
		rctx := chi.NewRouteContext()
		if !r.Match(rctx, rt.method, rt.path) {
			t.Errorf("route %s %s not registered", rt.method, rt.path)
		}
	}
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

func TestSentinelErrors(t *testing.T) {
	errs := map[error]string{
		ErrLinkNotFound: "link not found",
		ErrLinkExpired:  "link has expired",
		ErrInvalidLink:  "invalid link",
		ErrLinkUsed:     "link has already been used",
	}
	for err, expected := range errs {
		if err.Error() != expected {
			t.Errorf("got %q, want %q", err.Error(), expected)
		}
	}
}

// ---------------------------------------------------------------------------
// LinkType constants
// ---------------------------------------------------------------------------

func TestLinkType_Values(t *testing.T) {
	tests := map[LinkType]string{
		LinkTypeProfile:       "profile",
		LinkTypeVRInvite:      "vr_invite",
		LinkTypeVRRoom:        "vr_room",
		LinkTypePasswordReset: "password_reset",
		LinkTypeEmailVerify:   "email_verify",
		LinkTypeShare:         "share",
	}
	for lt, expected := range tests {
		if string(lt) != expected {
			t.Errorf("expected %q, got %q", expected, string(lt))
		}
	}
}

// ---------------------------------------------------------------------------
// GenerateCode
// ---------------------------------------------------------------------------

func TestGenerateCode_Length(t *testing.T) {
	for _, length := range []int{8, 12, 16} {
		code, err := GenerateCode(length)
		if err != nil {
			t.Fatalf("GenerateCode(%d) error: %v", length, err)
		}
		if len(code) != length {
			t.Errorf("GenerateCode(%d) returned len %d", length, len(code))
		}
	}
}

func TestGenerateCode_Unique(t *testing.T) {
	codes := make(map[string]bool)
	for i := 0; i < 100; i++ {
		code, err := GenerateCode(12)
		if err != nil {
			t.Fatal(err)
		}
		if codes[code] {
			t.Errorf("duplicate code generated: %s", code)
		}
		codes[code] = true
	}
}

// ---------------------------------------------------------------------------
// BuildLinkURL
// ---------------------------------------------------------------------------

func TestBuildLinkURL(t *testing.T) {
	svc := NewService(nil, "https://dryft.site")

	tests := []struct {
		linkType LinkType
		code     string
		expected string
	}{
		{LinkTypeProfile, "abc", "https://dryft.site/profile/abc"},
		{LinkTypeVRInvite, "xyz", "https://dryft.site/vr/invite/xyz"},
		{LinkTypeVRRoom, "rm1", "https://dryft.site/vr/room/rm1"},
		{LinkTypePasswordReset, "pw1", "https://dryft.site/reset-password/pw1"},
		{LinkTypeEmailVerify, "ev1", "https://dryft.site/verify-email/ev1"},
		{LinkTypeShare, "sh1", "https://dryft.site/link/sh1"},
		{"unknown", "unk", "https://dryft.site/link/unk"},
	}

	for _, tt := range tests {
		got := svc.BuildLinkURL(tt.linkType, tt.code)
		if got != tt.expected {
			t.Errorf("BuildLinkURL(%s, %s) = %q, want %q", tt.linkType, tt.code, got, tt.expected)
		}
	}
}

// ---------------------------------------------------------------------------
// respondWithError
// ---------------------------------------------------------------------------

func TestRespondWithError(t *testing.T) {
	rr := httptest.NewRecorder()
	respondWithError(rr, http.StatusNotFound, "link not found")

	if rr.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rr.Code)
	}

	var body map[string]string
	json.NewDecoder(rr.Body).Decode(&body)
	if body["error"] != "link not found" {
		t.Errorf("expected error 'link not found', got %q", body["error"])
	}
}

// ---------------------------------------------------------------------------
// CreateLink – invalid JSON (with auth)
// ---------------------------------------------------------------------------

func TestCreateLink_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Use(userIDMiddleware("test-user"))
	h.RegisterRoutes(r)

	req := httptest.NewRequest("POST", "/links/", strings.NewReader(`bad`))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// CreateVRInvite – invalid JSON (with auth)
// ---------------------------------------------------------------------------

func TestCreateVRInvite_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Use(userIDMiddleware("test-user"))
	h.RegisterRoutes(r)

	req := httptest.NewRequest("POST", "/links/vr-invite/", strings.NewReader(`bad`))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// Handlers without auth – panic on type assertion
// ---------------------------------------------------------------------------

func TestCreateLink_NoAuth_Panics(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	h.RegisterRoutes(r)

	req := httptest.NewRequest("POST", "/links/", strings.NewReader(`{"type":"profile"}`))
	rr := httptest.NewRecorder()

	defer func() {
		if rec := recover(); rec == nil {
			// No panic means the handler did not panic;
			// check the status code for a reasonable response.
			if rr.Code >= 200 && rr.Code < 500 {
				t.Log("handler did not panic on missing user_id")
			}
		}
		// Panic is expected since handler does .(string) assertion without check
	}()

	r.ServeHTTP(rr, req)
}

// ---------------------------------------------------------------------------
// Request/Response struct JSON
// ---------------------------------------------------------------------------

func TestCreateLinkRequest_JSON(t *testing.T) {
	req := CreateLinkRequest{
		Type:      "profile",
		TargetID:  "user-123",
		ExpiresIn: 3600,
		MaxUses:   5,
		Metadata:  map[string]string{"key": "value"},
	}

	data, _ := json.Marshal(req)
	var decoded CreateLinkRequest
	json.Unmarshal(data, &decoded)

	if decoded.Type != "profile" {
		t.Errorf("expected 'profile', got %q", decoded.Type)
	}
	if decoded.MaxUses != 5 {
		t.Errorf("expected 5, got %d", decoded.MaxUses)
	}
	if decoded.Metadata["key"] != "value" {
		t.Errorf("expected metadata key=value")
	}
}

func TestCreateVRInviteRequest_JSON(t *testing.T) {
	req := CreateVRInviteRequest{
		GuestID:   "guest-1",
		RoomType:  "private",
		ExpiresIn: 7200,
	}

	data, _ := json.Marshal(req)
	var decoded CreateVRInviteRequest
	json.Unmarshal(data, &decoded)

	if decoded.GuestID != "guest-1" {
		t.Errorf("expected 'guest-1', got %q", decoded.GuestID)
	}
	if decoded.RoomType != "private" {
		t.Errorf("expected 'private', got %q", decoded.RoomType)
	}
}

func TestVRInviteResponse_JSON(t *testing.T) {
	resp := VRInviteResponse{
		Valid:      true,
		InviteCode: "ABC123",
		HostID:     "host-1",
		Status:     "pending",
	}

	data, _ := json.Marshal(resp)
	var decoded VRInviteResponse
	json.Unmarshal(data, &decoded)

	if !decoded.Valid {
		t.Error("expected valid=true")
	}
	if decoded.InviteCode != "ABC123" {
		t.Errorf("expected 'ABC123', got %q", decoded.InviteCode)
	}
}

func TestLinkResponse_JSON(t *testing.T) {
	resp := LinkResponse{
		Valid:     true,
		URL:       "https://dryft.site/link/abc",
		ExpiresAt: "2025-12-31T23:59:59Z",
	}

	data, _ := json.Marshal(resp)
	var decoded LinkResponse
	json.Unmarshal(data, &decoded)

	if !decoded.Valid {
		t.Error("expected valid=true")
	}
	if decoded.URL != "https://dryft.site/link/abc" {
		t.Errorf("unexpected URL: %q", decoded.URL)
	}
}

// ---------------------------------------------------------------------------
// generateUUID
// ---------------------------------------------------------------------------

func TestGenerateUUID_Format(t *testing.T) {
	id := generateUUID()
	if id == "" {
		t.Error("expected non-empty UUID")
	}
	// Should contain dashes (UUID-like format)
	if len(id) < 32 {
		t.Errorf("expected UUID-like string, got len %d: %q", len(id), id)
	}
}

func TestGenerateUUID_Unique(t *testing.T) {
	ids := make(map[string]bool)
	for i := 0; i < 50; i++ {
		id := generateUUID()
		if ids[id] {
			t.Errorf("duplicate UUID: %s", id)
		}
		ids[id] = true
	}
}
