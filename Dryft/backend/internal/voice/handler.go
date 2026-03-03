package voice

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/dryft-app/backend/internal/httputil"
	"github.com/dryft-app/backend/internal/realtime"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     realtime.CheckOrigin,
}

// Broadcaster interface for sending messages to connected clients
type Broadcaster interface {
	BroadcastToSession(sessionID uuid.UUID, message interface{}) error
	SendToUser(userID uuid.UUID, message interface{}) error
}

// Handler handles voice chat HTTP and WebSocket requests
type Handler struct {
	service     voiceHandlerService
	broadcaster Broadcaster
}

type voiceHandlerService interface {
	JoinSession(ctx context.Context, sessionID, userID uuid.UUID, displayName string) error
	LeaveSession(ctx context.Context, sessionID, userID uuid.UUID) error
	GetParticipants(ctx context.Context, sessionID uuid.UUID) ([]Participant, error)
	SetSpeakingState(ctx context.Context, sessionID, userID uuid.UUID, speaking bool) error
	SetMutedState(ctx context.Context, sessionID, userID uuid.UUID, muted bool) error
}

// NewHandler creates a new voice handler
func NewHandler(service *Service, broadcaster Broadcaster) *Handler {
	return &Handler{
		service:     service,
		broadcaster: broadcaster,
	}
}

// RegisterRoutes registers voice routes
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/voice", func(r chi.Router) {
		r.Get("/session/{sessionId}", h.ServeVoiceWS)
		r.Get("/session/{sessionId}/participants", h.GetParticipants)
	})
}

// Message types for voice WebSocket
type VoiceMessage struct {
	Type      string          `json:"type"`
	SessionID uuid.UUID       `json:"session_id,omitempty"`
	UserID    uuid.UUID       `json:"user_id,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
}

type JoinPayload struct {
	DisplayName string `json:"display_name"`
}

type SpeakingPayload struct {
	Speaking bool `json:"speaking"`
}

type MutePayload struct {
	Muted bool `json:"muted"`
}

type AudioPayload struct {
	Data      []byte `json:"data"` // Base64 encoded audio
	Timestamp int64  `json:"timestamp"`
}

// ServeVoiceWS handles WebSocket connections for voice chat
func (h *Handler) ServeVoiceWS(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "sessionId")
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		httputil.RespondError(w, http.StatusBadRequest, "Invalid session ID")
		return
	}

	// Get user from context (set by auth middleware)
	userID := getUserIDFromContext(r)
	if userID == uuid.Nil {
		httputil.RespondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	displayName := r.URL.Query().Get("display_name")
	if displayName == "" {
		displayName = "User"
	}

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Warn("voice websocket upgrade failed", "error", err)
		return
	}
	defer conn.Close()

	// Join the voice session
	err = h.service.JoinSession(r.Context(), sessionID, userID, displayName)
	if err != nil {
		slog.Warn("voice join session failed", "session_id", sessionID, "user_id", userID, "error", err)
		conn.WriteJSON(VoiceMessage{
			Type: "voice_error",
			Payload: mustMarshal(map[string]string{
				"error": err.Error(),
			}),
		})
		return
	}

	slog.Info("voice participant joined", "session_id", sessionID, "user_id", userID)

	// Send join confirmation
	participants, _ := h.service.GetParticipants(r.Context(), sessionID)
	conn.WriteJSON(VoiceMessage{
		Type:      "voice_joined",
		SessionID: sessionID,
		Payload: mustMarshal(map[string]interface{}{
			"participants": participants,
		}),
	})

	// Notify others that user joined
	h.broadcastToSession(sessionID, userID, VoiceMessage{
		Type:      "voice_participant_joined",
		SessionID: sessionID,
		UserID:    userID,
		Payload: mustMarshal(map[string]string{
			"display_name": displayName,
		}),
	})

	// Handle messages
	defer func() {
		h.service.LeaveSession(context.Background(), sessionID, userID)
		h.broadcastToSession(sessionID, userID, VoiceMessage{
			Type:      "voice_participant_left",
			SessionID: sessionID,
			UserID:    userID,
		})
		slog.Info("voice participant left", "session_id", sessionID, "user_id", userID)
	}()

	for {
		var msg VoiceMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Warn("voice websocket read failed", "session_id", sessionID, "user_id", userID, "error", err)
			}
			break
		}

		h.handleMessage(conn, sessionID, userID, msg)
	}
}

func (h *Handler) handleMessage(conn *websocket.Conn, sessionID, userID uuid.UUID, msg VoiceMessage) {
	ctx := context.Background()

	switch msg.Type {
	case "voice_speaking":
		var payload SpeakingPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		h.service.SetSpeakingState(ctx, sessionID, userID, payload.Speaking)

		// Broadcast speaking state to all participants
		h.broadcastToSession(sessionID, uuid.Nil, VoiceMessage{
			Type:      "voice_speaking",
			SessionID: sessionID,
			UserID:    userID,
			Payload: mustMarshal(map[string]bool{
				"speaking": payload.Speaking,
			}),
		})

	case "voice_mute":
		var payload MutePayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			return
		}

		h.service.SetMutedState(ctx, sessionID, userID, payload.Muted)

		// Broadcast mute state to all participants
		h.broadcastToSession(sessionID, uuid.Nil, VoiceMessage{
			Type:      "voice_mute",
			SessionID: sessionID,
			UserID:    userID,
			Payload: mustMarshal(map[string]bool{
				"muted": payload.Muted,
			}),
		})

	case "voice_audio":
		// For actual audio data, this would be forwarded to other participants
		// In production, you'd use a media server like Janus, mediasoup, or LiveKit
		// For now, we'll relay it through the server (not recommended for production)
		h.broadcastToSession(sessionID, userID, VoiceMessage{
			Type:      "voice_audio",
			SessionID: sessionID,
			UserID:    userID,
			Payload:   msg.Payload,
		})

	case "voice_leave":
		// Client is explicitly leaving
		// The defer in ServeVoiceWS will handle cleanup
		conn.Close()
	}
}

func (h *Handler) broadcastToSession(sessionID, excludeUserID uuid.UUID, msg VoiceMessage) {
	if h.broadcaster != nil {
		h.broadcaster.BroadcastToSession(sessionID, msg)
	}
}

// GetParticipants returns participants in a voice session
func (h *Handler) GetParticipants(w http.ResponseWriter, r *http.Request) {
	sessionIDStr := chi.URLParam(r, "sessionId")
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_session_id", "Invalid session ID")
		return
	}

	participants, err := h.service.GetParticipants(r.Context(), sessionID)
	if err != nil {
		writeError(w, http.StatusNotFound, "session_not_found", "Voice session not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"session_id":   sessionID,
		"participants": participants,
		"count":        len(participants),
	})
}

// --- Helpers ---

func getUserIDFromContext(r *http.Request) uuid.UUID {
	if id, ok := r.Context().Value("user_id").(uuid.UUID); ok {
		return id
	}
	return uuid.Nil
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	httputil.RespondJSON(w, status, data)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	_ = code
	httputil.RespondError(w, status, message)
}

func mustMarshal(v interface{}) json.RawMessage {
	data, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	return data
}
