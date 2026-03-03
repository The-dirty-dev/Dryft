package realtime

import (
	"context"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"github.com/dryft-app/backend/internal/chat"
	authmw "github.com/dryft-app/backend/internal/middleware"
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
	log.Printf("[WS] ServeWS called: method=%s path=%s hasAuthHeader=%v hasTokenParam=%v upgradeHeader=%q",
		r.Method, r.URL.Path,
		r.Header.Get("Authorization") != "",
		r.URL.Query().Get("token") != "",
		r.Header.Get("Upgrade"))

	var userID uuid.UUID
	var email string
	var verified bool
	var authMethod string

	// Try to get user info from context (set by OptionalAuth middleware)
	if id, ok := authmw.GetUserID(r); ok {
		authMethod = "middleware-context"
		userID = id
		email, _ = authmw.GetUserEmail(r)
		verified = authmw.IsVerified(r)
		log.Printf("[WS] auth via %s: user=%s email=%s verified=%v", authMethod, userID, email, verified)
	} else if h.tokenValidator != nil {
		// Fallback: check for token in query param (for browser WebSocket)
		authMethod = "query-param"
		token := r.URL.Query().Get("token")
		if token == "" {
			log.Printf("[WS] REJECT 401: no user in context AND no ?token= query param (Authorization header present: %v)",
				r.Header.Get("Authorization") != "")
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		log.Printf("[WS] trying %s auth: token_len=%d", authMethod, len(token))

		claims, err := h.tokenValidator.ValidateToken(token)
		if err != nil {
			log.Printf("[WS] REJECT 401: %s token validation failed: %v", authMethod, err)
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		parsedID, err := uuid.Parse(claims.UserID)
		if err != nil {
			log.Printf("[WS] REJECT 401: invalid user_id in token claims: %q err=%v", claims.UserID, err)
			http.Error(w, "Invalid user ID", http.StatusUnauthorized)
			return
		}

		userID = parsedID
		email = claims.Email
		verified = claims.Verified
		log.Printf("[WS] auth via %s: user=%s email=%s verified=%v", authMethod, userID, email, verified)

		// Set context for downstream use (use middleware keys so all readers agree)
		ctx := context.WithValue(r.Context(), authmw.UserIDKey, userID)
		ctx = context.WithValue(ctx, authmw.UserEmailKey, email)
		ctx = context.WithValue(ctx, authmw.VerifiedKey, verified)
		r = r.WithContext(ctx)
	} else {
		log.Printf("[WS] REJECT 401: no user in context AND tokenValidator is nil")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Require verification for WebSocket access
	if !verified {
		log.Printf("[WS] REJECT 403: user=%s is not verified (authMethod=%s)", userID, authMethod)
		http.Error(w, "Age verification required", http.StatusForbidden)
		return
	}

	log.Printf("[WS] auth OK (method=%s), upgrading connection: user=%s", authMethod, userID)

	// Log all WebSocket-relevant headers so we can diagnose proxy issues
	log.Printf("[WS] upgrade headers: Upgrade=%q Connection=%q Sec-WebSocket-Version=%q Sec-WebSocket-Key=%q",
		r.Header.Get("Upgrade"),
		r.Header.Get("Connection"),
		r.Header.Get("Sec-WebSocket-Version"),
		r.Header.Get("Sec-WebSocket-Key"))

	// Upgrade to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] Upgrade FAILED for user=%s: %v (headers: Upgrade=%q Connection=%q)",
			userID, err, r.Header.Get("Upgrade"), r.Header.Get("Connection"))
		return
	}

	// Create client
	client := NewClient(h.hub, conn, userID, email, verified, h.chatService, h.callNotifier)

	// Register with hub
	h.hub.register <- client

	log.Printf("[WS] New connection established: user=%s email=%s", userID, email)

	// Start read/write pumps
	go client.WritePump()
	go client.ReadPump()
}

// GetHub returns the hub instance
func (h *Handler) GetHub() *Hub {
	return h.hub
}

// Context helpers now use authmw.GetUserID, authmw.GetUserEmail, authmw.IsVerified
// (middleware package owns the context key type, avoiding type-mismatch bugs)
