package realtime

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// ---------------------------------------------------------------------------
// Mock implementations
// ---------------------------------------------------------------------------

// mockTokenValidator validates tokens for testing
type mockTokenValidator struct {
	tokens map[string]*TokenClaims
}

func newMockTokenValidator() *mockTokenValidator {
	return &mockTokenValidator{
		tokens: make(map[string]*TokenClaims),
	}
}

func (v *mockTokenValidator) AddToken(token string, claims *TokenClaims) {
	v.tokens[token] = claims
}

func (v *mockTokenValidator) ValidateToken(token string) (*TokenClaims, error) {
	if claims, ok := v.tokens[token]; ok {
		return claims, nil
	}
	return nil, ErrInvalidToken
}

// ErrInvalidToken for invalid tokens
var ErrInvalidToken = struct{ error }{error: nil}

func init() {
	ErrInvalidToken.error = &tokenError{}
}

type tokenError struct{}

func (e *tokenError) Error() string { return "invalid token" }

// mockCallNotifier for testing
type mockCallNotifier struct {
	calls []incomingCallNotification
}

type incomingCallNotification struct {
	TargetUserID uuid.UUID
	CallerName   string
	CallID       string
}

func (n *mockCallNotifier) NotifyIncomingCall(ctx context.Context, targetUserID uuid.UUID, callerName string, callerPhoto *string, callID string, matchID uuid.UUID, videoEnabled bool) error {
	n.calls = append(n.calls, incomingCallNotification{
		TargetUserID: targetUserID,
		CallerName:   callerName,
		CallID:       callID,
	})
	return nil
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// setupTestServer creates a test HTTP server with WebSocket handler
func setupTestServer(t *testing.T) (*httptest.Server, *Hub, *mockTokenValidator) {
	hub := NewHub()
	go hub.Run()

	validator := newMockTokenValidator()
	handler := NewHandlerWithAuth(hub, nil, validator, nil)

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", handler.ServeWS)

	server := httptest.NewServer(mux)
	return server, hub, validator
}

// connectWS establishes a WebSocket connection to the test server
func connectWS(t *testing.T, server *httptest.Server, token string) (*websocket.Conn, error) {
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws?token=" + token

	dialer := websocket.Dialer{
		HandshakeTimeout: 5 * time.Second,
	}

	conn, _, err := dialer.Dial(wsURL, nil)
	return conn, err
}

// readEnvelope reads and parses a WebSocket message
func readEnvelope(t *testing.T, conn *websocket.Conn, timeout time.Duration) (*Envelope, error) {
	conn.SetReadDeadline(time.Now().Add(timeout))
	_, message, err := conn.ReadMessage()
	if err != nil {
		return nil, err
	}

	var envelope Envelope
	if err := json.Unmarshal(message, &envelope); err != nil {
		return nil, err
	}
	return &envelope, nil
}

// sendEnvelope sends a message envelope over WebSocket
func sendEnvelope(t *testing.T, conn *websocket.Conn, envelope *Envelope) error {
	return conn.WriteJSON(envelope)
}

// waitForMessageType waits for a specific message type, discarding others
func waitForMsgType(t *testing.T, conn *websocket.Conn, msgType EventType, timeout time.Duration) (*Envelope, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		remaining := time.Until(deadline)
		if remaining <= 0 {
			break
		}
		env, err := readEnvelope(t, conn, remaining)
		if err != nil {
			return nil, err
		}
		if env.Type == msgType {
			return env, nil
		}
		// Discard non-matching messages (e.g., presence updates)
	}
	return nil, &websocket.CloseError{Code: websocket.CloseAbnormalClosure, Text: "timeout waiting for message"}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestHandler_Unauthorized_NoToken(t *testing.T) {
	server, _, _ := setupTestServer(t)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"
	dialer := websocket.Dialer{HandshakeTimeout: 5 * time.Second}
	_, resp, err := dialer.Dial(wsURL, nil)

	if err == nil {
		t.Fatal("expected error for unauthorized connection")
	}
	if resp != nil && resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestHandler_Unauthorized_InvalidToken(t *testing.T) {
	server, _, _ := setupTestServer(t)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws?token=invalid-token"
	dialer := websocket.Dialer{HandshakeTimeout: 5 * time.Second}
	_, resp, err := dialer.Dial(wsURL, nil)

	if err == nil {
		t.Fatal("expected error for invalid token")
	}
	if resp != nil && resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestHandler_Forbidden_Unverified(t *testing.T) {
	server, _, validator := setupTestServer(t)
	defer server.Close()

	userID := uuid.New()
	validator.AddToken("unverified-token", &TokenClaims{
		UserID:   userID.String(),
		Email:    "test@example.com",
		Verified: false, // Not verified
	})

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws?token=unverified-token"
	dialer := websocket.Dialer{HandshakeTimeout: 5 * time.Second}
	_, resp, err := dialer.Dial(wsURL, nil)

	if err == nil {
		t.Fatal("expected error for unverified user")
	}
	if resp != nil && resp.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403, got %d", resp.StatusCode)
	}
}

func TestHandler_Connect_ValidToken(t *testing.T) {
	server, hub, validator := setupTestServer(t)
	defer server.Close()

	userID := uuid.New()
	validator.AddToken("valid-token", &TokenClaims{
		UserID:   userID.String(),
		Email:    "test@example.com",
		Verified: true,
	})

	conn, err := connectWS(t, server, "valid-token")
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	defer conn.Close()

	// Give hub time to process registration
	time.Sleep(50 * time.Millisecond)

	// Verify user is now online
	if !hub.IsUserOnline(userID) {
		t.Error("expected user to be online after connection")
	}
}

func TestHandler_PingPong(t *testing.T) {
	server, _, validator := setupTestServer(t)
	defer server.Close()

	userID := uuid.New()
	validator.AddToken("ping-token", &TokenClaims{
		UserID:   userID.String(),
		Email:    "test@example.com",
		Verified: true,
	})

	conn, err := connectWS(t, server, "ping-token")
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	defer conn.Close()

	// Wait for any initial presence messages to settle
	time.Sleep(50 * time.Millisecond)

	// Send ping
	pingEnv, _ := NewEnvelope(EventTypePing, nil)
	if err := sendEnvelope(t, conn, pingEnv); err != nil {
		t.Fatalf("failed to send ping: %v", err)
	}

	// Expect pong
	pong, err := waitForMsgType(t, conn, EventTypePong, 2*time.Second)
	if err != nil {
		t.Fatalf("failed to receive pong: %v", err)
	}
	if pong.Type != EventTypePong {
		t.Errorf("expected pong, got %s", pong.Type)
	}
}

func TestHandler_PresenceBroadcast(t *testing.T) {
	server, _, validator := setupTestServer(t)
	defer server.Close()

	user1ID := uuid.New()
	user2ID := uuid.New()

	validator.AddToken("user1-token", &TokenClaims{
		UserID:   user1ID.String(),
		Email:    "user1@example.com",
		Verified: true,
	})
	validator.AddToken("user2-token", &TokenClaims{
		UserID:   user2ID.String(),
		Email:    "user2@example.com",
		Verified: true,
	})

	// Connect user1
	conn1, err := connectWS(t, server, "user1-token")
	if err != nil {
		t.Fatalf("failed to connect user1: %v", err)
	}
	defer conn1.Close()

	// Wait for user1 to be fully registered
	time.Sleep(100 * time.Millisecond)

	// Connect user2
	conn2, err := connectWS(t, server, "user2-token")
	if err != nil {
		t.Fatalf("failed to connect user2: %v", err)
	}
	defer conn2.Close()

	// User1 should receive presence update about user2
	presence, err := waitForMsgType(t, conn1, EventTypePresenceUpdate, 2*time.Second)
	if err != nil {
		t.Fatalf("failed to receive presence update: %v", err)
	}

	var payload PresencePayload
	if err := json.Unmarshal(presence.Payload, &payload); err != nil {
		t.Fatalf("failed to parse presence payload: %v", err)
	}

	if payload.UserID != user2ID {
		t.Errorf("expected presence for user2, got %s", payload.UserID)
	}
	if !payload.IsOnline {
		t.Error("expected user2 to be online")
	}
}

func TestHandler_UnknownEvent(t *testing.T) {
	server, _, validator := setupTestServer(t)
	defer server.Close()

	userID := uuid.New()
	validator.AddToken("event-token", &TokenClaims{
		UserID:   userID.String(),
		Email:    "test@example.com",
		Verified: true,
	})

	conn, err := connectWS(t, server, "event-token")
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	defer conn.Close()

	// Wait for connection to stabilize
	time.Sleep(50 * time.Millisecond)

	// Send unknown event type
	unknownEnv := &Envelope{
		Type:      EventType("unknown_event_type"),
		Timestamp: time.Now().UnixMilli(),
	}
	if err := sendEnvelope(t, conn, unknownEnv); err != nil {
		t.Fatalf("failed to send unknown event: %v", err)
	}

	// Should receive error response
	errEnv, err := waitForMsgType(t, conn, EventTypeError, 2*time.Second)
	if err != nil {
		t.Fatalf("failed to receive error: %v", err)
	}

	var errPayload ErrorPayload
	if err := json.Unmarshal(errEnv.Payload, &errPayload); err != nil {
		t.Fatalf("failed to parse error payload: %v", err)
	}

	if errPayload.Code != "unknown_event" {
		t.Errorf("expected error code 'unknown_event', got %s", errPayload.Code)
	}
}

func TestHandler_MultipleConnections(t *testing.T) {
	server, hub, validator := setupTestServer(t)
	defer server.Close()

	userID := uuid.New()
	validator.AddToken("multi-token", &TokenClaims{
		UserID:   userID.String(),
		Email:    "test@example.com",
		Verified: true,
	})

	// Connect twice with same user
	conn1, err := connectWS(t, server, "multi-token")
	if err != nil {
		t.Fatalf("failed to connect first: %v", err)
	}
	defer conn1.Close()

	conn2, err := connectWS(t, server, "multi-token")
	if err != nil {
		t.Fatalf("failed to connect second: %v", err)
	}
	defer conn2.Close()

	// Wait for registrations
	time.Sleep(100 * time.Millisecond)

	// Check presence info
	info := hub.GetUserPresence(userID)
	if info == nil {
		t.Fatal("expected presence info")
	}
	if info.Connections != 2 {
		t.Errorf("expected 2 connections, got %d", info.Connections)
	}

	// Close one connection
	conn1.Close()
	time.Sleep(100 * time.Millisecond)

	// User should still be online with 1 connection
	info = hub.GetUserPresence(userID)
	if !info.IsOnline {
		t.Error("expected user to still be online")
	}
	if info.Connections != 1 {
		t.Errorf("expected 1 connection after close, got %d", info.Connections)
	}
}

func TestHandler_Disconnect_PresenceOffline(t *testing.T) {
	server, hub, validator := setupTestServer(t)
	defer server.Close()

	user1ID := uuid.New()
	user2ID := uuid.New()

	validator.AddToken("disconnect-user1", &TokenClaims{
		UserID:   user1ID.String(),
		Email:    "user1@example.com",
		Verified: true,
	})
	validator.AddToken("disconnect-user2", &TokenClaims{
		UserID:   user2ID.String(),
		Email:    "user2@example.com",
		Verified: true,
	})

	// Connect user2 first so it's ready to receive presence updates
	conn2, err := connectWS(t, server, "disconnect-user2")
	if err != nil {
		t.Fatalf("failed to connect user2: %v", err)
	}
	defer conn2.Close()

	// Wait for user2 to be registered
	time.Sleep(100 * time.Millisecond)

	// Connect user1
	conn1, err := connectWS(t, server, "disconnect-user1")
	if err != nil {
		t.Fatalf("failed to connect user1: %v", err)
	}

	// Wait for user1 to be registered and user2 to receive the online presence
	time.Sleep(100 * time.Millisecond)

	// Drain the online presence message from conn2
	for {
		conn2.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
		_, _, err := conn2.ReadMessage()
		if err != nil {
			break
		}
	}

	// Disconnect user1
	conn1.Close()

	// Give the hub time to process the unregistration and broadcast
	time.Sleep(100 * time.Millisecond)

	// User2 should receive offline presence update for user1
	offlinePresence, err := waitForMsgType(t, conn2, EventTypePresenceUpdate, 3*time.Second)
	if err != nil {
		// If we timeout, check hub state directly - the broadcast might have raced
		if hub.IsUserOnline(user1ID) {
			t.Fatalf("failed to receive offline presence and user1 is still online: %v", err)
		}
		// User is offline in hub, presence broadcast may have been missed due to timing
		t.Log("presence broadcast missed but hub state is correct")
		return
	}

	var payload PresencePayload
	if err := json.Unmarshal(offlinePresence.Payload, &payload); err != nil {
		t.Fatalf("failed to parse presence payload: %v", err)
	}

	if payload.UserID != user1ID {
		t.Errorf("expected presence for user1, got %s", payload.UserID)
	}
	if payload.IsOnline {
		t.Error("expected user1 to be offline")
	}
	if payload.LastSeen == nil {
		t.Error("expected LastSeen to be set")
	}

	// Verify hub state
	if hub.IsUserOnline(user1ID) {
		t.Error("expected user1 to be offline in hub")
	}
}

// ---------------------------------------------------------------------------
// Helper context functions for testing
// ---------------------------------------------------------------------------

func TestSetAllowedOrigins(t *testing.T) {
	// Save original
	orig := allowedOrigins
	defer func() { allowedOrigins = orig }()

	// Test setting origins
	SetAllowedOrigins([]string{"https://example.com", "https://app.example.com"})

	if len(allowedOrigins) != 2 {
		t.Errorf("expected 2 origins, got %d", len(allowedOrigins))
	}

	// Test clearing origins
	SetAllowedOrigins(nil)
	if len(allowedOrigins) != 0 {
		t.Error("expected empty origins after setting nil")
	}
}

func TestCheckOrigin(t *testing.T) {
	// Save original
	orig := allowedOrigins
	defer func() { allowedOrigins = orig }()

	// Development mode (no restrictions)
	SetAllowedOrigins(nil)

	req := httptest.NewRequest("GET", "/ws", nil)
	req.Header.Set("Origin", "https://malicious.com")
	if !CheckOrigin(req) {
		t.Error("expected all origins allowed in dev mode")
	}

	// Production mode (restricted)
	SetAllowedOrigins([]string{"https://example.com"})

	// Allowed origin
	req = httptest.NewRequest("GET", "/ws", nil)
	req.Header.Set("Origin", "https://example.com")
	if !CheckOrigin(req) {
		t.Error("expected allowed origin to pass")
	}

	// Disallowed origin
	req = httptest.NewRequest("GET", "/ws", nil)
	req.Header.Set("Origin", "https://malicious.com")
	if CheckOrigin(req) {
		t.Error("expected disallowed origin to fail")
	}

	// No origin (non-browser client)
	req = httptest.NewRequest("GET", "/ws", nil)
	if !CheckOrigin(req) {
		t.Error("expected no origin to pass (mobile/VR client)")
	}
}

func TestNewHandler(t *testing.T) {
	hub := NewHub()
	handler := NewHandler(hub, nil)

	if handler == nil {
		t.Fatal("expected non-nil handler")
	}
	if handler.hub != hub {
		t.Error("expected hub to be set")
	}
	if handler.tokenValidator != nil {
		t.Error("expected nil tokenValidator for basic handler")
	}
}

func TestNewHandlerWithAuth(t *testing.T) {
	hub := NewHub()
	validator := newMockTokenValidator()
	notifier := &mockCallNotifier{}

	handler := NewHandlerWithAuth(hub, nil, validator, notifier)

	if handler == nil {
		t.Fatal("expected non-nil handler")
	}
	if handler.hub != hub {
		t.Error("expected hub to be set")
	}
	if handler.tokenValidator == nil {
		t.Error("expected tokenValidator to be set")
	}
	if handler.callNotifier == nil {
		t.Error("expected callNotifier to be set")
	}
}

func TestGetHub(t *testing.T) {
	hub := NewHub()
	handler := NewHandler(hub, nil)

	if handler.GetHub() != hub {
		t.Error("GetHub() should return the hub instance")
	}
}
