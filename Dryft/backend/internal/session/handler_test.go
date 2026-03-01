package session

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func setUserIDCtx(req *http.Request, uid uuid.UUID) *http.Request {
	ctx := context.WithValue(req.Context(), userIDContextKey, uid)
	return req.WithContext(ctx)
}

// ---------------------------------------------------------------------------
// getUserIDFromContext
// ---------------------------------------------------------------------------

func TestGetUserIDFromContext_WithID(t *testing.T) {
	uid := uuid.New()
	req := httptest.NewRequest("GET", "/", nil)
	req = setUserIDCtx(req, uid)

	got, ok := getUserIDFromContext(req)
	if !ok {
		t.Fatal("expected ok=true")
	}
	if got != uid {
		t.Errorf("got %v, want %v", got, uid)
	}
}

func TestGetUserIDFromContext_NoID(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	_, ok := getUserIDFromContext(req)
	if ok {
		t.Error("expected ok=false")
	}
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

func TestRegisterRoutes_Structure(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	h.RegisterRoutes(r)

	routes := []struct {
		method string
		path   string
	}{
		{"POST", "/"},
		{"GET", "/active"},
		{"POST", "/join"},
		{"GET", "/{sessionId}"},
		{"DELETE", "/{sessionId}"},
		{"POST", "/{sessionId}/leave"},
		{"POST", "/{sessionId}/haptic-permission"},
		{"POST", "/{sessionId}/chat"},
		{"POST", "/{sessionId}/haptic"},
	}

	for _, rt := range routes {
		rctx := chi.NewRouteContext()
		if !r.Match(rctx, rt.method, rt.path) {
			t.Errorf("route %s %s not registered", rt.method, rt.path)
		}
	}
}

// ---------------------------------------------------------------------------
// Auth checks (no user ID -> 401)
// ---------------------------------------------------------------------------

func TestCreateSession_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("POST", "/", strings.NewReader(`{}`))
	rr := httptest.NewRecorder()

	h.CreateSession(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetActiveSession_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("GET", "/active", nil)
	rr := httptest.NewRecorder()

	h.GetActiveSession(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestJoinSession_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("POST", "/join", strings.NewReader(`{"session_code":"ABC"}`))
	rr := httptest.NewRecorder()

	h.JoinSession(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// JoinSession – validation
// ---------------------------------------------------------------------------

func TestJoinSession_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/join", strings.NewReader(`bad`))
	req = setUserIDCtx(req, uid)
	rr := httptest.NewRecorder()

	h.JoinSession(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestJoinSession_EmptyCode(t *testing.T) {
	h := NewHandler(nil)
	uid := uuid.New()
	req := httptest.NewRequest("POST", "/join", strings.NewReader(`{"session_code":""}`))
	req = setUserIDCtx(req, uid)
	rr := httptest.NewRecorder()

	h.JoinSession(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// GetSession – invalid UUID
// ---------------------------------------------------------------------------

func TestGetSession_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Get("/{sessionId}", h.GetSession)

	uid := uuid.New()
	req := httptest.NewRequest("GET", "/bad-uuid", nil)
	req = setUserIDCtx(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestGetSession_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Get("/{sessionId}", h.GetSession)

	sid := uuid.New().String()
	req := httptest.NewRequest("GET", "/"+sid, nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// EndSession – invalid UUID
// ---------------------------------------------------------------------------

func TestEndSession_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Delete("/{sessionId}", h.EndSession)

	uid := uuid.New()
	req := httptest.NewRequest("DELETE", "/bad-uuid", nil)
	req = setUserIDCtx(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// LeaveSession – invalid UUID
// ---------------------------------------------------------------------------

func TestLeaveSession_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Post("/{sessionId}/leave", h.LeaveSession)

	uid := uuid.New()
	req := httptest.NewRequest("POST", "/bad-uuid/leave", nil)
	req = setUserIDCtx(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// SendChat – validation
// ---------------------------------------------------------------------------

func TestSendChat_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Post("/{sessionId}/chat", h.SendChat)

	sid := uuid.New().String()
	req := httptest.NewRequest("POST", "/"+sid+"/chat", strings.NewReader(`{"content":"hi"}`))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestSendChat_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Post("/{sessionId}/chat", h.SendChat)

	uid := uuid.New()
	sid := uuid.New().String()
	req := httptest.NewRequest("POST", "/"+sid+"/chat", strings.NewReader(`bad`))
	req = setUserIDCtx(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestSendChat_EmptyContent(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Post("/{sessionId}/chat", h.SendChat)

	uid := uuid.New()
	sid := uuid.New().String()
	req := httptest.NewRequest("POST", "/"+sid+"/chat", strings.NewReader(`{"content":""}`))
	req = setUserIDCtx(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// SetHapticPermission – invalid JSON
// ---------------------------------------------------------------------------

func TestSetHapticPermission_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Post("/{sessionId}/haptic-permission", h.SetHapticPermission)

	uid := uuid.New()
	sid := uuid.New().String()
	req := httptest.NewRequest("POST", "/"+sid+"/haptic-permission", strings.NewReader(`bad`))
	req = setUserIDCtx(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// Sentinel errors
// ---------------------------------------------------------------------------

func TestSentinelErrors(t *testing.T) {
	errors := map[error]string{
		ErrSessionNotFound:    "session not found",
		ErrSessionExpired:     "session has expired",
		ErrSessionFull:        "session is full",
		ErrAlreadyInSession:   "already in session",
		ErrNotInSession:       "not in session",
		ErrNotSessionHost:     "not session host",
		ErrInvalidSessionCode: "invalid session code",
		ErrPermissionDenied:   "permission denied",
	}
	for err, expected := range errors {
		if err.Error() != expected {
			t.Errorf("got %q, want %q", err.Error(), expected)
		}
	}
}

// ---------------------------------------------------------------------------
// SendHaptic – invalid JSON
// ---------------------------------------------------------------------------

func TestSendHaptic_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Post("/{sessionId}/haptic", h.SendHaptic)

	uid := uuid.New()
	sid := uuid.New().String()
	req := httptest.NewRequest("POST", "/"+sid+"/haptic", strings.NewReader(`bad`))
	req = setUserIDCtx(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// JSON response format check
// ---------------------------------------------------------------------------

func TestErrorResponse_Format(t *testing.T) {
	// Verify WriteError produces the expected format
	rr := httptest.NewRecorder()
	h := NewHandler(nil)
	req := httptest.NewRequest("POST", "/", nil)
	h.CreateSession(rr, req) // No auth -> 401

	var body map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["error"] != "unauthorized" {
		t.Errorf("expected error 'unauthorized', got %q", body["error"])
	}
}
