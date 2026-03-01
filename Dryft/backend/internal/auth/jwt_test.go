package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestDefaultJWTConfig(t *testing.T) {
	secret := "my-test-secret-key-1234567890abc"
	cfg := DefaultJWTConfig(secret)

	if cfg.SecretKey != secret {
		t.Errorf("expected SecretKey %q, got %q", secret, cfg.SecretKey)
	}
	if cfg.AccessTokenExpiry != 15*time.Minute {
		t.Errorf("expected AccessTokenExpiry 15m, got %v", cfg.AccessTokenExpiry)
	}
	if cfg.RefreshTokenExpiry != 7*24*time.Hour {
		t.Errorf("expected RefreshTokenExpiry 7d, got %v", cfg.RefreshTokenExpiry)
	}
	if cfg.Issuer != "dryft-api" {
		t.Errorf("expected Issuer %q, got %q", "dryft-api", cfg.Issuer)
	}
}

func newTestJWTManager(expiry time.Duration) *JWTManager {
	return NewJWTManager(&JWTConfig{
		SecretKey:          "test-secret-key-that-is-32bytes!",
		AccessTokenExpiry:  expiry,
		RefreshTokenExpiry: 7 * 24 * time.Hour,
		Issuer:             "dryft-test",
	})
}

func TestGenerateTokenPair(t *testing.T) {
	mgr := newTestJWTManager(15 * time.Minute)

	userID := "550e8400-e29b-41d4-a716-446655440000"
	email := "alice@example.com"
	verified := true

	pair, err := mgr.GenerateTokenPair(userID, email, verified)
	if err != nil {
		t.Fatalf("GenerateTokenPair returned error: %v", err)
	}

	if pair.AccessToken == "" {
		t.Error("expected non-empty AccessToken")
	}
	if pair.RefreshToken == "" {
		t.Error("expected non-empty RefreshToken")
	}
	if pair.ExpiresAt == 0 {
		t.Error("expected non-zero ExpiresAt")
	}

	// ExpiresAt should be roughly 15 minutes from now
	expectedExpiry := time.Now().Add(15 * time.Minute).Unix()
	diff := pair.ExpiresAt - expectedExpiry
	if diff < -5 || diff > 5 {
		t.Errorf("ExpiresAt off by more than 5 seconds: got %d, expected ~%d", pair.ExpiresAt, expectedExpiry)
	}
}

func TestValidateAccessToken_Valid(t *testing.T) {
	mgr := newTestJWTManager(15 * time.Minute)

	userID := "550e8400-e29b-41d4-a716-446655440000"
	email := "alice@example.com"
	verified := true

	pair, err := mgr.GenerateTokenPair(userID, email, verified)
	if err != nil {
		t.Fatalf("GenerateTokenPair error: %v", err)
	}

	claims, err := mgr.ValidateAccessToken(pair.AccessToken)
	if err != nil {
		t.Fatalf("ValidateAccessToken returned error: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("expected UserID %q, got %q", userID, claims.UserID)
	}
	if claims.Email != email {
		t.Errorf("expected Email %q, got %q", email, claims.Email)
	}
	if claims.Verified != verified {
		t.Errorf("expected Verified %v, got %v", verified, claims.Verified)
	}
	if claims.Issuer != "dryft-test" {
		t.Errorf("expected Issuer %q, got %q", "dryft-test", claims.Issuer)
	}
	if claims.Subject != userID {
		t.Errorf("expected Subject %q, got %q", userID, claims.Subject)
	}
}

func TestValidateAccessToken_Expired(t *testing.T) {
	// Use a very short expiry so the token is immediately expired
	mgr := NewJWTManager(&JWTConfig{
		SecretKey:          "test-secret-key-that-is-32bytes!",
		AccessTokenExpiry:  -1 * time.Second, // negative = already expired
		RefreshTokenExpiry: 7 * 24 * time.Hour,
		Issuer:             "dryft-test",
	})

	pair, err := mgr.GenerateTokenPair("user123", "user@example.com", false)
	if err != nil {
		t.Fatalf("GenerateTokenPair error: %v", err)
	}

	_, err = mgr.ValidateAccessToken(pair.AccessToken)
	if err == nil {
		t.Fatal("expected error for expired token, got nil")
	}
}

func TestValidateAccessToken_WrongSigningMethod(t *testing.T) {
	// Create a token signed with RSA instead of HMAC
	rsaKey, err := jwt.ParseRSAPrivateKeyFromPEM([]byte(testRSAPrivateKey))
	if err != nil {
		t.Fatalf("failed to parse RSA key: %v", err)
	}

	claims := &Claims{
		UserID:   "user123",
		Email:    "user@example.com",
		Verified: false,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "dryft-test",
			Subject:   "user123",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tokenString, err := token.SignedString(rsaKey)
	if err != nil {
		t.Fatalf("failed to sign RSA token: %v", err)
	}

	mgr := newTestJWTManager(15 * time.Minute)
	_, err = mgr.ValidateAccessToken(tokenString)
	if err == nil {
		t.Fatal("expected error for wrong signing method, got nil")
	}
}

func TestValidateAccessToken_InvalidString(t *testing.T) {
	mgr := newTestJWTManager(15 * time.Minute)

	tests := []struct {
		name  string
		token string
	}{
		{"empty string", ""},
		{"garbage string", "not-a-valid-token"},
		{"partial jwt", "eyJhbGciOiJIUzI1NiJ9.e30"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := mgr.ValidateAccessToken(tc.token)
			if err == nil {
				t.Error("expected error for invalid token string, got nil")
			}
		})
	}
}

func TestValidateAccessToken_WrongSecret(t *testing.T) {
	mgr1 := NewJWTManager(&JWTConfig{
		SecretKey:          "secret-key-aaaaaaaaaaaaaaaaaaaaa",
		AccessTokenExpiry:  15 * time.Minute,
		RefreshTokenExpiry: 7 * 24 * time.Hour,
		Issuer:             "dryft-test",
	})
	mgr2 := NewJWTManager(&JWTConfig{
		SecretKey:          "secret-key-bbbbbbbbbbbbbbbbbbbbb",
		AccessTokenExpiry:  15 * time.Minute,
		RefreshTokenExpiry: 7 * 24 * time.Hour,
		Issuer:             "dryft-test",
	})

	pair, err := mgr1.GenerateTokenPair("user123", "user@example.com", true)
	if err != nil {
		t.Fatalf("GenerateTokenPair error: %v", err)
	}

	_, err = mgr2.ValidateAccessToken(pair.AccessToken)
	if err == nil {
		t.Fatal("expected error when validating with different secret, got nil")
	}
}

func TestValidateRefreshToken_Valid(t *testing.T) {
	mgr := newTestJWTManager(15 * time.Minute)

	userID := "550e8400-e29b-41d4-a716-446655440000"

	pair, err := mgr.GenerateTokenPair(userID, "alice@example.com", true)
	if err != nil {
		t.Fatalf("GenerateTokenPair error: %v", err)
	}

	gotUserID, err := mgr.ValidateRefreshToken(pair.RefreshToken)
	if err != nil {
		t.Fatalf("ValidateRefreshToken returned error: %v", err)
	}

	if gotUserID != userID {
		t.Errorf("expected userID %q, got %q", userID, gotUserID)
	}
}

func TestValidateRefreshToken_Invalid(t *testing.T) {
	mgr := newTestJWTManager(15 * time.Minute)

	tests := []struct {
		name  string
		token string
	}{
		{"empty string", ""},
		{"garbage string", "totally-not-a-token"},
		{"tampered token", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.tampered"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := mgr.ValidateRefreshToken(tc.token)
			if err == nil {
				t.Error("expected error for invalid refresh token, got nil")
			}
		})
	}
}

func TestValidateRefreshToken_Expired(t *testing.T) {
	mgr := NewJWTManager(&JWTConfig{
		SecretKey:          "test-secret-key-that-is-32bytes!",
		AccessTokenExpiry:  15 * time.Minute,
		RefreshTokenExpiry: -1 * time.Second, // already expired
		Issuer:             "dryft-test",
	})

	pair, err := mgr.GenerateTokenPair("user123", "user@example.com", false)
	if err != nil {
		t.Fatalf("GenerateTokenPair error: %v", err)
	}

	_, err = mgr.ValidateRefreshToken(pair.RefreshToken)
	if err == nil {
		t.Fatal("expected error for expired refresh token, got nil")
	}
}

func TestValidateRefreshToken_WrongSecret(t *testing.T) {
	mgr1 := NewJWTManager(&JWTConfig{
		SecretKey:          "secret-key-aaaaaaaaaaaaaaaaaaaaa",
		AccessTokenExpiry:  15 * time.Minute,
		RefreshTokenExpiry: 7 * 24 * time.Hour,
		Issuer:             "dryft-test",
	})
	mgr2 := NewJWTManager(&JWTConfig{
		SecretKey:          "secret-key-bbbbbbbbbbbbbbbbbbbbb",
		AccessTokenExpiry:  15 * time.Minute,
		RefreshTokenExpiry: 7 * 24 * time.Hour,
		Issuer:             "dryft-test",
	})

	pair, err := mgr1.GenerateTokenPair("user123", "user@example.com", true)
	if err != nil {
		t.Fatalf("GenerateTokenPair error: %v", err)
	}

	_, err = mgr2.ValidateRefreshToken(pair.RefreshToken)
	if err == nil {
		t.Fatal("expected error when validating refresh token with different secret, got nil")
	}
}

func TestGenerateTokenPair_VerifiedField(t *testing.T) {
	mgr := newTestJWTManager(15 * time.Minute)

	tests := []struct {
		name     string
		verified bool
	}{
		{"verified true", true},
		{"verified false", false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			pair, err := mgr.GenerateTokenPair("user1", "user@example.com", tc.verified)
			if err != nil {
				t.Fatalf("GenerateTokenPair error: %v", err)
			}

			claims, err := mgr.ValidateAccessToken(pair.AccessToken)
			if err != nil {
				t.Fatalf("ValidateAccessToken error: %v", err)
			}

			if claims.Verified != tc.verified {
				t.Errorf("expected Verified=%v, got %v", tc.verified, claims.Verified)
			}
		})
	}
}

func TestRefreshAccessToken(t *testing.T) {
	mgr := newTestJWTManager(15 * time.Minute)

	userID := "550e8400-e29b-41d4-a716-446655440000"
	email := "alice@example.com"

	pair1, err := mgr.GenerateTokenPair(userID, email, true)
	if err != nil {
		t.Fatalf("GenerateTokenPair error: %v", err)
	}

	// Use the refresh token to get a new pair
	pair2, err := mgr.RefreshAccessToken(pair1.RefreshToken, email, true)
	if err != nil {
		t.Fatalf("RefreshAccessToken error: %v", err)
	}

	if pair2.AccessToken == "" {
		t.Error("expected non-empty access token from refresh")
	}
	if pair2.AccessToken == pair1.AccessToken {
		t.Error("expected new access token to be different from old one")
	}

	// Validate the new access token
	claims, err := mgr.ValidateAccessToken(pair2.AccessToken)
	if err != nil {
		t.Fatalf("ValidateAccessToken error on refreshed token: %v", err)
	}
	if claims.UserID != userID {
		t.Errorf("expected UserID %q after refresh, got %q", userID, claims.UserID)
	}
	if claims.Email != email {
		t.Errorf("expected Email %q after refresh, got %q", email, claims.Email)
	}
}

// testRSAPrivateKey is a 2048-bit RSA private key used solely for testing
// the wrong-signing-method scenario.
const testRSAPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAv4VjO9a6ihtqaTX8hgGpsdDalhDcteOQs1cuN9lH+pZOExzd
Ylj4bV9Vyw85RChQIZQkC/RMTXO1nL378j5+dGMkRFn44/oH5SWGNtWJkVogNGmc
3XcikItckr7qQcJ7ZMYYL6gFv9sFHaXpwRJYAj8d+eLiwrkQNJ616YNuKoOMDK1+
iFCiUfRH00u0JMtchOGZMl1DwueqSplBHL/uYJ7EDKOmt6XfvU4BzUpyUIEE6TaV
g+jSappEinGkwHlUhzu0w+chkfHleTkmFvq50rkOkFBKR6ke+l8ybEYFNe6O6/eM
rdGBoT6HTe/MSF4t5VqjDFgAp6Z6csTntUeLnwIDAQABAoIBAFd2CiWy/1f/gh5O
5aWqz7xg5NmgFLLJm/SSbQxbIRhKGJh4147Ik5aa8Vp8dsnt4P4coUOGSmwaWccd
KZfsOyJafh7quZMexQk7lCmpZZvnvQpCarzmYXYB9oIbRm5GasRQBI6K3ClL02/B
K1kcz+0itsU9fBGxorls+yUK/L3TrmaTjUlB9il3Ed9TcpB7zyi4HPVXv2TuZJ2Q
eT8OrwT9fgvxCUpHKt/wMJdkwlA9vKvohR25XqnqszbM+GkEGLen9AJpXDuJuy/s
9MZwOA8npFyC8UW7f+1iosBLmwrOCFtwEsdNUzNpFk0e40iYsgUTibD9CBUPWf/i
Fxr5g10CgYEA+bx5PnolXAWKYgvOwjS0Y2tZGTaQ+RaCCizqz9ULpQ1Fp3V/KmyA
XfW1fnRKeD3bQ2/bopidi7tdL6oy97zdkugBuU3lKic0eEomzO211GAWHv1BcMn2
qXGx8EradUjG0FVVMYe1xTGnR7HJi1T3LoVLYrN3ONpDXWJCPSSVcY0CgYEAxFMf
Dz7Dzzs5FTgVDFoyCBGJlJkykQWfZZmt/aNH7WA5wfkNTY6/NjK2o5cWnv0R/spG
rj9ttccc+nMA8jSLUGg1H1G+zBJkpljXsH7e2s3EHZZ+dvJF/yAwM6dqWD4QcnGG
RJ+rLGKNb4AeBYYiDbet2iWpJpgFZOnqTrkvCNsCgYEAznWGNqR8ZkseUFg6oks4
JkkE69c0mviEoSzpItCaQ+VpBDwa2VPB++u6E8TIHAfnUSUUiqNo+6/2JgWrBSxa
cazkX/GJ1wN6WUfUM+8BN4YIQ65Tf484IHUiCemYGQYFdw5U1BHBsDiQdrEAUfP4
Nbl0zTBZC+NFddpZsHqiIbECgYB9FejIMdlYhAdOubjPcfhGo8Xg4+sP82Envs7Y
t9vwJksmh6QuMjEqOw2bFXzYN63rhL2b79Xa585S1EtaBphs1rhiCBdktqNiSWDD
l1IuXsQBhg11g8+NSdjsUFK1fnXENQizWHgbg39R93MpWdkAnHMsdqpbaKinL1KW
be7F2QKBgQCJqCtkr4PoJs0+UhXSnF/bUIv2D05CEZqXo4yvNRP9hnVYA2DZ5BTY
F4i5fKxx8rtq/KKnrZ3op9LPTH9dk2GtEQS+g5vNqxeOfT9fb1VAwbo+xl3os1o8
CyCiVwq5QJA/J1pmEkRrUFGjMCHxLVWMJ/KCA1pgIQjiQsYMpjfwRg==
-----END RSA PRIVATE KEY-----`
