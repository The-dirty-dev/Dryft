//go:build integration

package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/chat"
	"github.com/dryft-app/backend/internal/config"
	authmw "github.com/dryft-app/backend/internal/middleware"
	"github.com/dryft-app/backend/internal/testutil"

	"context"
)

// noopChatNotifier satisfies ChatNotifier without side effects.
type noopChatNotifier struct{}

func (n *noopChatNotifier) NotifyNewMessage(_ context.Context, _ uuid.UUID, _, _ string, _ uuid.UUID) error {
	return nil
}

func newChatRouter(t *testing.T) *chi.Mux {
	t.Helper()

	cfg := &config.Config{JWTSecretKey: testutil.TestJWTSecret, Environment: "development"}
	authSvc := authServiceForTest(cfg)
	mw := authmw.NewAuthMiddleware(&tokenValidatorAdapter{service: authSvc})

	chatSvc := chat.NewService(tdb.DB, &noopChatNotifier{})
	chatHandler := chat.NewHandler(chatSvc)

	r := chi.NewRouter()
	r.Route("/v1/conversations", func(r chi.Router) {
		r.Use(mw.RequireAuth)
		r.Get("/", chatHandler.GetConversations)
		r.Get("/{conversationID}", chatHandler.GetConversation)
		r.Get("/{conversationID}/messages", chatHandler.GetMessages)
		r.Post("/{conversationID}/messages", chatHandler.SendMessage)
		r.Post("/{conversationID}/read", chatHandler.MarkAsRead)
	})
	return r
}

func TestSendAndGetMessages(t *testing.T) {
	tdb.TruncateAll(t.Context())

	aliceID, _ := testutil.CreateTestUser(tdb, "alice@chat.com", "Pass1234!")
	bobID, _ := testutil.CreateTestUser(tdb, "bob@chat.com", "Pass1234!")
	_, convID, err := testutil.CreateTestMatch(tdb, aliceID, bobID)
	if err != nil {
		t.Fatal(err)
	}

	aliceToken, _ := testutil.GenerateTestToken(aliceID.String(), "alice@chat.com", true)
	bobToken, _ := testutil.GenerateTestToken(bobID.String(), "bob@chat.com", true)

	r := newChatRouter(t)

	// Alice sends a message
	body := `{"type":"text","content":"Hello Bob!"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/conversations/"+convID.String()+"/messages", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+aliceToken)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated && rr.Code != http.StatusOK {
		t.Fatalf("send message: expected 200/201, got %d: %s", rr.Code, rr.Body.String())
	}

	// Bob reads messages
	req = httptest.NewRequest(http.MethodGet, "/v1/conversations/"+convID.String()+"/messages", nil)
	req.Header.Set("Authorization", "Bearer "+bobToken)
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("get messages: expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var msgResp map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&msgResp)

	messages, ok := msgResp["messages"].([]interface{})
	if !ok {
		t.Fatalf("expected messages array, got %T", msgResp["messages"])
	}
	if len(messages) != 1 {
		t.Errorf("expected 1 message, got %d", len(messages))
	}
}

func TestGetConversations_AfterMatch(t *testing.T) {
	tdb.TruncateAll(t.Context())

	aliceID, _ := testutil.CreateTestUser(tdb, "alice@conv.com", "Pass1234!")
	bobID, _ := testutil.CreateTestUser(tdb, "bob@conv.com", "Pass1234!")
	_, _, err := testutil.CreateTestMatch(tdb, aliceID, bobID)
	if err != nil {
		t.Fatal(err)
	}

	aliceToken, _ := testutil.GenerateTestToken(aliceID.String(), "alice@conv.com", true)

	r := newChatRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/conversations", nil)
	req.Header.Set("Authorization", "Bearer "+aliceToken)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("get conversations: expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestMarkAsRead(t *testing.T) {
	tdb.TruncateAll(t.Context())

	aliceID, _ := testutil.CreateTestUser(tdb, "alice@read.com", "Pass1234!")
	bobID, _ := testutil.CreateTestUser(tdb, "bob@read.com", "Pass1234!")
	_, convID, _ := testutil.CreateTestMatch(tdb, aliceID, bobID)

	aliceToken, _ := testutil.GenerateTestToken(aliceID.String(), "alice@read.com", true)

	r := newChatRouter(t)

	req := httptest.NewRequest(http.MethodPost, "/v1/conversations/"+convID.String()+"/read", nil)
	req.Header.Set("Authorization", "Bearer "+aliceToken)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("mark as read: expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestSendMessage_UnauthorizedConversation(t *testing.T) {
	tdb.TruncateAll(t.Context())

	aliceID, _ := testutil.CreateTestUser(tdb, "alice@unauth.com", "Pass1234!")
	bobID, _ := testutil.CreateTestUser(tdb, "bob@unauth.com", "Pass1234!")
	eveID, _ := testutil.CreateTestUser(tdb, "eve@unauth.com", "Pass1234!")
	_, convID, _ := testutil.CreateTestMatch(tdb, aliceID, bobID)

	// Eve tries to send a message in Alice+Bob's conversation
	eveToken, _ := testutil.GenerateTestToken(eveID.String(), "eve@unauth.com", true)

	r := newChatRouter(t)

	body := `{"type":"text","content":"I shouldn't be here"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/conversations/"+convID.String()+"/messages", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+eveToken)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	// Should be forbidden or not found
	if rr.Code == http.StatusOK || rr.Code == http.StatusCreated {
		t.Errorf("eve should not be able to send in alice+bob's conversation, got %d", rr.Code)
	}
}
