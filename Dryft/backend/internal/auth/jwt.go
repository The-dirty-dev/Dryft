package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// JWTConfig holds JWT configuration
type JWTConfig struct {
	SecretKey          string
	AccessTokenExpiry  time.Duration
	RefreshTokenExpiry time.Duration
	Issuer             string
}

// DefaultJWTConfig returns default JWT settings
func DefaultJWTConfig(secretKey string) *JWTConfig {
	return &JWTConfig{
		SecretKey:          secretKey,
		AccessTokenExpiry:  15 * time.Minute,
		RefreshTokenExpiry: 7 * 24 * time.Hour, // 7 days
		Issuer:             "dryft-api",
	}
}

// Claims represents the JWT claims
type Claims struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	Verified bool   `json:"verified"`
	jwt.RegisteredClaims
}

// TokenPair represents access and refresh tokens
type TokenPair struct {
	AccessToken  string `json:"token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"`
}

// JWTManager handles JWT operations
type JWTManager struct {
	config *JWTConfig
}

// NewJWTManager creates a new JWT manager
func NewJWTManager(config *JWTConfig) *JWTManager {
	return &JWTManager{config: config}
}

// GenerateTokenPair creates both access and refresh tokens
func (j *JWTManager) GenerateTokenPair(userID, email string, verified bool) (*TokenPair, error) {
	accessToken, expiresAt, err := j.generateAccessToken(userID, email, verified)
	if err != nil {
		return nil, err
	}

	refreshToken, err := j.generateRefreshToken(userID)
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
	}, nil
}

// generateAccessToken creates an access token
func (j *JWTManager) generateAccessToken(userID, email string, verified bool) (string, int64, error) {
	expiresAt := time.Now().Add(j.config.AccessTokenExpiry)

	claims := &Claims{
		UserID:   userID,
		Email:    email,
		Verified: verified,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    j.config.Issuer,
			Subject:   userID,
			ID:        uuid.New().String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString([]byte(j.config.SecretKey))
	if err != nil {
		return "", 0, err
	}

	return signedToken, expiresAt.Unix(), nil
}

// generateRefreshToken creates a refresh token
func (j *JWTManager) generateRefreshToken(userID string) (string, error) {
	expiresAt := time.Now().Add(j.config.RefreshTokenExpiry)

	claims := &jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(expiresAt),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		NotBefore: jwt.NewNumericDate(time.Now()),
		Issuer:    j.config.Issuer,
		Subject:   userID,
		ID:        uuid.New().String(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(j.config.SecretKey))
}

// ValidateAccessToken validates an access token and returns claims
func (j *JWTManager) ValidateAccessToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(j.config.SecretKey), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

// ValidateRefreshToken validates a refresh token and returns the user ID
func (j *JWTManager) ValidateRefreshToken(tokenString string) (string, error) {
	token, err := jwt.ParseWithClaims(tokenString, &jwt.RegisteredClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(j.config.SecretKey), nil
	})

	if err != nil {
		return "", err
	}

	if claims, ok := token.Claims.(*jwt.RegisteredClaims); ok && token.Valid {
		return claims.Subject, nil
	}

	return "", errors.New("invalid refresh token")
}

// RefreshAccessToken creates a new access token from a valid refresh token
func (j *JWTManager) RefreshAccessToken(refreshToken string, email string, verified bool) (*TokenPair, error) {
	userID, err := j.ValidateRefreshToken(refreshToken)
	if err != nil {
		return nil, err
	}

	return j.GenerateTokenPair(userID, email, verified)
}
