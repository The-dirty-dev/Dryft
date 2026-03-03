package config

import (
	"os"
	"testing"
)

// clearConfigEnvVars unsets all environment variables that Load() reads,
// so tests start from a clean slate.
func clearConfigEnvVars(t *testing.T) {
	t.Helper()
	vars := []string{
		"PORT", "ENVIRONMENT", "ALLOWED_ORIGINS", "DATABASE_URL",
		"ENCRYPTION_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
		"STRIPE_CONNECT_WEBHOOK_SECRET", "STRIPE_PUBLISHABLE_KEY",
		"JUMIO_API_TOKEN", "JUMIO_API_SECRET", "JUMIO_WEBHOOK_SECRET",
		"JUMIO_BASE_URL", "AWS_REGION", "AWS_ACCESS_KEY_ID",
		"AWS_SECRET_ACCESS_KEY", "JWT_SECRET_KEY",
		"FIREBASE_CREDENTIALS_JSON",
		"APNS_KEY_ID", "APNS_TEAM_ID", "APNS_AUTH_KEY", "APNS_BUNDLE_ID",
		"APNS_PRODUCTION", "S3_BUCKET", "S3_REGION", "S3_ENDPOINT",
	}
	for _, v := range vars {
		os.Unsetenv(v)
	}
}

func TestLoad_Defaults(t *testing.T) {
	clearConfigEnvVars(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned unexpected error: %v", err)
	}

	if cfg.Port != "8080" {
		t.Errorf("expected default Port %q, got %q", "8080", cfg.Port)
	}
	if cfg.Environment != "development" {
		t.Errorf("expected default Environment %q, got %q", "development", cfg.Environment)
	}
	if cfg.DatabaseURL != "postgres://dryft:dryft@localhost:5432/dryft?sslmode=disable" {
		t.Errorf("expected default DatabaseURL, got %q", cfg.DatabaseURL)
	}
	if cfg.JWTSecretKey != "" {
		t.Errorf("expected empty default JWTSecretKey, got %q", cfg.JWTSecretKey)
	}
	if cfg.AWSRegion != "us-east-1" {
		t.Errorf("expected default AWSRegion %q, got %q", "us-east-1", cfg.AWSRegion)
	}
	if cfg.JumioBaseURL != "https://netverify.com/api/v4" {
		t.Errorf("expected default JumioBaseURL, got %q", cfg.JumioBaseURL)
	}
	if cfg.FaceMatchThreshold != 0.90 {
		t.Errorf("expected FaceMatchThreshold 0.90, got %f", cfg.FaceMatchThreshold)
	}
	if cfg.FaceMatchManualReviewMin != 0.80 {
		t.Errorf("expected FaceMatchManualReviewMin 0.80, got %f", cfg.FaceMatchManualReviewMin)
	}
	if cfg.S3Bucket != "dryft-uploads" {
		t.Errorf("expected default S3Bucket %q, got %q", "dryft-uploads", cfg.S3Bucket)
	}
	if cfg.S3Region != "us-east-1" {
		t.Errorf("expected default S3Region %q, got %q", "us-east-1", cfg.S3Region)
	}
	if cfg.APNsBundleID != "com.dryft.app" {
		t.Errorf("expected default APNsBundleID %q, got %q", "com.dryft.app", cfg.APNsBundleID)
	}
	if cfg.APNsProduction != false {
		t.Error("expected APNsProduction=false by default")
	}
	if len(cfg.AllowedOrigins) != 1 || cfg.AllowedOrigins[0] != "http://localhost:3000" {
		t.Errorf("expected default AllowedOrigins [http://localhost:3000], got %v", cfg.AllowedOrigins)
	}
}

func TestLoad_ReadsEnvVars(t *testing.T) {
	clearConfigEnvVars(t)

	t.Setenv("PORT", "9090")
	t.Setenv("ENVIRONMENT", "staging")
	t.Setenv("ALLOWED_ORIGINS", "https://app.example.com,https://admin.example.com")
	t.Setenv("DATABASE_URL", "postgres://user:pass@db.example.com:5432/mydb")
	t.Setenv("JWT_SECRET_KEY", "my-custom-jwt-secret-key-32chars!")
	t.Setenv("STRIPE_SECRET_KEY", "sk_test_12345")
	t.Setenv("ENCRYPTION_KEY", "01234567890123456789012345678901") // exactly 32 bytes
	t.Setenv("JUMIO_API_TOKEN", "jumio-token")
	t.Setenv("JUMIO_API_SECRET", "jumio-secret")
	t.Setenv("AWS_REGION", "eu-west-1")
	t.Setenv("APNS_PRODUCTION", "true")
	t.Setenv("S3_BUCKET", "my-bucket")
	t.Setenv("S3_ENDPOINT", "https://minio.local:9000")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}

	if cfg.Port != "9090" {
		t.Errorf("expected Port %q, got %q", "9090", cfg.Port)
	}
	if cfg.Environment != "staging" {
		t.Errorf("expected Environment %q, got %q", "staging", cfg.Environment)
	}
	if len(cfg.AllowedOrigins) != 2 {
		t.Errorf("expected 2 AllowedOrigins, got %d: %v", len(cfg.AllowedOrigins), cfg.AllowedOrigins)
	}
	if cfg.AllowedOrigins[0] != "https://app.example.com" {
		t.Errorf("expected first origin %q, got %q", "https://app.example.com", cfg.AllowedOrigins[0])
	}
	if cfg.DatabaseURL != "postgres://user:pass@db.example.com:5432/mydb" {
		t.Errorf("expected custom DatabaseURL, got %q", cfg.DatabaseURL)
	}
	if cfg.JWTSecretKey != "my-custom-jwt-secret-key-32chars!" {
		t.Errorf("expected custom JWTSecretKey, got %q", cfg.JWTSecretKey)
	}
	if cfg.StripeSecretKey != "sk_test_12345" {
		t.Errorf("expected StripeSecretKey %q, got %q", "sk_test_12345", cfg.StripeSecretKey)
	}
	if cfg.EncryptionKey != "01234567890123456789012345678901" {
		t.Errorf("expected custom EncryptionKey, got %q", cfg.EncryptionKey)
	}
	if cfg.AWSRegion != "eu-west-1" {
		t.Errorf("expected AWSRegion %q, got %q", "eu-west-1", cfg.AWSRegion)
	}
	if cfg.APNsProduction != true {
		t.Error("expected APNsProduction=true when env is 'true'")
	}
	if cfg.S3Bucket != "my-bucket" {
		t.Errorf("expected S3Bucket %q, got %q", "my-bucket", cfg.S3Bucket)
	}
	if cfg.S3Endpoint != "https://minio.local:9000" {
		t.Errorf("expected S3Endpoint %q, got %q", "https://minio.local:9000", cfg.S3Endpoint)
	}
}

func TestLoad_ValidationFailsInProduction(t *testing.T) {
	tests := []struct {
		name    string
		envVars map[string]string
		wantErr string
	}{
		{
			name: "missing ENCRYPTION_KEY in production",
			envVars: map[string]string{
				"ENVIRONMENT": "production",
				// ENCRYPTION_KEY not set
			},
			wantErr: "ENCRYPTION_KEY is required in production",
		},
		{
			name: "ENCRYPTION_KEY wrong length in production",
			envVars: map[string]string{
				"ENVIRONMENT":    "production",
				"ENCRYPTION_KEY": "too-short",
			},
			wantErr: "ENCRYPTION_KEY must be exactly 32 bytes",
		},
		{
			name: "missing STRIPE_SECRET_KEY in production",
			envVars: map[string]string{
				"ENVIRONMENT":    "production",
				"ENCRYPTION_KEY": "01234567890123456789012345678901",
				// STRIPE_SECRET_KEY not set
			},
			wantErr: "STRIPE_SECRET_KEY is required in production",
		},
		{
			name: "JWT_SECRET_KEY too short in production",
			envVars: map[string]string{
				"ENVIRONMENT":       "production",
				"ENCRYPTION_KEY":    "01234567890123456789012345678901",
				"STRIPE_SECRET_KEY": "sk_live_xyz",
				"JWT_SECRET_KEY":    "short",
			},
			wantErr: "JWT_SECRET_KEY must be at least 32 characters in production",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clearConfigEnvVars(t)
			for k, v := range tc.envVars {
				t.Setenv(k, v)
			}

			_, err := Load()
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tc.wantErr)
			}
			if err.Error() != tc.wantErr {
				t.Errorf("expected error %q, got %q", tc.wantErr, err.Error())
			}
		})
	}
}

func TestLoad_ValidationPassesInProduction(t *testing.T) {
	clearConfigEnvVars(t)

	// Minimum required secrets for production (Jumio is optional)
	t.Setenv("ENVIRONMENT", "production")
	t.Setenv("ENCRYPTION_KEY", "01234567890123456789012345678901")
	t.Setenv("STRIPE_SECRET_KEY", "sk_live_xyz")
	t.Setenv("JWT_SECRET_KEY", "production-jwt-secret-key-that-is-long-enough-32plus")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected no error in properly configured production, got: %v", err)
	}
	if cfg.Environment != "production" {
		t.Errorf("expected environment %q, got %q", "production", cfg.Environment)
	}
}

func TestIsDevelopment(t *testing.T) {
	tests := []struct {
		name        string
		environment string
		expected    bool
	}{
		{"development environment", "development", true},
		{"production environment", "production", false},
		{"staging environment", "staging", false},
		{"empty environment", "", false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := &Config{Environment: tc.environment}
			got := cfg.IsDevelopment()
			if got != tc.expected {
				t.Errorf("IsDevelopment() = %v, want %v for environment %q", got, tc.expected, tc.environment)
			}
		})
	}
}

func TestLoad_DevelopmentSkipsValidation(t *testing.T) {
	clearConfigEnvVars(t)

	// In development, no required vars need to be set
	t.Setenv("ENVIRONMENT", "development")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected no error in development mode, got: %v", err)
	}
	if cfg.Environment != "development" {
		t.Errorf("expected environment %q, got %q", "development", cfg.Environment)
	}
}
