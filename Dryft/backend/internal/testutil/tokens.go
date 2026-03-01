//go:build integration

package testutil

import (
	"github.com/dryft-app/backend/internal/auth"
)

const TestJWTSecret = "test-secret-key-that-is-32bytes!"

// GenerateTestToken creates a valid JWT access token for test requests.
func GenerateTestToken(userID, email string, verified bool) (string, error) {
	mgr := auth.NewJWTManager(auth.DefaultJWTConfig(TestJWTSecret))
	pair, err := mgr.GenerateTokenPair(userID, email, verified)
	if err != nil {
		return "", err
	}
	return pair.AccessToken, nil
}

// TestConfig returns config values that match the test JWT secret.
func TestJWTConfig() string {
	return TestJWTSecret
}
