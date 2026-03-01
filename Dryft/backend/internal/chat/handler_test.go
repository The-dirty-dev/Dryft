package chat

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func setUser(req *http.Request, uid uuid.UUID) *http.Request {
	ctx := context.WithValue(req.Context(), userIDContextKey, uid)
	return req.WithContext(ctx)
}

// ---------------------------------------------------------------------------
// getUserIDFromContext
// ---------------------------------------------------------------------------

func TestGetUserIDFromContext_WithID(t *testing.T) {
	uid := uuid.New()
	req := httptest.NewRequest("GET", "/", nil)
	req = setUser(req, uid)

	got, err := getUserIDFromContext(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != uid {
		t.Errorf("got %v, want %v", got, uid)
	}
}

func TestGetUserIDFromContext_NoID(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	_, err := getUserIDFromContext(req)
	if err == nil {
		t.Error("expected error")
	}
}

// ---------------------------------------------------------------------------
// Auth checks
// ---------------------------------------------------------------------------

func TestGetConversations_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	req := httptest.NewRequest("GET", "/v1/conversations", nil)
	rr := httptest.NewRecorder()
	h.GetConversations(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

func TestGetConversation_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Get("/{conversationID}", h.GetConversation)

	cid := uuid.New().String()
	req := httptest.NewRequest("GET", "/"+cid, nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// Invalid UUIDs
// ---------------------------------------------------------------------------

func TestGetConversation_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Get("/{conversationID}", h.GetConversation)

	uid := uuid.New()
	req := httptest.NewRequest("GET", "/bad-uuid", nil)
	req = setUser(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestGetMessages_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Get("/{conversationID}/messages", h.GetMessages)

	uid := uuid.New()
	req := httptest.NewRequest("GET", "/bad-uuid/messages", nil)
	req = setUser(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestSendMessage_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Post("/{conversationID}/messages", h.SendMessage)

	uid := uuid.New()
	req := httptest.NewRequest("POST", "/bad-uuid/messages", strings.NewReader(`{"content":"hi"}`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// SendMessage – validation
// ---------------------------------------------------------------------------

func TestSendMessage_InvalidJSON(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Post("/{conversationID}/messages", h.SendMessage)

	uid := uuid.New()
	cid := uuid.New().String()
	req := httptest.NewRequest("POST", "/"+cid+"/messages", strings.NewReader(`bad`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestSendMessage_InvalidType(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Post("/{conversationID}/messages", h.SendMessage)

	uid := uuid.New()
	cid := uuid.New().String()
	req := httptest.NewRequest("POST", "/"+cid+"/messages", strings.NewReader(`{"type":"video","content":"hi"}`))
	req = setUser(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

func TestSendMessage_NoAuth(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Post("/{conversationID}/messages", h.SendMessage)

	cid := uuid.New().String()
	req := httptest.NewRequest("POST", "/"+cid+"/messages", strings.NewReader(`{"content":"hi"}`))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// MarkAsRead
// ---------------------------------------------------------------------------

func TestMarkAsRead_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Post("/{conversationID}/read", h.MarkAsRead)

	uid := uuid.New()
	req := httptest.NewRequest("POST", "/bad-uuid/read", nil)
	req = setUser(req, uid)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
	}
}

// ---------------------------------------------------------------------------
// GetConversationByMatch
// ---------------------------------------------------------------------------

func TestGetConversationByMatch_InvalidUUID(t *testing.T) {
	h := NewHandler(nil)
	r := chi.NewRouter()
	r.Get("/matches/{matchID}/conversation", h.GetConversationByMatch)

	uid := uuid.New()
	req := httptest.NewRequest("GET", "/matches/bad-uuid/conversation", nil)
	req = setUser(req, uid)
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
	errs := map[error]string{
		ErrConversationNotFound: "conversation not found",
		ErrNotInConversation:    "you are not part of this conversation",
		ErrMessageNotFound:      "message not found",
		ErrEmptyMessage:         "message content cannot be empty",
		ErrMatchUnmatched:       "cannot send message to unmatched user",
	}
	for err, expected := range errs {
		if err.Error() != expected {
			t.Errorf("got %q, want %q", err.Error(), expected)
		}
	}
}

// ---------------------------------------------------------------------------
// SendMessageRequest JSON
// ---------------------------------------------------------------------------

func TestSendMessageRequest_ValidTypes(t *testing.T) {
	validTypes := []string{"text", "", "image", "gif"}
	for _, typ := range validTypes {
		req := SendMessageRequest{Type: typ, Content: "hello"}
		if req.Content != "hello" {
			t.Errorf("expected content 'hello'")
		}
	}
}
