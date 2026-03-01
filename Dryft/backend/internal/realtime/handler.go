package realtime

import (
	"context"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/dryft-app/backend/internal/chat"
)

// allowedOrigins is set at handler creation from config.
// Defaults to allow-all in development; restricted in production.
var allowedOrigins []string

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		if len(allowedOrigins) == 0 {
			return true // development: allow all
		}
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true // non-browser clients (mobile, VR)
		}
		for _, allowed := range allowedOrigins {
			if origin == allowed {
				return true
			}
		}
		return false
	},
}

// TokenValidator validates JWT tokens
type TokenValidator interface {
	ValidateToken(token string) (*TokenClaims, error)
}

// TokenClaims holds validated token data
type TokenClaims struct {
	UserID   string
	Email    string
	Verified bool
}

// CallNotifier sends push notifications for incoming calls
type CallNotifier interface {
	NotifyIncomingCall(ctx context.Context, targetUserID uuid.UUID, callerName string, callerPhoto *string, callID string, matchID uuid.UUID, videoEnabled bool) error
}

// Handler handles WebSocket connections
type Handler struct {
	hub            *Hub
	chatService    *chat.Service
	tokenValidator TokenValidator
	callNotifier   CallNotifier
}

// NewHandler creates a new WebSocket handler
func NewHandler(hub *Hub, chatService *chat.Service) *Handler {
	return &Handler{
		hub:         hub,
		chatService: chatService,
	}
}

// NewHandlerWithAuth creates a new WebSocket handler with token validation support
func NewHandlerWithAuth(hub *Hub, chatService *chat.Service, validator TokenValidator, callNotifier CallNotifier) *Handler {
	return &Handler{
		hub:            hub,
		chatService:    chatService,
		tokenValidator: validator,
		callNotifier:   callNotifier,
	}
}

// SetAllowedOrigins configures origin validation for WebSocket upgrades.
// Pass nil or empty slice to allow all origins (development mode).
func SetAllowedOrigins(origins []string) {
	allowedOrigins = origins
}

// CheckOrigin validates an HTTP request's Origin header against the configured
// allowed origins. Other packages (calls, voice) should use this to share the
// same origin policy as the main WebSocket handler.
func CheckOrigin(r *http.Request) bool {
	if len(allowedOrigins) == 0 {
		return true // development: allow all
	}
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true // non-browser clients (mobile, VR)
	}
	for _, allowed := range allowedOrigins {
		if origin == allowed {
			return true
		}
	}
	return false
}

// ServeWS handles WebSocket upgrade requests
// GET /v1/ws
func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
	var userID uuid.UUID
	var email string
	var verified bool

	// Try to get user info from context (set by auth middleware)
	if id, ok := getUserIDFromContext(r); ok {
		userID = id
		email, _ = getUserEmailFromContext(r)
		verified = isVerifiedFromContext(r)
	} else if h.tokenValidator != nil {
		// Fallback: check for token in query param (for browser WebSocket)
		token := r.URL.Query().Get("token")
		if token == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		claims, err := h.tokenValidator.ValidateToken(token)
		if err != nil {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		parsedID, err := uuid.Parse(claims.UserID)
		if err != nil {
			http.Error(w, "Invalid user ID", http.StatusUnauthorized)
			return
		}

		userID = parsedID
		email = claims.Email
		verified = claims.Verified

		// Set context for downstream use
		ctx := context.WithValue(r.Context(), userIDContextKey, userID)
		ctx = context.WithValue(ctx, userEmailContextKey, email)
		ctx = context.WithValue(ctx, verifiedContextKey, verified)
		r = r.WithContext(ctx)
	} else {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Require verification for WebSocket access
	if !verified {
		http.Error(w, "Age verification required", http.StatusForbidden)
		return
	}

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] Upgrade error: %v", err)
		return
	}

	// Create client
	client := NewClient(h.hub, conn, userID, email, verified, h.chatService, h.callNotifier)

	// Register with hub
	h.hub.register <- client

	log.Printf("[WS] New connection: user=%s", userID)

	// Start read/write pumps
	go client.WritePump()
	go client.ReadPump()
}

// GetHub returns the hub instance
func (h *Handler) GetHub() *Hub {
	return h.hub
}

// Helper functions to extract from context
type contextKey string

const (
	userIDContextKey   contextKey = "user_id"
	userEmailContextKey contextKey = "user_email"
	verifiedContextKey  contextKey = "user_verified"
)

func getUserIDFromContext(r *http.Request) (uuid.UUID, bool) {
	if id, ok := r.Context().Value(userIDContextKey).(uuid.UUID); ok {
		return id, true
	}
	return uuid.Nil, false
}

func getUserEmailFromContext(r *http.Request) (string, bool) {
	if email, ok := r.Context().Value(userEmailContextKey).(string); ok {
		return email, true
	}
	return "", false
}

func isVerifiedFromContext(r *http.Request) bool {
	if verified, ok := r.Context().Value(verifiedContextKey).(bool); ok {
		return verified
	}
	return false
}
