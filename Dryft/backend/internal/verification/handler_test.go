package verification

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

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
	h := NewHandler(nil, nil)
	r := chi.NewRouter()
	h.RegisterRoutes(r)

	routes := []struct {
		method string
		path   string
	}{
		{"GET", "/verification/status"},
		{"GET", "/verification/score"},
		{"POST", "/verification/photo"},
		{"POST", "/verification/phone/send"},
		{"POST", "/verification/phone/verify"},
		{"POST", "/verification/email/send"},
		{"POST", "/verification/email/verify"},
		{"POST", "/verification/id"},
		{"POST", "/verification/social"},
		{"GET", "/verification/admin/pending"},
		{"POST", "/verification/admin/abc123/review"},
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
		ErrVerificationNotFound: "verification not found",
		ErrAlreadyVerified:      "already verified",
		ErrInvalidCode:          "invalid verification code",
		ErrCodeExpired:          "verification code expired",
		ErrTooManyAttempts:      "too many verification attempts",
		ErrUnsupportedProvider:  "unsupported social provider",
		ErrInvalidSocialToken:   "invalid or expired social token",
	}
	for err, expected := range errs {
		if err.Error() != expected {
			t.Errorf("got %q, want %q", err.Error(), expected)
		}
	}
}

// ---------------------------------------------------------------------------
// VerificationType / VerificationStatus constants
// ---------------------------------------------------------------------------

func TestVerificationType_Values(t *testing.T) {
	types := map[VerificationType]string{
		TypePhoto:  "photo",
		TypePhone:  "phone",
		TypeEmail:  "email",
		TypeID:     "id",
		TypeSocial: "social",
	}
	for vt, expected := range types {
		if string(vt) != expected {
			t.Errorf("expected %q, got %q", expected, string(vt))
		}
	}
}

func TestVerificationStatus_Values(t *testing.T) {
	statuses := map[VerificationStatus]string{
		StatusNone:     "none",
		StatusPending:  "pending",
		StatusInReview: "in_review",
		StatusApproved: "approved",
		StatusRejected: "rejected",
		StatusExpired:  "expired",
	}
	for vs, expected := range statuses {
		if string(vs) != expected {
			t.Errorf("expected %q, got %q", expected, string(vs))
		}
	}
}

// ---------------------------------------------------------------------------
// Handler validation – invalid JSON (with auth middleware)
// ---------------------------------------------------------------------------

func TestSendPhoneVerification_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil)
	r := chi.NewRouter()
	r.Use(userIDMiddleware("test-user"))
	h.RegisterRoutes(r)

	req := httptest.NewRequest("POST", "/verification/phone/send", strings.NewReader(`bad`))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestVerifyPhoneCode_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil)
	r := chi.NewRouter()
	r.Use(userIDMiddleware("test-user"))
	h.RegisterRoutes(r)

	req := httptest.NewRequest("POST", "/verification/phone/verify", strings.NewReader(`bad`))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestVerifyEmailCode_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil)
	r := chi.NewRouter()
	r.Use(userIDMiddleware("test-user"))
	h.RegisterRoutes(r)

	req := httptest.NewRequest("POST", "/verification/email/verify", strings.NewReader(`bad`))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestConnectSocialAccount_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil)
	r := chi.NewRouter()
	r.Use(userIDMiddleware("test-user"))
	h.RegisterRoutes(r)

	req := httptest.NewRequest("POST", "/verification/social", strings.NewReader(`bad`))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestConnectSocialAccount_MissingFields(t *testing.T) {
	h := NewHandler(nil, nil)
	r := chi.NewRouter()
	r.Use(userIDMiddleware("test-user"))
	h.RegisterRoutes(r)

	// Missing token
	req := httptest.NewRequest("POST", "/verification/social",
		strings.NewReader(`{"provider":"google"}`))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestReviewVerification_InvalidJSON(t *testing.T) {
	h := NewHandler(nil, nil)
	r := chi.NewRouter()
	r.Use(userIDMiddleware("admin-user"))
	h.RegisterRoutes(r)

	req := httptest.NewRequest("POST", "/verification/admin/abc123/review", strings.NewReader(`bad`))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestSendEmailVerification_MissingEmail(t *testing.T) {
	h := NewHandler(nil, nil)
	r := chi.NewRouter()
	r.Use(userIDMiddleware("test-user"))
	h.RegisterRoutes(r)

	// No email query param
	req := httptest.NewRequest("POST", "/verification/email/send", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// Request/Response struct JSON
// ---------------------------------------------------------------------------

func TestSendPhoneRequest_JSON(t *testing.T) {
	req := SendPhoneRequest{PhoneNumber: "+15551234567"}
	data, _ := json.Marshal(req)
	var decoded SendPhoneRequest
	json.Unmarshal(data, &decoded)
	if decoded.PhoneNumber != "+15551234567" {
		t.Errorf("expected phone number, got %q", decoded.PhoneNumber)
	}
}

func TestVerifyCodeRequest_JSON(t *testing.T) {
	req := VerifyCodeRequest{VerificationID: "abc", Code: "123456"}
	data, _ := json.Marshal(req)
	var decoded VerifyCodeRequest
	json.Unmarshal(data, &decoded)
	if decoded.Code != "123456" {
		t.Errorf("expected '123456', got %q", decoded.Code)
	}
}

func TestVerifyEmailRequest_JSON(t *testing.T) {
	req := VerifyEmailRequest{Token: "abc123"}
	data, _ := json.Marshal(req)
	var decoded VerifyEmailRequest
	json.Unmarshal(data, &decoded)
	if decoded.Token != "abc123" {
		t.Errorf("expected 'abc123', got %q", decoded.Token)
	}
}

func TestSocialConnectRequest_JSON(t *testing.T) {
	req := SocialConnectRequest{Provider: "google", Token: "xyz"}
	data, _ := json.Marshal(req)
	var decoded SocialConnectRequest
	json.Unmarshal(data, &decoded)
	if decoded.Provider != "google" {
		t.Errorf("expected 'google', got %q", decoded.Provider)
	}
}

func TestReviewRequest_JSON(t *testing.T) {
	req := ReviewRequest{Approved: false, Reason: "blurry photo"}
	data, _ := json.Marshal(req)
	var decoded ReviewRequest
	json.Unmarshal(data, &decoded)
	if decoded.Approved {
		t.Error("expected approved=false")
	}
	if decoded.Reason != "blurry photo" {
		t.Errorf("expected 'blurry photo', got %q", decoded.Reason)
	}
}

func TestVerificationStatusResponse_JSON(t *testing.T) {
	resp := VerificationStatusResponse{
		TrustScore: 75,
		IsVerified: true,
		Verifications: []VerificationResponse{
			{Type: "phone", Status: "approved"},
		},
	}
	data, _ := json.Marshal(resp)
	var decoded VerificationStatusResponse
	json.Unmarshal(data, &decoded)
	if decoded.TrustScore != 75 {
		t.Errorf("expected 75, got %d", decoded.TrustScore)
	}
	if !decoded.IsVerified {
		t.Error("expected is_verified=true")
	}
	if len(decoded.Verifications) != 1 {
		t.Errorf("expected 1 verification, got %d", len(decoded.Verifications))
	}
}

// ---------------------------------------------------------------------------
// SocialValidator
// ---------------------------------------------------------------------------

func TestNewSocialValidator(t *testing.T) {
	v := NewSocialValidator("my-client-id")
	if v == nil {
		t.Fatal("expected non-nil validator")
	}
	if v.googleClientID != "my-client-id" {
		t.Errorf("expected 'my-client-id', got %q", v.googleClientID)
	}
	if v.httpClient == nil {
		t.Error("expected non-nil httpClient")
	}
}

func TestSocialValidator_UnsupportedProvider(t *testing.T) {
	v := NewSocialValidator("")
	_, err := v.Validate(context.Background(), "twitter", "token123")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "unsupported social provider") {
		t.Errorf("unexpected error: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Apple JWT validation
// ---------------------------------------------------------------------------

func TestValidateApple_InvalidTokenFormat(t *testing.T) {
	v := NewSocialValidator("")
	_, err := v.validateApple(context.Background(), "not-a-jwt")
	if err != ErrInvalidSocialToken {
		t.Errorf("expected ErrInvalidSocialToken, got %v", err)
	}
}

func TestValidateApple_InvalidBase64(t *testing.T) {
	v := NewSocialValidator("")
	_, err := v.validateApple(context.Background(), "header.!!!invalid!!!.signature")
	if err != ErrInvalidSocialToken {
		t.Errorf("expected ErrInvalidSocialToken, got %v", err)
	}
}

func TestValidateApple_BadIssuer(t *testing.T) {
	v := NewSocialValidator("")
	payload := base64.RawURLEncoding.EncodeToString([]byte(
		fmt.Sprintf(`{"iss":"https://bad.com","sub":"user1","exp":%d}`, time.Now().Add(time.Hour).Unix()),
	))
	token := "header." + payload + ".signature"
	_, err := v.validateApple(context.Background(), token)
	if err != ErrInvalidSocialToken {
		t.Errorf("expected ErrInvalidSocialToken, got %v", err)
	}
}

func TestValidateApple_Expired(t *testing.T) {
	v := NewSocialValidator("")
	payload := base64.RawURLEncoding.EncodeToString([]byte(
		`{"iss":"https://appleid.apple.com","sub":"user1","exp":1000000000}`))
	token := "header." + payload + ".signature"
	_, err := v.validateApple(context.Background(), token)
	if err != ErrInvalidSocialToken {
		t.Errorf("expected ErrInvalidSocialToken, got %v", err)
	}
}

func TestValidateApple_EmptySub(t *testing.T) {
	v := NewSocialValidator("")
	payload := base64.RawURLEncoding.EncodeToString([]byte(
		fmt.Sprintf(`{"iss":"https://appleid.apple.com","sub":"","exp":%d}`, time.Now().Add(time.Hour).Unix()),
	))
	token := "header." + payload + ".signature"
	_, err := v.validateApple(context.Background(), token)
	if err != ErrInvalidSocialToken {
		t.Errorf("expected ErrInvalidSocialToken, got %v", err)
	}
}

func TestValidateApple_Valid(t *testing.T) {
	v := NewSocialValidator("")
	payload := base64.RawURLEncoding.EncodeToString([]byte(
		fmt.Sprintf(`{"iss":"https://appleid.apple.com","sub":"apple-user-123","email":"test@icloud.com","exp":%d}`,
			time.Now().Add(time.Hour).Unix()),
	))
	token := "header." + payload + ".signature"
	profile, err := v.validateApple(context.Background(), token)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if profile.ID != "apple-user-123" {
		t.Errorf("expected 'apple-user-123', got %q", profile.ID)
	}
	if profile.Email != "test@icloud.com" {
		t.Errorf("expected 'test@icloud.com', got %q", profile.Email)
	}
}

// ---------------------------------------------------------------------------
// SocialProfile struct
// ---------------------------------------------------------------------------

func TestSocialProfile_Fields(t *testing.T) {
	p := SocialProfile{ID: "user-1", Email: "test@example.com"}
	if p.ID != "user-1" {
		t.Errorf("expected 'user-1', got %q", p.ID)
	}
	if p.Email != "test@example.com" {
		t.Errorf("expected 'test@example.com', got %q", p.Email)
	}
}
