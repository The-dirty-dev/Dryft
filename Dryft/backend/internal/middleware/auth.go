package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/dryft-app/backend/internal/httputil"
	"github.com/google/uuid"
)

type contextKey string

const (
	UserIDKey    contextKey = "user_id"
	UserEmailKey contextKey = "user_email"
	VerifiedKey  contextKey = "user_verified"
)

// TokenClaims represents the claims extracted from a JWT token
type TokenClaims struct {
	UserID   string
	Email    string
	Verified bool
}

// TokenValidator validates JWT tokens and returns claims
type TokenValidator interface {
	ValidateToken(token string) (*TokenClaims, error)
}

// AuthMiddleware validates JWT tokens and sets user context
type AuthMiddleware struct {
	validator TokenValidator
}

// NewAuthMiddleware creates a new auth middleware
func NewAuthMiddleware(validator TokenValidator) *AuthMiddleware {
	return &AuthMiddleware{validator: validator}
}

// RequireAuth ensures the request has a valid JWT token
func (m *AuthMiddleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := extractBearerToken(r)
		if token == "" {
			writeUnauthorized(w, "missing authorization token")
			return
		}

		claims, err := m.validator.ValidateToken(token)
		if err != nil {
			writeUnauthorized(w, "invalid or expired token")
			return
		}

		// Parse user ID
		userID, err := uuid.Parse(claims.UserID)
		if err != nil {
			writeUnauthorized(w, "invalid user ID in token")
			return
		}

		// Set user context
		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		ctx = context.WithValue(ctx, UserEmailKey, claims.Email)
		ctx = context.WithValue(ctx, VerifiedKey, claims.Verified)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireVerified ensures the user is age-verified
func (m *AuthMiddleware) RequireVerified(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		verified, ok := r.Context().Value(VerifiedKey).(bool)
		if !ok || !verified {
			httputil.WriteErrorWithCode(w, http.StatusForbidden, httputil.ErrCodeNotVerified, "age verification required")
			return
		}

		next.ServeHTTP(w, r)
	})
}

// OptionalAuth extracts user info if present, but doesn't require it
func (m *AuthMiddleware) OptionalAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := extractBearerToken(r)
		if token == "" {
			next.ServeHTTP(w, r)
			return
		}

		claims, err := m.validator.ValidateToken(token)
		if err != nil {
			// Invalid token - continue without auth
			next.ServeHTTP(w, r)
			return
		}

		userID, err := uuid.Parse(claims.UserID)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		ctx = context.WithValue(ctx, UserEmailKey, claims.Email)
		ctx = context.WithValue(ctx, VerifiedKey, claims.Verified)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func extractBearerToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return ""
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return ""
	}

	return parts[1]
}

func writeUnauthorized(w http.ResponseWriter, message string) {
	httputil.WriteErrorWithCode(w, http.StatusUnauthorized, httputil.ErrCodeUnauthorized, message)
}

// GetUserID extracts user ID from request context
func GetUserID(r *http.Request) (uuid.UUID, bool) {
	id, ok := r.Context().Value(UserIDKey).(uuid.UUID)
	return id, ok
}

// GetUserEmail extracts user email from request context
func GetUserEmail(r *http.Request) (string, bool) {
	email, ok := r.Context().Value(UserEmailKey).(string)
	return email, ok
}

// IsVerified checks if user is age-verified from request context
func IsVerified(r *http.Request) bool {
	verified, ok := r.Context().Value(VerifiedKey).(bool)
	return ok && verified
}
