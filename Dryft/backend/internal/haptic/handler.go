package haptic

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/httputil"
	authmw "github.com/dryft-app/backend/internal/middleware"
	"github.com/dryft-app/backend/internal/models"
)

// Handler handles HTTP requests for haptic device management
type Handler struct {
	service *Service
}

// NewHandler creates a new haptic handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ============================================================================
// Device Endpoints
// ============================================================================

// RegisterDevice handles POST /v1/haptic/devices
func (h *Handler) RegisterDevice(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req models.RegisterDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.DeviceName == "" {
		httputil.WriteError(w, http.StatusBadRequest, "device_name is required")
		return
	}

	device, err := h.service.RegisterDevice(r.Context(), userID, &req)
	if err != nil {
		if errors.Is(err, ErrDeviceLimitExceeded) {
			httputil.WriteError(w, http.StatusBadRequest, "maximum device limit reached")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to register device")
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, device)
}

// GetDevices handles GET /v1/haptic/devices
func (h *Handler) GetDevices(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	devices, err := h.service.GetUserDevices(r.Context(), userID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get devices")
		return
	}

	if devices == nil {
		devices = []models.HapticDevice{}
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"devices": devices,
	})
}

// GetDevice handles GET /v1/haptic/devices/{deviceId}
func (h *Handler) GetDevice(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	deviceID, err := uuid.Parse(chi.URLParam(r, "deviceId"))
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid device ID")
		return
	}

	device, err := h.service.GetDevice(r.Context(), userID, deviceID)
	if err != nil {
		if errors.Is(err, ErrDeviceNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "device not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get device")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, device)
}

// UpdateDevice handles PATCH /v1/haptic/devices/{deviceId}
func (h *Handler) UpdateDevice(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	deviceID, err := uuid.Parse(chi.URLParam(r, "deviceId"))
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid device ID")
		return
	}

	var req models.UpdateDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	device, err := h.service.UpdateDevice(r.Context(), userID, deviceID, &req)
	if err != nil {
		if errors.Is(err, ErrDeviceNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "device not found")
			return
		}
		if errors.Is(err, ErrInvalidIntensity) {
			httputil.WriteError(w, http.StatusBadRequest, "max_intensity must be between 0 and 1")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to update device")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, device)
}

// DeleteDevice handles DELETE /v1/haptic/devices/{deviceId}
func (h *Handler) DeleteDevice(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	deviceID, err := uuid.Parse(chi.URLParam(r, "deviceId"))
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid device ID")
		return
	}

	if err := h.service.DeleteDevice(r.Context(), userID, deviceID); err != nil {
		if errors.Is(err, ErrDeviceNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "device not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to delete device")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ============================================================================
// Permission Endpoints
// ============================================================================

// SetPermission handles POST /v1/haptic/permissions
func (h *Handler) SetPermission(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req models.SetPermissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate required fields
	if req.ControllerID == uuid.Nil || req.MatchID == uuid.Nil {
		httputil.WriteError(w, http.StatusBadRequest, "controller_id and match_id are required")
		return
	}

	perm, err := h.service.SetPermission(r.Context(), userID, &req)
	if err != nil {
		if errors.Is(err, ErrNotMatched) {
			httputil.WriteError(w, http.StatusForbidden, "users are not matched")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to set permission")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, perm)
}

// GetMatchPermissions handles GET /v1/haptic/permissions/match/{matchId}
func (h *Handler) GetMatchPermissions(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	matchID, err := uuid.Parse(chi.URLParam(r, "matchId"))
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid match ID")
		return
	}

	perms, err := h.service.GetPermissionsForMatch(r.Context(), userID, matchID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get permissions")
		return
	}

	if perms == nil {
		perms = []models.HapticPermission{}
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"permissions": perms,
	})
}

// RevokePermission handles DELETE /v1/haptic/permissions
func (h *Handler) RevokePermission(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req struct {
		ControllerID uuid.UUID `json:"controller_id"`
		MatchID      uuid.UUID `json:"match_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.service.RevokePermission(r.Context(), userID, req.ControllerID, req.MatchID); err != nil {
		if errors.Is(err, ErrPermissionNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "permission not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to revoke permission")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ============================================================================
// Command Endpoints
// ============================================================================

// SendCommand handles POST /v1/haptic/command
func (h *Handler) SendCommand(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var cmd models.HapticCommand
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate
	if cmd.TargetUserID == uuid.Nil || cmd.MatchID == uuid.Nil {
		httputil.WriteError(w, http.StatusBadRequest, "target_user_id and match_id are required")
		return
	}

	if cmd.Intensity < 0 || cmd.Intensity > 1 {
		httputil.WriteError(w, http.StatusBadRequest, "intensity must be between 0 and 1")
		return
	}

	if cmd.DurationMS < 0 || cmd.DurationMS > 30000 {
		httputil.WriteError(w, http.StatusBadRequest, "duration_ms must be between 0 and 30000")
		return
	}

	if err := h.service.SendCommand(r.Context(), userID, &cmd); err != nil {
		if errors.Is(err, ErrNotMatched) {
			httputil.WriteError(w, http.StatusForbidden, "users are not matched")
			return
		}
		if errors.Is(err, ErrPermissionDenied) {
			httputil.WriteError(w, http.StatusForbidden, "permission denied")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to send command")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}

// ============================================================================
// Pattern Endpoints
// ============================================================================

// GetPatterns handles GET /v1/haptic/patterns
func (h *Handler) GetPatterns(w http.ResponseWriter, r *http.Request) {
	_, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	patterns, err := h.service.GetPublicPatterns(r.Context(), 50, 0)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get patterns")
		return
	}

	if patterns == nil {
		patterns = []models.HapticPattern{}
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"patterns": patterns,
	})
}

// GetPattern handles GET /v1/haptic/patterns/{patternId}
func (h *Handler) GetPattern(w http.ResponseWriter, r *http.Request) {
	_, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	patternID, err := uuid.Parse(chi.URLParam(r, "patternId"))
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid pattern ID")
		return
	}

	pattern, err := h.service.GetPattern(r.Context(), patternID)
	if err != nil {
		httputil.WriteError(w, http.StatusNotFound, "pattern not found")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, pattern)
}

// ============================================================================
// Match Devices Endpoint (for viewing other user's available devices)
// ============================================================================

// GetMatchDevices handles GET /v1/haptic/match/{matchId}/devices
func (h *Handler) GetMatchDevices(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	matchID, err := uuid.Parse(chi.URLParam(r, "matchId"))
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid match ID")
		return
	}

	// Get the other user's ID from the match
	var otherUserID uuid.UUID
	err = h.service.db.Pool.QueryRow(r.Context(), `
		SELECT CASE WHEN user_a = $1 THEN user_b ELSE user_a END
		FROM matches WHERE id = $2 AND (user_a = $1 OR user_b = $1)
	`, userID, matchID).Scan(&otherUserID)

	if err != nil {
		httputil.WriteError(w, http.StatusNotFound, "match not found")
		return
	}

	// Get other user's devices
	devices, err := h.service.GetUserDevices(r.Context(), otherUserID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get devices")
		return
	}

	// Return public view only
	publicDevices := make([]models.HapticDevicePublic, len(devices))
	for i, d := range devices {
		publicDevices[i] = d.ToPublic()
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"devices": publicDevices,
	})
}

// ============================================================================
// Helper Functions
// ============================================================================

func getUserIDFromContext(r *http.Request) (uuid.UUID, error) {
	if id, ok := authmw.GetUserID(r); ok {
		return id, nil
	}
	return uuid.Nil, http.ErrNoCookie
}

