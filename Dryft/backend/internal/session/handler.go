package session

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/dryft-app/backend/internal/httputil"
	"github.com/dryft-app/backend/internal/models"
	"github.com/dryft-app/backend/internal/realtime"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Handler handles HTTP requests for companion sessions
type Handler struct {
	service *Service
}

// NewHandler creates a new session handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers session routes
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Post("/", h.CreateSession)
	r.Get("/active", h.GetActiveSession)
	r.Post("/join", h.JoinSession)
	r.Get("/{sessionId}", h.GetSession)
	r.Delete("/{sessionId}", h.EndSession)
	r.Post("/{sessionId}/leave", h.LeaveSession)
	r.Post("/{sessionId}/haptic-permission", h.SetHapticPermission)
	r.Post("/{sessionId}/chat", h.SendChat)
	r.Post("/{sessionId}/haptic", h.SendHaptic)
}

// CreateSession creates a new companion session
func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req models.CreateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Empty body is OK, use defaults
		req = models.CreateSessionRequest{}
	}

	resp, err := h.service.CreateSession(r.Context(), userID, req)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, resp)
}

// GetActiveSession gets user's current active session
func (h *Handler) GetActiveSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	session, err := h.service.GetUserActiveSession(r.Context(), userID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if session == nil {
		httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{"session": nil})
		return
	}

	// Get full session info
	info, err := h.service.GetSessionInfo(r.Context(), session.ID, userID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusOK, info)
}

// JoinSession joins a session by code
func (h *Handler) JoinSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req models.JoinSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.SessionCode == "" {
		httputil.WriteError(w, http.StatusBadRequest, "session_code is required")
		return
	}

	if req.DeviceType == "" {
		req.DeviceType = models.DeviceTypeWeb
	}

	info, err := h.service.JoinSession(r.Context(), userID, req)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, ErrInvalidSessionCode) {
			status = http.StatusNotFound
		} else if errors.Is(err, ErrSessionExpired) {
			status = http.StatusGone
		} else if errors.Is(err, ErrSessionFull) {
			status = http.StatusConflict
		} else if errors.Is(err, ErrAlreadyInSession) {
			status = http.StatusConflict
		}
		httputil.WriteError(w, status, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusOK, info)
}

// GetSession gets session details
func (h *Handler) GetSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	sessionID, err := uuid.Parse(chi.URLParam(r, "sessionId"))
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid session ID")
		return
	}

	info, err := h.service.GetSessionInfo(r.Context(), sessionID, userID)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "session not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusOK, info)
}

// EndSession ends a session (host only)
func (h *Handler) EndSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	sessionID, err := uuid.Parse(chi.URLParam(r, "sessionId"))
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid session ID")
		return
	}

	err = h.service.EndSession(r.Context(), sessionID, userID)
	if err != nil {
		if errors.Is(err, ErrNotSessionHost) {
			httputil.WriteError(w, http.StatusForbidden, "only the host can end the session")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "ended"})
}

// LeaveSession leaves a session
func (h *Handler) LeaveSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	sessionID, err := uuid.Parse(chi.URLParam(r, "sessionId"))
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid session ID")
		return
	}

	err = h.service.LeaveSession(r.Context(), sessionID, userID)
	if err != nil {
		if errors.Is(err, ErrNotInSession) {
			httputil.WriteError(w, http.StatusNotFound, "not in session")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "left"})
}

// SetHapticPermission sets haptic control permission
func (h *Handler) SetHapticPermission(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	sessionID, err := uuid.Parse(chi.URLParam(r, "sessionId"))
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid session ID")
		return
	}

	var req models.SetHapticPermissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	err = h.service.SetHapticPermission(r.Context(), sessionID, userID, req)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "permission_set"})
}

// SendChat sends a chat message
func (h *Handler) SendChat(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	sessionID, err := uuid.Parse(chi.URLParam(r, "sessionId"))
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid session ID")
		return
	}

	var req models.SessionChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Content == "" {
		httputil.WriteError(w, http.StatusBadRequest, "content is required")
		return
	}

	err = h.service.SendSessionChat(r.Context(), sessionID, userID, req.Content)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}

// SendHaptic sends a haptic command to another user in the session
func (h *Handler) SendHaptic(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserIDFromContext(r)
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	sessionID, err := uuid.Parse(chi.URLParam(r, "sessionId"))
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid session ID")
		return
	}

	var req models.SessionHapticRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Check permission
	hasPermission, maxIntensity, err := h.service.CheckHapticPermission(r.Context(), sessionID, userID, req.ToUserID)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if !hasPermission {
		httputil.WriteError(w, http.StatusForbidden, "haptic permission not granted")
		return
	}

	// Clamp intensity to max allowed
	intensity := req.Intensity
	if intensity > maxIntensity {
		intensity = maxIntensity
	}

	// Send haptic command via WebSocket
	h.service.broadcastSessionHaptic(sessionID, userID, req.ToUserID, req.CommandType, intensity, req.DurationMs, req.PatternName)

	httputil.WriteJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}

// broadcastSessionHaptic broadcasts haptic command
func (s *Service) broadcastSessionHaptic(sessionID, fromUserID, toUserID uuid.UUID, commandType string, intensity float64, durationMs int, patternName string) {
	payload := realtime.SessionHapticPayload{
		SessionID:   sessionID,
		FromUserID:  fromUserID,
		ToUserID:    toUserID,
		CommandType: commandType,
		Intensity:   intensity,
		DurationMs:  durationMs,
		PatternName: patternName,
	}

	envelope, _ := realtime.NewEnvelope(realtime.EventTypeSessionHaptic, payload)
	s.hub.SendToUser(toUserID, envelope)
}

// --- Helper Functions ---

type contextKey string

const userIDContextKey contextKey = "user_id"

func getUserIDFromContext(r *http.Request) (uuid.UUID, bool) {
	id, ok := r.Context().Value(userIDContextKey).(uuid.UUID)
	return id, ok
}

