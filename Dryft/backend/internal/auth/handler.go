package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/dryft-app/backend/internal/httputil"
	"github.com/google/uuid"
)

// Handler handles HTTP requests for authentication
type Handler struct {
	service authHandlerService
}

type authHandlerService interface {
	Register(ctx context.Context, req *RegisterRequest) (*AuthResponse, error)
	Login(ctx context.Context, req *LoginRequest) (*AuthResponse, error)
	RefreshToken(ctx context.Context, refreshToken string) (*AuthResponse, error)
	GetCurrentUser(ctx context.Context, userID uuid.UUID) (*UserResponse, error)
	UpdateProfile(ctx context.Context, userID uuid.UUID, displayName, bio string) (*UserResponse, error)
	Logout(ctx context.Context, refreshToken string) error
	RevokeAllSessions(ctx context.Context, userID uuid.UUID) error
	GetActiveSessions(ctx context.Context, userID uuid.UUID) ([]Session, error)
	RevokeSession(ctx context.Context, userID, sessionID uuid.UUID) error
	ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string, revokeOtherSessions bool) error
}

// NewHandler creates a new auth handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Register handles user registration
// POST /v1/auth/register
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	resp, err := h.service.Register(r.Context(), &req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

// Login handles user login
// POST /v1/auth/login
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	resp, err := h.service.Login(r.Context(), &req)
	if err != nil {
		httputil.WriteErrorWithCode(w, http.StatusUnauthorized, httputil.ErrCodeInvalidCredentials, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// Refresh handles token refresh
// POST /v1/auth/refresh
func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "refresh_token is required")
		return
	}

	resp, err := h.service.RefreshToken(r.Context(), req.RefreshToken)
	if err != nil {
		httputil.WriteErrorWithCode(w, http.StatusUnauthorized, httputil.ErrCodeTokenExpired, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// GetCurrentUser returns the authenticated user's profile
// GET /v1/users/me
func (h *Handler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	resp, err := h.service.GetCurrentUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// UpdateProfile updates the authenticated user's profile
// PUT /v1/users/me
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req struct {
		DisplayName string `json:"display_name"`
		Bio         string `json:"bio"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	resp, err := h.service.UpdateProfile(r.Context(), userID, req.DisplayName, req.Bio)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// Logout revokes the current session
// POST /v1/auth/logout
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.RefreshToken == "" {
		writeError(w, http.StatusBadRequest, "refresh_token is required")
		return
	}

	if err := h.service.Logout(r.Context(), req.RefreshToken); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to logout")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "logged out successfully"})
}

// LogoutAll revokes all sessions for the user
// POST /v1/auth/logout-all
func (h *Handler) LogoutAll(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	if err := h.service.RevokeAllSessions(r.Context(), userID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to logout from all devices")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "logged out from all devices"})
}

// GetSessions returns all active sessions for the user
// GET /v1/auth/sessions
func (h *Handler) GetSessions(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	sessions, err := h.service.GetActiveSessions(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get sessions")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"sessions": sessions,
		"count":    len(sessions),
	})
}

// RevokeSession revokes a specific session
// DELETE /v1/auth/sessions/{sessionId}
func (h *Handler) RevokeSession(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	// Get session ID from URL path
	sessionIDStr := r.URL.Path[strings.LastIndex(r.URL.Path, "/")+1:]
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid session ID")
		return
	}

	if err := h.service.RevokeSession(r.Context(), userID, sessionID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "session revoked"})
}

// ChangePassword changes the user's password
// POST /v1/auth/change-password
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req struct {
		CurrentPassword     string `json:"current_password"`
		NewPassword         string `json:"new_password"`
		RevokeOtherSessions bool   `json:"revoke_other_sessions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.CurrentPassword == "" || req.NewPassword == "" {
		writeError(w, http.StatusBadRequest, "current_password and new_password are required")
		return
	}

	if err := h.service.ChangePassword(r.Context(), userID, req.CurrentPassword, req.NewPassword, req.RevokeOtherSessions); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "password changed successfully"})
}

// Helper functions

// contextKey type for context values (matches middleware package)
type contextKey string

const userIDContextKey contextKey = "user_id"

func getUserIDFromContext(r *http.Request) (uuid.UUID, error) {
	// Get user ID from context (set by auth middleware)
	if id, ok := r.Context().Value(userIDContextKey).(uuid.UUID); ok {
		return id, nil
	}

	// SECURITY: Do not fall back to headers - always require proper JWT auth
	// The X-User-ID header fallback was removed to prevent user impersonation attacks
	return uuid.Nil, http.ErrNoCookie
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// ExtractBearerToken extracts the token from Authorization header
func ExtractBearerToken(r *http.Request) string {
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
