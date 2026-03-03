package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
)

type mockAuthHandlerService struct {
	registerFn          func(ctx context.Context, req *RegisterRequest) (*AuthResponse, error)
	loginFn             func(ctx context.Context, req *LoginRequest) (*AuthResponse, error)
	refreshTokenFn      func(ctx context.Context, refreshToken string) (*AuthResponse, error)
	getCurrentUserFn    func(ctx context.Context, userID uuid.UUID) (*UserResponse, error)
	updateProfileFn     func(ctx context.Context, userID uuid.UUID, displayName, bio string) (*UserResponse, error)
	logoutFn            func(ctx context.Context, refreshToken string) error
	revokeAllSessionsFn func(ctx context.Context, userID uuid.UUID) error
	getActiveSessionsFn func(ctx context.Context, userID uuid.UUID) ([]Session, error)
	revokeSessionFn     func(ctx context.Context, userID, sessionID uuid.UUID) error
	changePasswordFn    func(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string, revokeOtherSessions bool) error
}

func (m *mockAuthHandlerService) Register(ctx context.Context, req *RegisterRequest) (*AuthResponse, error) {
	if m.registerFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.registerFn(ctx, req)
}

func (m *mockAuthHandlerService) Login(ctx context.Context, req *LoginRequest) (*AuthResponse, error) {
	if m.loginFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.loginFn(ctx, req)
}

func (m *mockAuthHandlerService) RefreshToken(ctx context.Context, refreshToken string) (*AuthResponse, error) {
	if m.refreshTokenFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.refreshTokenFn(ctx, refreshToken)
}

func (m *mockAuthHandlerService) GetCurrentUser(ctx context.Context, userID uuid.UUID) (*UserResponse, error) {
	if m.getCurrentUserFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.getCurrentUserFn(ctx, userID)
}

func (m *mockAuthHandlerService) UpdateProfile(ctx context.Context, userID uuid.UUID, displayName, bio string) (*UserResponse, error) {
	if m.updateProfileFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.updateProfileFn(ctx, userID, displayName, bio)
}

func (m *mockAuthHandlerService) Logout(ctx context.Context, refreshToken string) error {
	if m.logoutFn == nil {
		return errors.New("not implemented")
	}
	return m.logoutFn(ctx, refreshToken)
}

func (m *mockAuthHandlerService) RevokeAllSessions(ctx context.Context, userID uuid.UUID) error {
	if m.revokeAllSessionsFn == nil {
		return errors.New("not implemented")
	}
	return m.revokeAllSessionsFn(ctx, userID)
}

func (m *mockAuthHandlerService) GetActiveSessions(ctx context.Context, userID uuid.UUID) ([]Session, error) {
	if m.getActiveSessionsFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.getActiveSessionsFn(ctx, userID)
}

func (m *mockAuthHandlerService) RevokeSession(ctx context.Context, userID, sessionID uuid.UUID) error {
	if m.revokeSessionFn == nil {
		return errors.New("not implemented")
	}
	return m.revokeSessionFn(ctx, userID, sessionID)
}

func (m *mockAuthHandlerService) ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string, revokeOtherSessions bool) error {
	if m.changePasswordFn == nil {
		return errors.New("not implemented")
	}
	return m.changePasswordFn(ctx, userID, currentPassword, newPassword, revokeOtherSessions)
}

func TestHandlerRegister_DuplicateEmail(t *testing.T) {
	h := &Handler{
		service: &mockAuthHandlerService{
			registerFn: func(_ context.Context, req *RegisterRequest) (*AuthResponse, error) {
				if req.Email != "taken@example.com" {
					t.Fatalf("unexpected email: %s", req.Email)
				}
				return nil, errors.New("email already registered")
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/auth/register", bytes.NewBufferString(`{"email":"taken@example.com","password":"password123","display_name":"Taken"}`))
	rec := httptest.NewRecorder()

	h.Register(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["error"] != "email already registered" {
		t.Fatalf("expected duplicate email error, got %q", body["error"])
	}
}

func TestHandlerLogin_MapsServiceErrorToUnauthorized(t *testing.T) {
	h := &Handler{
		service: &mockAuthHandlerService{
			loginFn: func(_ context.Context, _ *LoginRequest) (*AuthResponse, error) {
				return nil, errors.New("invalid email or password")
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/auth/login", bytes.NewBufferString(`{"email":"u@example.com","password":"bad"}`))
	rec := httptest.NewRecorder()

	h.Login(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestHandlerRefresh_Success(t *testing.T) {
	expected := &AuthResponse{
		Tokens: AuthTokens{
			AccessToken:  "a",
			RefreshToken: "r",
			ExpiresAt:    123,
		},
		User: UserResponse{ID: uuid.NewString(), Email: "u@example.com"},
	}

	h := &Handler{
		service: &mockAuthHandlerService{
			refreshTokenFn: func(_ context.Context, token string) (*AuthResponse, error) {
				if token != "refresh-token" {
					t.Fatalf("unexpected refresh token: %s", token)
				}
				return expected, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/auth/refresh", bytes.NewBufferString(`{"refresh_token":"refresh-token"}`))
	rec := httptest.NewRecorder()

	h.Refresh(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body AuthResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Tokens.AccessToken != expected.Tokens.AccessToken {
		t.Fatalf("unexpected access token: %q", body.Tokens.AccessToken)
	}
}
