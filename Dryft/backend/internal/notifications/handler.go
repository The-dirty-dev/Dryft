package notifications

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/httputil"
	authmw "github.com/dryft-app/backend/internal/middleware"
)

// Handler handles HTTP requests for notifications
type Handler struct {
	service notificationsHandlerService
}

type notificationsHandlerService interface {
	RegisterDevice(ctx context.Context, userID uuid.UUID, token string, platform DevicePlatform, deviceID, appVersion string) (*Device, error)
	UnregisterDevice(ctx context.Context, userID uuid.UUID, deviceID string) error
	GetNotificationHistory(ctx context.Context, userID uuid.UUID, limit, offset int) ([]map[string]interface{}, error)
	GetUnreadCount(ctx context.Context, userID uuid.UUID) (int, error)
	MarkNotificationRead(ctx context.Context, userID, notificationID uuid.UUID) error
	MarkAllNotificationsRead(ctx context.Context, userID uuid.UUID) error
	RegisterVoIPDevice(ctx context.Context, userID uuid.UUID, token, bundleID string) (*VoIPDevice, error)
	UnregisterVoIPDevice(ctx context.Context, userID uuid.UUID, token string) error
}

// NewHandler creates a new notification handler
func NewHandler(service *Service) *Handler {
	var svc notificationsHandlerService
	if service != nil {
		svc = service
	}
	return &Handler{service: svc}
}

// RegisterDeviceRequest represents a device registration request
type RegisterDeviceRequest struct {
	Token      string `json:"token"`
	Platform   string `json:"platform"` // ios, android, web
	DeviceID   string `json:"device_id"`
	AppVersion string `json:"app_version,omitempty"`
}

// RegisterDevice handles POST /v1/notifications/devices
func (h *Handler) RegisterDevice(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		httputil.WriteError(w, http.StatusServiceUnavailable, "notifications not configured")
		return
	}

	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req RegisterDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Token == "" || req.Platform == "" || req.DeviceID == "" {
		httputil.WriteError(w, http.StatusBadRequest, "token, platform, and device_id are required")
		return
	}

	// Validate platform
	var platform DevicePlatform
	switch req.Platform {
	case "ios":
		platform = PlatformIOS
	case "android":
		platform = PlatformAndroid
	case "web":
		platform = PlatformWeb
	default:
		httputil.WriteError(w, http.StatusBadRequest, "platform must be ios, android, or web")
		return
	}

	device, err := h.service.RegisterDevice(r.Context(), userID, req.Token, platform, req.DeviceID, req.AppVersion)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to register device")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"device_id": device.ID.String(),
		"status":    "registered",
	})
}

// UnregisterDevice handles DELETE /v1/notifications/devices/{deviceId}
func (h *Handler) UnregisterDevice(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		httputil.WriteError(w, http.StatusServiceUnavailable, "notifications not configured")
		return
	}

	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	deviceID := chi.URLParam(r, "deviceId")
	if deviceID == "" {
		httputil.WriteError(w, http.StatusBadRequest, "device_id required")
		return
	}

	if err := h.service.UnregisterDevice(r.Context(), userID, deviceID); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to unregister device")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetNotifications handles GET /v1/notifications
func (h *Handler) GetNotifications(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		httputil.WriteError(w, http.StatusServiceUnavailable, "notifications not configured")
		return
	}

	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	pg := httputil.ParseLimitOffset(r, 20, 100)

	notifications, err := h.service.GetNotificationHistory(r.Context(), userID, pg.Limit, pg.Offset)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get notifications")
		return
	}

	unreadCount, _ := h.service.GetUnreadCount(r.Context(), userID)

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"notifications": notifications,
		"unread_count":  unreadCount,
	})
}

// MarkRead handles POST /v1/notifications/{id}/read
func (h *Handler) MarkRead(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		httputil.WriteError(w, http.StatusServiceUnavailable, "notifications not configured")
		return
	}

	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	notifIDStr := chi.URLParam(r, "id")
	notifID, err := uuid.Parse(notifIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid notification ID")
		return
	}

	if err := h.service.MarkNotificationRead(r.Context(), userID, notifID); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to mark notification as read")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// MarkAllRead handles POST /v1/notifications/read-all
func (h *Handler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		httputil.WriteError(w, http.StatusServiceUnavailable, "notifications not configured")
		return
	}

	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	if err := h.service.MarkAllNotificationsRead(r.Context(), userID); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to mark notifications as read")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetUnreadCount handles GET /v1/notifications/unread-count
func (h *Handler) GetUnreadCount(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		httputil.WriteError(w, http.StatusServiceUnavailable, "notifications not configured")
		return
	}

	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	count, err := h.service.GetUnreadCount(r.Context(), userID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get unread count")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]int{"count": count})
}

// ============================================================================
// VoIP Device Endpoints (iOS only)
// ============================================================================

// RegisterVoIPDeviceRequest represents a VoIP device registration request
type RegisterVoIPDeviceRequest struct {
	Token    string `json:"token"`
	BundleID string `json:"bundle_id"`
}

// RegisterVoIPDevice handles POST /v1/notifications/voip-devices
func (h *Handler) RegisterVoIPDevice(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		httputil.WriteError(w, http.StatusServiceUnavailable, "notifications not configured")
		return
	}

	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req RegisterVoIPDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Token == "" || req.BundleID == "" {
		httputil.WriteError(w, http.StatusBadRequest, "token and bundle_id are required")
		return
	}

	device, err := h.service.RegisterVoIPDevice(r.Context(), userID, req.Token, req.BundleID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to register VoIP device")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"device_id": device.ID.String(),
		"status":    "registered",
	})
}

// UnregisterVoIPDevice handles DELETE /v1/notifications/voip-devices
func (h *Handler) UnregisterVoIPDevice(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		httputil.WriteError(w, http.StatusServiceUnavailable, "notifications not configured")
		return
	}

	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var req struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Token == "" {
		httputil.WriteError(w, http.StatusBadRequest, "token is required")
		return
	}

	if err := h.service.UnregisterVoIPDevice(r.Context(), userID, req.Token); err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to unregister VoIP device")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Helper functions

func getUserIDFromContext(r *http.Request) (uuid.UUID, error) {
	if id, ok := authmw.GetUserID(r); ok {
		return id, nil
	}
	return uuid.Nil, http.ErrNoCookie
}
