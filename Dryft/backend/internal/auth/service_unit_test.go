package auth

import (
	"context"
	"testing"

	"golang.org/x/crypto/bcrypt"

	"github.com/dryft-app/backend/internal/config"
)

func newUnitTestService(t *testing.T) *Service {
	t.Helper()
	cfg := &config.Config{
		JWTSecretKey: "unit-test-secret-key-123456789012345",
	}
	return NewService(cfg, nil)
}

func TestServiceRegisterValidation(t *testing.T) {
	svc := newUnitTestService(t)

	tests := []struct {
		name    string
		req     RegisterRequest
		wantErr string
	}{
		{
			name:    "missing email",
			req:     RegisterRequest{Password: "password123", DisplayName: "Test"},
			wantErr: "email, password, and display name are required",
		},
		{
			name:    "short password",
			req:     RegisterRequest{Email: "u@example.com", Password: "short", DisplayName: "Test"},
			wantErr: "password must be at least 8 characters",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := svc.Register(context.Background(), &tc.req)
			if err == nil || err.Error() != tc.wantErr {
				t.Fatalf("expected error %q, got %v", tc.wantErr, err)
			}
		})
	}
}

func TestServiceLoginValidation(t *testing.T) {
	svc := newUnitTestService(t)

	_, err := svc.Login(context.Background(), &LoginRequest{Email: "", Password: "x"})
	if err == nil || err.Error() != "email and password are required" {
		t.Fatalf("expected validation error, got %v", err)
	}
}

func TestServiceRefreshTokenValidationBeforeDB(t *testing.T) {
	svc := newUnitTestService(t)

	_, err := svc.RefreshToken(context.Background(), "not-a-token")
	if err == nil || err.Error() != "invalid or expired refresh token" {
		t.Fatalf("expected invalid refresh token error, got %v", err)
	}
}

func TestServiceRefreshTokenRejectsNonUUIDSubject(t *testing.T) {
	svc := newUnitTestService(t)
	refreshToken, err := svc.jwt.generateRefreshToken("not-a-uuid")
	if err != nil {
		t.Fatalf("generate refresh token: %v", err)
	}

	_, err = svc.RefreshToken(context.Background(), refreshToken)
	if err == nil || err.Error() != "invalid user ID in token" {
		t.Fatalf("expected invalid user ID error, got %v", err)
	}
}

func TestServiceValidateTokenAndPasswordHashingHelpers(t *testing.T) {
	svc := newUnitTestService(t)
	pair, err := svc.jwt.GenerateTokenPair("550e8400-e29b-41d4-a716-446655440000", "u@example.com", true)
	if err != nil {
		t.Fatalf("generate token pair: %v", err)
	}

	claims, err := svc.ValidateToken(pair.AccessToken)
	if err != nil {
		t.Fatalf("validate token: %v", err)
	}
	if claims.Email != "u@example.com" || claims.UserID == "" {
		t.Fatalf("unexpected claims: %+v", claims)
	}

	hashed := hashToken("refresh-token")
	if hashed == "refresh-token" {
		t.Fatal("expected hashed token to differ from input")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hashed), []byte("refresh-token")); err != nil {
		t.Fatalf("expected bcrypt hash to validate: %v", err)
	}
}
