package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/dryft-app/backend/internal/config"
	"github.com/dryft-app/backend/internal/database"
	"github.com/dryft-app/backend/internal/models"
)

// PhotoSigner generates signed URLs for S3 object keys.
// If nil, raw keys are returned instead.
type PhotoSigner interface {
	GetSignedURL(key string) (string, error)
}

// EmailSender sends emails for account operations (e.g. deletion confirmation).
// If nil, a log-only fallback is used in development.
type EmailSender interface {
	SendAccountDeletionEmail(ctx context.Context, email, token string) error
}

// Service handles authentication business logic
type Service struct {
	cfg         *config.Config
	db          *database.DB
	jwt         *JWTManager
	photoSigner PhotoSigner
	emailSender EmailSender
}

// NewService creates a new auth service
func NewService(cfg *config.Config, db *database.DB) *Service {
	jwtConfig := DefaultJWTConfig(cfg.JWTSecretKey)
	return &Service{
		cfg: cfg,
		db:  db,
		jwt: NewJWTManager(jwtConfig),
	}
}

// SetPhotoSigner sets the photo signing service for generating signed URLs.
func (s *Service) SetPhotoSigner(signer PhotoSigner) {
	s.photoSigner = signer
}

// RegisterRequest represents a registration request
type RegisterRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
}

// LoginRequest represents a login request
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// AuthTokens represents the token payload in auth responses
type AuthTokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"`
}

// AuthResponse represents the authentication response
type AuthResponse struct {
	Tokens AuthTokens   `json:"tokens"`
	User   UserResponse `json:"user"`
}

// UserResponse represents the user in responses
type UserResponse struct {
	ID           string  `json:"id"`
	Email        string  `json:"email"`
	DisplayName  *string `json:"display_name,omitempty"`
	Bio          *string `json:"bio,omitempty"`
	ProfilePhoto *string `json:"profile_photo_url,omitempty"`
	Verified     bool    `json:"verified"`
	VerifiedAt   *string `json:"verified_at,omitempty"`
	CreatedAt    string  `json:"created_at"`
}

// Register creates a new user account
func (s *Service) Register(ctx context.Context, req *RegisterRequest) (*AuthResponse, error) {
	// Validate input
	if req.Email == "" || req.Password == "" || req.DisplayName == "" {
		return nil, errors.New("email, password, and display name are required")
	}

	if len(req.Password) < 8 {
		return nil, errors.New("password must be at least 8 characters")
	}

	// Check if email already exists
	var exists bool
	err := s.db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", req.Email).Scan(&exists)
	if err != nil {
		return nil, fmt.Errorf("check email: %w", err)
	}
	if exists {
		return nil, errors.New("email already registered")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	// Create user
	userID := uuid.New()
	now := time.Now()

	_, err = s.db.Pool.Exec(ctx, `
		INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $5)
	`, userID, req.Email, string(hashedPassword), req.DisplayName, now)

	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}

	// Generate tokens
	tokenPair, err := s.jwt.GenerateTokenPair(userID.String(), req.Email, false)
	if err != nil {
		return nil, fmt.Errorf("generate tokens: %w", err)
	}

	return &AuthResponse{
		Tokens: AuthTokens{
			AccessToken:  tokenPair.AccessToken,
			RefreshToken: tokenPair.RefreshToken,
			ExpiresAt:    tokenPair.ExpiresAt,
		},
		User: UserResponse{
			ID:          userID.String(),
			Email:       req.Email,
			DisplayName: &req.DisplayName,
			Verified:    false,
			CreatedAt:   now.Format(time.RFC3339),
		},
	}, nil
}

// Login authenticates a user
func (s *Service) Login(ctx context.Context, req *LoginRequest) (*AuthResponse, error) {
	// Validate input
	if req.Email == "" || req.Password == "" {
		return nil, errors.New("email and password are required")
	}

	// Find user by email
	var user models.User
	var passwordHash string

	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, email, password_hash, display_name, bio, profile_photo,
		       verified, verified_at, created_at, updated_at
		FROM users
		WHERE email = $1 AND deleted_at IS NULL
	`, req.Email).Scan(
		&user.ID, &user.Email, &passwordHash, &user.DisplayName, &user.Bio,
		&user.ProfilePhoto, &user.Verified, &user.VerifiedAt, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, errors.New("invalid email or password")
	}
	if err != nil {
		return nil, fmt.Errorf("find user: %w", err)
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Generate tokens
	tokenPair, err := s.jwt.GenerateTokenPair(user.ID.String(), user.Email, user.Verified)
	if err != nil {
		return nil, fmt.Errorf("generate tokens: %w", err)
	}

	// Build response
	resp := &AuthResponse{
		Tokens: AuthTokens{
			AccessToken:  tokenPair.AccessToken,
			RefreshToken: tokenPair.RefreshToken,
			ExpiresAt:    tokenPair.ExpiresAt,
		},
		User: s.userToResponse(&user),
	}

	return resp, nil
}

// RefreshToken refreshes the access token
func (s *Service) RefreshToken(ctx context.Context, refreshToken string) (*AuthResponse, error) {
	// Validate refresh token and get user ID
	userID, err := s.jwt.ValidateRefreshToken(refreshToken)
	if err != nil {
		return nil, errors.New("invalid or expired refresh token")
	}

	// Parse user ID
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user ID in token")
	}

	// Get user from database
	var user models.User
	err = s.db.Pool.QueryRow(ctx, `
		SELECT id, email, display_name, bio, profile_photo,
		       verified, verified_at, created_at, updated_at
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
	`, uid).Scan(
		&user.ID, &user.Email, &user.DisplayName, &user.Bio,
		&user.ProfilePhoto, &user.Verified, &user.VerifiedAt, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, errors.New("user not found")
	}
	if err != nil {
		return nil, fmt.Errorf("find user: %w", err)
	}

	// Generate new tokens
	tokenPair, err := s.jwt.GenerateTokenPair(user.ID.String(), user.Email, user.Verified)
	if err != nil {
		return nil, fmt.Errorf("generate tokens: %w", err)
	}

	return &AuthResponse{
		Tokens: AuthTokens{
			AccessToken:  tokenPair.AccessToken,
			RefreshToken: tokenPair.RefreshToken,
			ExpiresAt:    tokenPair.ExpiresAt,
		},
		User: s.userToResponse(&user),
	}, nil
}

// GetCurrentUser returns the current user from a valid token
func (s *Service) GetCurrentUser(ctx context.Context, userID uuid.UUID) (*UserResponse, error) {
	var user models.User

	err := s.db.Pool.QueryRow(ctx, `
		SELECT id, email, display_name, bio, profile_photo,
		       verified, verified_at, created_at, updated_at
		FROM users
		WHERE id = $1 AND deleted_at IS NULL
	`, userID).Scan(
		&user.ID, &user.Email, &user.DisplayName, &user.Bio,
		&user.ProfilePhoto, &user.Verified, &user.VerifiedAt, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, errors.New("user not found")
	}
	if err != nil {
		return nil, fmt.Errorf("find user: %w", err)
	}

	resp := s.userToResponse(&user)
	return &resp, nil
}

// UpdateProfile updates user profile fields
func (s *Service) UpdateProfile(ctx context.Context, userID uuid.UUID, displayName, bio string) (*UserResponse, error) {
	var user models.User

	err := s.db.Pool.QueryRow(ctx, `
		UPDATE users
		SET display_name = COALESCE(NULLIF($2, ''), display_name),
		    bio = COALESCE(NULLIF($3, ''), bio),
		    updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
		RETURNING id, email, display_name, bio, profile_photo,
		          verified, verified_at, created_at, updated_at
	`, userID, displayName, bio).Scan(
		&user.ID, &user.Email, &user.DisplayName, &user.Bio,
		&user.ProfilePhoto, &user.Verified, &user.VerifiedAt, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, errors.New("user not found")
	}
	if err != nil {
		return nil, fmt.Errorf("update profile: %w", err)
	}

	resp := s.userToResponse(&user)
	return &resp, nil
}

// ValidateToken validates an access token and returns claims
func (s *Service) ValidateToken(tokenString string) (*Claims, error) {
	return s.jwt.ValidateAccessToken(tokenString)
}

// Session represents an active login session
type Session struct {
	ID           uuid.UUID  `json:"id"`
	UserID       uuid.UUID  `json:"user_id"`
	RefreshToken string     `json:"-"` // Don't expose
	DeviceType   string     `json:"device_type"`   // "ios", "android", "vr", "web"
	DeviceName   string     `json:"device_name"`
	IPAddress    string     `json:"ip_address,omitempty"`
	UserAgent    string     `json:"user_agent,omitempty"`
	LastActiveAt time.Time  `json:"last_active_at"`
	CreatedAt    time.Time  `json:"created_at"`
	RevokedAt    *time.Time `json:"revoked_at,omitempty"`
}

// CreateSessionRequest for creating a new session
type CreateSessionRequest struct {
	RefreshToken string
	DeviceType   string
	DeviceName   string
	IPAddress    string
	UserAgent    string
}

// CreateSession creates a new session record
func (s *Service) CreateSession(ctx context.Context, userID uuid.UUID, req *CreateSessionRequest) (*Session, error) {
	sessionID := uuid.New()
	now := time.Now()

	_, err := s.db.Pool.Exec(ctx, `
		INSERT INTO sessions (id, user_id, refresh_token_hash, device_type, device_name, ip_address, user_agent, last_active_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
	`, sessionID, userID, hashToken(req.RefreshToken), req.DeviceType, req.DeviceName, req.IPAddress, req.UserAgent, now)

	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}

	return &Session{
		ID:           sessionID,
		UserID:       userID,
		DeviceType:   req.DeviceType,
		DeviceName:   req.DeviceName,
		LastActiveAt: now,
		CreatedAt:    now,
	}, nil
}

// GetActiveSessions returns all active sessions for a user
func (s *Service) GetActiveSessions(ctx context.Context, userID uuid.UUID) ([]Session, error) {
	rows, err := s.db.Pool.Query(ctx, `
		SELECT id, user_id, device_type, device_name, ip_address, user_agent, last_active_at, created_at
		FROM sessions
		WHERE user_id = $1 AND revoked_at IS NULL
		ORDER BY last_active_at DESC
	`, userID)

	if err != nil {
		return nil, fmt.Errorf("get sessions: %w", err)
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var session Session
		if err := rows.Scan(
			&session.ID, &session.UserID, &session.DeviceType, &session.DeviceName,
			&session.IPAddress, &session.UserAgent, &session.LastActiveAt, &session.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan session: %w", err)
		}
		sessions = append(sessions, session)
	}

	return sessions, nil
}

// RevokeSession revokes a specific session (logout from one device)
func (s *Service) RevokeSession(ctx context.Context, userID, sessionID uuid.UUID) error {
	result, err := s.db.Pool.Exec(ctx, `
		UPDATE sessions
		SET revoked_at = NOW()
		WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
	`, sessionID, userID)

	if err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}

	if result.RowsAffected() == 0 {
		return errors.New("session not found")
	}

	return nil
}

// RevokeAllSessions revokes all sessions for a user (logout from all devices)
func (s *Service) RevokeAllSessions(ctx context.Context, userID uuid.UUID) error {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE sessions
		SET revoked_at = NOW()
		WHERE user_id = $1 AND revoked_at IS NULL
	`, userID)

	return err
}

// RevokeOtherSessions revokes all sessions except the current one
func (s *Service) RevokeOtherSessions(ctx context.Context, userID uuid.UUID, currentRefreshToken string) error {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE sessions
		SET revoked_at = NOW()
		WHERE user_id = $1 AND revoked_at IS NULL AND refresh_token_hash != $2
	`, userID, hashToken(currentRefreshToken))

	return err
}

// UpdateSessionActivity updates the last active timestamp
func (s *Service) UpdateSessionActivity(ctx context.Context, refreshToken string) error {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE sessions
		SET last_active_at = NOW()
		WHERE refresh_token_hash = $1 AND revoked_at IS NULL
	`, hashToken(refreshToken))

	return err
}

// IsSessionRevoked checks if a session has been revoked
func (s *Service) IsSessionRevoked(ctx context.Context, refreshToken string) (bool, error) {
	var revokedAt *time.Time
	err := s.db.Pool.QueryRow(ctx, `
		SELECT revoked_at FROM sessions WHERE refresh_token_hash = $1
	`, hashToken(refreshToken)).Scan(&revokedAt)

	if err == pgx.ErrNoRows {
		return false, nil // Session doesn't exist, treat as not revoked
	}
	if err != nil {
		return false, err
	}

	return revokedAt != nil, nil
}

// hashToken creates a hash of the token for storage
func hashToken(token string) string {
	hash, _ := bcrypt.GenerateFromPassword([]byte(token), bcrypt.DefaultCost)
	return string(hash)
}

// Logout revokes the current session
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	_, err := s.db.Pool.Exec(ctx, `
		UPDATE sessions
		SET revoked_at = NOW()
		WHERE refresh_token_hash = $1 AND revoked_at IS NULL
	`, hashToken(refreshToken))

	return err
}

// ChangePassword changes the user's password and optionally revokes all sessions
func (s *Service) ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string, revokeOtherSessions bool) error {
	// Get current password hash
	var passwordHash string
	err := s.db.Pool.QueryRow(ctx, `
		SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL
	`, userID).Scan(&passwordHash)

	if err == pgx.ErrNoRows {
		return errors.New("user not found")
	}
	if err != nil {
		return fmt.Errorf("get user: %w", err)
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(currentPassword)); err != nil {
		return errors.New("current password is incorrect")
	}

	// Validate new password
	if len(newPassword) < 8 {
		return errors.New("new password must be at least 8 characters")
	}

	// Hash new password
	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	// Update password
	_, err = s.db.Pool.Exec(ctx, `
		UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1
	`, userID, string(newHash))

	if err != nil {
		return fmt.Errorf("update password: %w", err)
	}

	// Optionally revoke other sessions
	if revokeOtherSessions {
		s.RevokeAllSessions(ctx, userID)
	}

	return nil
}

// userToResponse converts a user model to response
func (s *Service) userToResponse(user *models.User) UserResponse {
	resp := UserResponse{
		ID:          user.ID.String(),
		Email:       user.Email,
		DisplayName: user.DisplayName,
		Bio:         user.Bio,
		Verified:    user.Verified,
		CreatedAt:   user.CreatedAt.Format(time.RFC3339),
	}

	if user.VerifiedAt != nil {
		verifiedAtStr := user.VerifiedAt.Format(time.RFC3339)
		resp.VerifiedAt = &verifiedAtStr
	}

	if user.ProfilePhoto != nil && *user.ProfilePhoto != "" {
		if s.photoSigner != nil {
			if signedURL, err := s.photoSigner.GetSignedURL(*user.ProfilePhoto); err == nil && signedURL != "" {
				resp.ProfilePhoto = &signedURL
			} else {
				resp.ProfilePhoto = user.ProfilePhoto
			}
		} else {
			resp.ProfilePhoto = user.ProfilePhoto
		}
	}

	return resp
}
