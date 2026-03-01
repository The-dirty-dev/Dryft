package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
)

// mockValidator implements TokenValidator for testing.
type mockValidator struct {
	claims *TokenClaims
	err    error
}

func (m *mockValidator) ValidateToken(token string) (*TokenClaims, error) {
	return m.claims, m.err
}

// okHandler is a simple handler that writes 200 OK.
func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
}

// --- extractBearerToken tests ---

func TestExtractBearerToken(t *testing.T) {
	tests := []struct {
		name     string
		header   string
		expected string
	}{
		{"valid bearer token", "Bearer abc123", "abc123"},
		{"lowercase bearer", "bearer abc123", "abc123"},
		{"mixed case bearer", "BEARER abc123", "abc123"},
		{"empty header", "", ""},
		{"no bearer prefix", "abc123", ""},
		{"bearer with no token value", "Bearer", ""},
		{"too many parts", "Bearer abc 123", ""},
		{"basic auth", "Basic dXNlcjpwYXNz", ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tc.header != "" {
				req.Header.Set("Authorization", tc.header)
			}

			got := extractBearerToken(req)
			if got != tc.expected {
				t.Errorf("extractBearerToken() = %q, want %q", got, tc.expected)
			}
		})
	}
}

// --- RequireAuth tests ---

func TestRequireAuth_ValidToken(t *testing.T) {
	userID := uuid.New()
	validator := &mockValidator{
		claims: &TokenClaims{
			UserID:   userID.String(),
			Email:    "alice@example.com",
			Verified: true,
		},
	}
	mw := NewAuthMiddleware(validator)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer valid-token")

	rr := httptest.NewRecorder()

	var capturedUserID uuid.UUID
	var capturedEmail string
	var capturedVerified bool
	var ctxHasValues bool

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, ok1 := r.Context().Value(UserIDKey).(uuid.UUID)
		email, ok2 := r.Context().Value(UserEmailKey).(string)
		verified, ok3 := r.Context().Value(VerifiedKey).(bool)
		ctxHasValues = ok1 && ok2 && ok3
		capturedUserID = id
		capturedEmail = email
		capturedVerified = verified
		w.WriteHeader(http.StatusOK)
	})

	mw.RequireAuth(inner).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rr.Code)
	}
	if !ctxHasValues {
		t.Fatal("expected context to contain user values")
	}
	if capturedUserID != userID {
		t.Errorf("expected UserID %s, got %s", userID, capturedUserID)
	}
	if capturedEmail != "alice@example.com" {
		t.Errorf("expected email %q, got %q", "alice@example.com", capturedEmail)
	}
	if capturedVerified != true {
		t.Errorf("expected verified=true, got %v", capturedVerified)
	}
}

func TestRequireAuth_MissingToken(t *testing.T) {
	validator := &mockValidator{}
	mw := NewAuthMiddleware(validator)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	// No Authorization header set
	rr := httptest.NewRecorder()

	mw.RequireAuth(okHandler()).ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", rr.Code)
	}
}

func TestRequireAuth_InvalidToken(t *testing.T) {
	validator := &mockValidator{
		err: errors.New("token is invalid"),
	}
	mw := NewAuthMiddleware(validator)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer bad-token")
	rr := httptest.NewRecorder()

	mw.RequireAuth(okHandler()).ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", rr.Code)
	}
}

func TestRequireAuth_InvalidUserIDInToken(t *testing.T) {
	validator := &mockValidator{
		claims: &TokenClaims{
			UserID:   "not-a-uuid",
			Email:    "alice@example.com",
			Verified: true,
		},
	}
	mw := NewAuthMiddleware(validator)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rr := httptest.NewRecorder()

	mw.RequireAuth(okHandler()).ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401 for invalid UUID, got %d", rr.Code)
	}
}

// --- RequireVerified tests ---

func TestRequireVerified_WhenVerified(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/verified-only", nil)
	ctx := context.WithValue(req.Context(), VerifiedKey, true)
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	validator := &mockValidator{}
	mw := NewAuthMiddleware(validator)

	mw.RequireVerified(okHandler()).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200 for verified user, got %d", rr.Code)
	}
}

func TestRequireVerified_WhenNotVerified(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/verified-only", nil)
	ctx := context.WithValue(req.Context(), VerifiedKey, false)
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	validator := &mockValidator{}
	mw := NewAuthMiddleware(validator)

	mw.RequireVerified(okHandler()).ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("expected status 403 for unverified user, got %d", rr.Code)
	}
}

func TestRequireVerified_WhenNoVerifiedInContext(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/verified-only", nil)
	// No VerifiedKey in context at all

	rr := httptest.NewRecorder()
	validator := &mockValidator{}
	mw := NewAuthMiddleware(validator)

	mw.RequireVerified(okHandler()).ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Errorf("expected status 403 when no verified key in context, got %d", rr.Code)
	}
}

// --- OptionalAuth tests ---

func TestOptionalAuth_WithValidToken(t *testing.T) {
	userID := uuid.New()
	validator := &mockValidator{
		claims: &TokenClaims{
			UserID:   userID.String(),
			Email:    "bob@example.com",
			Verified: false,
		},
	}
	mw := NewAuthMiddleware(validator)

	req := httptest.NewRequest(http.MethodGet, "/optional", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rr := httptest.NewRecorder()

	var capturedUserID uuid.UUID
	var hasUserID bool

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, ok := r.Context().Value(UserIDKey).(uuid.UUID)
		hasUserID = ok
		capturedUserID = id
		w.WriteHeader(http.StatusOK)
	})

	mw.OptionalAuth(inner).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rr.Code)
	}
	if !hasUserID {
		t.Fatal("expected UserID in context with valid token")
	}
	if capturedUserID != userID {
		t.Errorf("expected UserID %s, got %s", userID, capturedUserID)
	}
}

func TestOptionalAuth_WithoutToken(t *testing.T) {
	validator := &mockValidator{}
	mw := NewAuthMiddleware(validator)

	req := httptest.NewRequest(http.MethodGet, "/optional", nil)
	// No Authorization header
	rr := httptest.NewRecorder()

	var hasUserID bool
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, ok := r.Context().Value(UserIDKey).(uuid.UUID)
		hasUserID = ok
		w.WriteHeader(http.StatusOK)
	})

	mw.OptionalAuth(inner).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200 even without token, got %d", rr.Code)
	}
	if hasUserID {
		t.Error("expected no UserID in context when no token provided")
	}
}

func TestOptionalAuth_WithInvalidToken(t *testing.T) {
	validator := &mockValidator{
		err: errors.New("invalid token"),
	}
	mw := NewAuthMiddleware(validator)

	req := httptest.NewRequest(http.MethodGet, "/optional", nil)
	req.Header.Set("Authorization", "Bearer bad-token")
	rr := httptest.NewRecorder()

	var hasUserID bool
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, ok := r.Context().Value(UserIDKey).(uuid.UUID)
		hasUserID = ok
		w.WriteHeader(http.StatusOK)
	})

	mw.OptionalAuth(inner).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200 with invalid token (optional), got %d", rr.Code)
	}
	if hasUserID {
		t.Error("expected no UserID in context when token is invalid")
	}
}

func TestOptionalAuth_WithInvalidUUIDInToken(t *testing.T) {
	validator := &mockValidator{
		claims: &TokenClaims{
			UserID:   "not-a-uuid",
			Email:    "bad@example.com",
			Verified: false,
		},
	}
	mw := NewAuthMiddleware(validator)

	req := httptest.NewRequest(http.MethodGet, "/optional", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rr := httptest.NewRecorder()

	var hasUserID bool
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, ok := r.Context().Value(UserIDKey).(uuid.UUID)
		hasUserID = ok
		w.WriteHeader(http.StatusOK)
	})

	mw.OptionalAuth(inner).ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200 with bad UUID (optional), got %d", rr.Code)
	}
	if hasUserID {
		t.Error("expected no UserID in context when UUID is invalid")
	}
}

// --- Context helper tests ---

func TestGetUserID(t *testing.T) {
	userID := uuid.New()

	t.Run("present in context", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		ctx := context.WithValue(req.Context(), UserIDKey, userID)
		req = req.WithContext(ctx)

		gotID, ok := GetUserID(req)
		if !ok {
			t.Fatal("expected ok=true when UserID is in context")
		}
		if gotID != userID {
			t.Errorf("expected %s, got %s", userID, gotID)
		}
	})

	t.Run("missing from context", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)

		_, ok := GetUserID(req)
		if ok {
			t.Error("expected ok=false when UserID is not in context")
		}
	})

	t.Run("wrong type in context", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		ctx := context.WithValue(req.Context(), UserIDKey, "string-not-uuid")
		req = req.WithContext(ctx)

		_, ok := GetUserID(req)
		if ok {
			t.Error("expected ok=false when UserID is wrong type")
		}
	})
}

func TestGetUserEmail(t *testing.T) {
	t.Run("present in context", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		ctx := context.WithValue(req.Context(), UserEmailKey, "alice@example.com")
		req = req.WithContext(ctx)

		email, ok := GetUserEmail(req)
		if !ok {
			t.Fatal("expected ok=true when email is in context")
		}
		if email != "alice@example.com" {
			t.Errorf("expected %q, got %q", "alice@example.com", email)
		}
	})

	t.Run("missing from context", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)

		_, ok := GetUserEmail(req)
		if ok {
			t.Error("expected ok=false when email is not in context")
		}
	})
}

func TestIsVerified(t *testing.T) {
	tests := []struct {
		name     string
		ctxVal   interface{}
		setCtx   bool
		expected bool
	}{
		{"verified true", true, true, true},
		{"verified false", false, true, false},
		{"not set", nil, false, false},
		{"wrong type", "yes", true, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tc.setCtx {
				ctx := context.WithValue(req.Context(), VerifiedKey, tc.ctxVal)
				req = req.WithContext(ctx)
			}

			got := IsVerified(req)
			if got != tc.expected {
				t.Errorf("IsVerified() = %v, want %v", got, tc.expected)
			}
		})
	}
}
