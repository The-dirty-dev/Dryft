package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all configuration for the application.
// LEGAL NOTE: This application implements age verification as required by law
// for adult content platforms. All verification data is handled according to
// applicable privacy regulations (GDPR, CCPA).
type Config struct {
	// Server
	Port           string
	Environment    string
	AllowedOrigins []string

	// Database
	DatabaseURL string

	// Redis
	RedisURL string

	// Encryption
	EncryptionKey string // 32-byte key for AES-256

	// Stripe
	StripeSecretKey            string
	StripeWebhookSecret        string
	StripeConnectWebhookSecret string
	StripePublishableKey       string

	// Jumio
	JumioAPIToken      string
	JumioAPISecret     string
	JumioWebhookSecret string
	JumioBaseURL       string

	// AWS (for Rekognition fallback)
	AWSRegion          string
	AWSAccessKeyID     string
	AWSSecretAccessKey string

	// Face match
	FaceMatchThreshold       float64 // 0.9 = 90% similarity required
	FaceMatchManualReviewMin float64 // 0.8 = 80-90% goes to manual review

	// JWT
	JWTSecretKey string

	// Firebase (Push Notifications)
	FirebaseCredentialsJSON string

	// APNs (iOS VoIP Push)
	APNsKeyID      string // Key ID from Apple Developer account
	APNsTeamID     string // Team ID from Apple Developer account
	APNsAuthKey    string // Contents of .p8 auth key file
	APNsBundleID   string // App bundle ID (e.g., com.dryft.app)
	APNsProduction bool   // true for production, false for sandbox

	// Social Login (Token Verification)
	GoogleClientID string // Google OAuth2 client ID for token audience verification

	// Twilio (SMS)
	TwilioAccountSID string
	TwilioAuthToken  string
	TwilioFromNumber string

	// SES (Email)
	SESFromEmail string // Verified sender email for SES

	// App Store (iOS receipt validation)
	AppStoreSharedSecret string

	// Play Store (Android receipt validation)
	PlayStorePackageName        string
	PlayStoreServiceAccountJSON string // JSON contents of Google service account key

	// S3 (Photo Storage)
	S3Bucket   string
	S3Region   string
	S3Endpoint string // Optional: for S3-compatible storage

	// Rate Limiting
	RateLimitRequests int           // Max requests per window (default: 100)
	RateLimitWindow   time.Duration // Time window for rate limiting (default: 15m)
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:                        getEnv("PORT", "8080"),
		Environment:                 getEnv("ENVIRONMENT", "development"),
		AllowedOrigins:              strings.Split(getEnv("ALLOWED_ORIGINS", "http://localhost:3000"), ","),
		DatabaseURL:                 getEnv("DATABASE_URL", "postgres://dryft:dryft@localhost:5432/dryft?sslmode=disable"),
		RedisURL:                    getOptionalEnv("REDIS_URL"),
		EncryptionKey:               getOptionalEnv("ENCRYPTION_KEY"),
		StripeSecretKey:             getOptionalEnv("STRIPE_SECRET_KEY"),
		StripeWebhookSecret:         getOptionalEnv("STRIPE_WEBHOOK_SECRET"),
		StripeConnectWebhookSecret:  getOptionalEnv("STRIPE_CONNECT_WEBHOOK_SECRET"),
		StripePublishableKey:        getOptionalEnv("STRIPE_PUBLISHABLE_KEY"),
		JumioAPIToken:               getOptionalEnv("JUMIO_API_TOKEN"),
		JumioAPISecret:              getOptionalEnv("JUMIO_API_SECRET"),
		JumioWebhookSecret:          getOptionalEnv("JUMIO_WEBHOOK_SECRET"),
		JumioBaseURL:                getEnv("JUMIO_BASE_URL", "https://netverify.com/api/v4"),
		AWSRegion:                   getEnv("AWS_REGION", "us-east-1"),
		AWSAccessKeyID:              getOptionalEnv("AWS_ACCESS_KEY_ID"),
		AWSSecretAccessKey:          getOptionalEnv("AWS_SECRET_ACCESS_KEY"),
		FaceMatchThreshold:          0.90,
		FaceMatchManualReviewMin:    0.80,
		JWTSecretKey:                getEnv("JWT_SECRET_KEY", ""),
		FirebaseCredentialsJSON:     getOptionalEnv("FIREBASE_CREDENTIALS_JSON"),
		APNsKeyID:                   getOptionalEnv("APNS_KEY_ID"),
		APNsTeamID:                  getOptionalEnv("APNS_TEAM_ID"),
		APNsAuthKey:                 getOptionalEnv("APNS_AUTH_KEY"),
		APNsBundleID:                getEnv("APNS_BUNDLE_ID", "com.dryft.app"),
		APNsProduction:              strings.EqualFold(getOptionalEnv("APNS_PRODUCTION"), "true"),
		GoogleClientID:              getOptionalEnv("GOOGLE_CLIENT_ID"),
		TwilioAccountSID:            getOptionalEnv("TWILIO_ACCOUNT_SID"),
		TwilioAuthToken:             getOptionalEnv("TWILIO_AUTH_TOKEN"),
		TwilioFromNumber:            getOptionalEnv("TWILIO_FROM_NUMBER"),
		SESFromEmail:                getEnv("SES_FROM_EMAIL", "noreply@dryft.site"),
		AppStoreSharedSecret:        getOptionalEnv("APPSTORE_SHARED_SECRET"),
		PlayStorePackageName:        getEnv("PLAYSTORE_PACKAGE_NAME", "com.dryft.app"),
		PlayStoreServiceAccountJSON: getOptionalEnv("PLAYSTORE_SERVICE_ACCOUNT_JSON"),
		S3Bucket:                    getEnv("S3_BUCKET", "dryft-uploads"),
		S3Region:                    getEnv("S3_REGION", "us-east-1"),
		S3Endpoint:                  getOptionalEnv("S3_ENDPOINT"),
		RateLimitRequests:           getEnvInt("RATE_LIMIT_REQUESTS", 100),
		RateLimitWindow:             getEnvDuration("RATE_LIMIT_WINDOW", 15*time.Minute),
	}

	for i := range cfg.AllowedOrigins {
		cfg.AllowedOrigins[i] = strings.TrimSpace(cfg.AllowedOrigins[i])
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) validate() error {
	switch c.Environment {
	case "development", "staging", "production":
	default:
		return fmt.Errorf("ENVIRONMENT must be one of development/staging/production")
	}

	if c.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	if err := validatePostgresURL(c.DatabaseURL); err != nil {
		return err
	}

	if c.JWTSecretKey != "" && len(c.JWTSecretKey) < 32 {
		return fmt.Errorf("JWT_SECRET_KEY must be at least 32 characters")
	}

	if c.S3Endpoint != "" && c.S3Bucket == "" {
		return fmt.Errorf("S3_BUCKET is required when S3_ENDPOINT is set")
	}

	if c.Environment == "production" {
		if c.EncryptionKey == "" {
			return fmt.Errorf("ENCRYPTION_KEY is required in production")
		}
		if len(c.EncryptionKey) != 32 {
			return fmt.Errorf("ENCRYPTION_KEY must be exactly 32 bytes")
		}
		if c.StripeSecretKey == "" {
			return fmt.Errorf("STRIPE_SECRET_KEY is required in production")
		}
		if c.JWTSecretKey == "" {
			return fmt.Errorf("JWT_SECRET_KEY is required in production")
		}
		// Note: Jumio is optional - app can use Stripe card verification only for age gating.
		// Add Jumio credentials for full ID verification support.
	}
	return nil
}

func (c *Config) IsDevelopment() bool {
	return c.Environment == "development"
}

func getEnv(key, defaultValue string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return strings.TrimSpace(defaultValue)
}

func getOptionalEnv(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return defaultValue
}

func validatePostgresURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("DATABASE_URL must be a valid postgres URL")
	}
	if u.Scheme != "postgres" && u.Scheme != "postgresql" {
		return fmt.Errorf("DATABASE_URL must use postgres:// scheme")
	}
	return nil
}
