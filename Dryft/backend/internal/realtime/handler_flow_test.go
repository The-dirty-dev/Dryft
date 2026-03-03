package realtime

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

type mockFlowTokenValidator struct {
	validateFn func(token string) (*TokenClaims, error)
}

func (m *mockFlowTokenValidator) ValidateToken(token string) (*TokenClaims, error) {
	return m.validateFn(token)
}

func TestServeWS_MissingTokenUnauthorized(t *testing.T) {
	h := NewHandlerWithAuth(nil, nil, &mockFlowTokenValidator{
		validateFn: func(token string) (*TokenClaims, error) {
			return &TokenClaims{}, nil
		},
	}, nil)

	req := httptest.NewRequest(http.MethodGet, "/v1/ws", nil)
	rec := httptest.NewRecorder()
	h.ServeWS(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestServeWS_InvalidTokenUnauthorized(t *testing.T) {
	h := NewHandlerWithAuth(nil, nil, &mockFlowTokenValidator{
		validateFn: func(token string) (*TokenClaims, error) {
			return nil, errors.New("invalid token")
		},
	}, nil)

	req := httptest.NewRequest(http.MethodGet, "/v1/ws?token=bad", nil)
	rec := httptest.NewRecorder()
	h.ServeWS(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestServeWS_ValidTokenFallsThroughToUpgrade(t *testing.T) {
	h := NewHandlerWithAuth(nil, nil, &mockFlowTokenValidator{
		validateFn: func(token string) (*TokenClaims, error) {
			return &TokenClaims{
				UserID:   "4f7f7322-6a6d-4efe-a0e6-2fd6cb3f2184",
				Email:    "u@dryft.site",
				Verified: true,
			}, nil
		},
	}, nil)

	// Non-WebSocket request with valid token should pass auth checks and then fail at upgrade.
	req := httptest.NewRequest(http.MethodGet, "/v1/ws?token=ok", nil)
	rec := httptest.NewRecorder()
	h.ServeWS(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 upgrade failure for non-WS request, got %d", rec.Code)
	}
}

func TestExtractTokenFromQueryFlow(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/ws?token=query-token", nil)
	token := extractTokenFromQuery(req)
	if token != "query-token" {
		t.Fatalf("expected query-token, got %q", token)
	}
}
