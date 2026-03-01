//go:build integration

package integration

import (
	"github.com/dryft-app/backend/internal/auth"
	"github.com/dryft-app/backend/internal/config"
	"github.com/dryft-app/backend/internal/testutil"
)

// authServiceForTest creates an auth.Service using the shared test DB and JWT secret.
func authServiceForTest(cfg *config.Config) *auth.Service {
	if cfg == nil {
		cfg = &config.Config{
			JWTSecretKey: testutil.TestJWTSecret,
			Environment:  "development",
		}
	}
	return auth.NewService(cfg, tdb.DB)
}
