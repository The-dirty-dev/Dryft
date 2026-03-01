//go:build integration

package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/dryft-app/backend/internal/auth"
	"github.com/dryft-app/backend/internal/config"
	authmw "github.com/dryft-app/backend/internal/middleware"
	"github.com/dryft-app/backend/internal/testutil"
)

var tdb *testutil.TestDB

func TestMain(m *testing.M) {
	var err error
	tdb, err = testutil.SetupTestDB()
	if err != nil {
		panic("failed to setup test DB: " + err.Error())
	}
	code := m.Run()
	tdb.Teardown()
	os.Exit(code)
}

func newTestRouter() (*chi.Mux, *auth.Service) {
	cfg := &config.Config{
		JWTSecretKey: testutil.TestJWTSecret,
		Environment:  "development",
	}
	svc := auth.NewService(cfg, tdb.DB)
	handler := auth.NewHandler(svc)

	// Token validator adapter
	validator := &tokenValidatorAdapter{service: svc}
	mw := authmw.NewAuthMiddleware(validator)

	r := chi.NewRouter()

	// Public auth routes
	r.Route("/v1/auth", func(r chi.Router) {
		r.Post("/register", handler.Register)
		r.Post("/login", handler.Login)
		r.Post("/refresh", handler.Refresh)
	})

	// Protected routes
	r.Route("/v1/users", func(r chi.Router) {
		r.Use(mw.RequireAuth)
		r.Get("/me", handler.GetCurrentUser)
		r.Put("/me", handler.UpdateProfile)
	})

	return r, svc
}

// tokenValidatorAdapter wraps auth.Service to implement middleware.TokenValidator.
type tokenValidatorAdapter struct {
	service *auth.Service
}

func (a *tokenValidatorAdapter) ValidateToken(token string) (*authmw.TokenClaims, error) {
	claims, err := a.service.ValidateToken(token)
	if err != nil {
		return nil, err
	}
	return &authmw.TokenClaims{
		UserID:   claims.UserID,
		Email:    claims.Email,
		Verified: claims.Verified,
	}, nil
}

func TestRegisterAndLogin(t *testing.T) {
	tdb.TruncateAll(t.Context())
	r, _ := newTestRouter()

	// Register
	body := `{"email":"alice@example.com","password":"SecurePass123!","display_name":"Alice"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("register: expected 201, got %d: %s", rr.Code, rr.Body.String())
	}

	var registerResp auth.AuthResponse
	json.NewDecoder(rr.Body).Decode(&registerResp)
	if registerResp.Token == "" {
		t.Fatal("register: expected non-empty token")
	}
	if registerResp.User.Email != "alice@example.com" {
		t.Errorf("register: expected email 'alice@example.com', got %q", registerResp.User.Email)
	}

	// Login with same credentials
	body = `{"email":"alice@example.com","password":"SecurePass123!"}`
	req = httptest.NewRequest(http.MethodPost, "/v1/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("login: expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var loginResp auth.AuthResponse
	json.NewDecoder(rr.Body).Decode(&loginResp)
	if loginResp.Token == "" {
		t.Fatal("login: expected non-empty token")
	}
	if loginResp.User.ID != registerResp.User.ID {
		t.Errorf("login: user ID mismatch: %s != %s", loginResp.User.ID, registerResp.User.ID)
	}
}

func TestLoginInvalidCredentials(t *testing.T) {
	tdb.TruncateAll(t.Context())
	r, _ := newTestRouter()

	// Register a user first
	body := `{"email":"bob@example.com","password":"GoodPass123!","display_name":"Bob"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("register: expected 201, got %d", rr.Code)
	}

	// Login with wrong password
	body = `{"email":"bob@example.com","password":"WrongPass!"}`
	req = httptest.NewRequest(http.MethodPost, "/v1/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("login with wrong password: expected 401, got %d", rr.Code)
	}
}

func TestGetCurrentUser_WithToken(t *testing.T) {
	tdb.TruncateAll(t.Context())
	r, _ := newTestRouter()

	// Register
	body := `{"email":"carol@example.com","password":"Pass1234!","display_name":"Carol"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	var resp auth.AuthResponse
	json.NewDecoder(rr.Body).Decode(&resp)

	// Use token to get current user
	req = httptest.NewRequest(http.MethodGet, "/v1/users/me", nil)
	req.Header.Set("Authorization", "Bearer "+resp.Token)
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("get current user: expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var userResp auth.UserResponse
	json.NewDecoder(rr.Body).Decode(&userResp)
	if userResp.Email != "carol@example.com" {
		t.Errorf("expected email 'carol@example.com', got %q", userResp.Email)
	}
}

func TestGetCurrentUser_NoToken(t *testing.T) {
	r, _ := newTestRouter()

	req := httptest.NewRequest(http.MethodGet, "/v1/users/me", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestTokenRefresh(t *testing.T) {
	tdb.TruncateAll(t.Context())
	r, _ := newTestRouter()

	// Register to get tokens
	body := `{"email":"dave@example.com","password":"Pass1234!","display_name":"Dave"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	var resp auth.AuthResponse
	json.NewDecoder(rr.Body).Decode(&resp)

	// Refresh using the refresh token
	refreshBody := `{"refresh_token":"` + resp.RefreshToken + `"}`
	req = httptest.NewRequest(http.MethodPost, "/v1/auth/refresh", strings.NewReader(refreshBody))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("refresh: expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var refreshResp auth.AuthResponse
	json.NewDecoder(rr.Body).Decode(&refreshResp)
	if refreshResp.Token == "" {
		t.Error("expected non-empty access token after refresh")
	}
}

func TestDuplicateRegistration(t *testing.T) {
	tdb.TruncateAll(t.Context())
	r, _ := newTestRouter()

	body := `{"email":"dup@example.com","password":"Pass1234!","display_name":"Dup"}`

	// First registration
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("first register: expected 201, got %d", rr.Code)
	}

	// Duplicate registration
	req = httptest.NewRequest(http.MethodPost, "/v1/auth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code == http.StatusCreated {
		t.Error("duplicate register should not return 201")
	}
}
