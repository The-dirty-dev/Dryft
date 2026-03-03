package chat

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/models"
)

type mockChatHandlerService struct {
	getConversationsFn       func(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.ConversationPreview, error)
	getConversationFn        func(ctx context.Context, userID, conversationID uuid.UUID) (*models.ConversationPreview, error)
	getMessagesFn            func(ctx context.Context, userID, conversationID uuid.UUID, limit, offset int) ([]models.Message, error)
	sendMessageFn            func(ctx context.Context, userID, conversationID uuid.UUID, msgType models.MessageType, content string) (*models.Message, error)
	markAsReadFn             func(ctx context.Context, userID, conversationID uuid.UUID) error
	getConversationByMatchFn func(ctx context.Context, userID, matchID uuid.UUID) (*models.ConversationPreview, error)
}

func (m *mockChatHandlerService) GetConversations(ctx context.Context, userID uuid.UUID, limit, offset int) ([]models.ConversationPreview, error) {
	if m.getConversationsFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.getConversationsFn(ctx, userID, limit, offset)
}

func (m *mockChatHandlerService) GetConversation(ctx context.Context, userID, conversationID uuid.UUID) (*models.ConversationPreview, error) {
	if m.getConversationFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.getConversationFn(ctx, userID, conversationID)
}

func (m *mockChatHandlerService) GetMessages(ctx context.Context, userID, conversationID uuid.UUID, limit, offset int) ([]models.Message, error) {
	if m.getMessagesFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.getMessagesFn(ctx, userID, conversationID, limit, offset)
}

func (m *mockChatHandlerService) SendMessage(ctx context.Context, userID, conversationID uuid.UUID, msgType models.MessageType, content string) (*models.Message, error) {
	if m.sendMessageFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.sendMessageFn(ctx, userID, conversationID, msgType, content)
}

func (m *mockChatHandlerService) MarkAsRead(ctx context.Context, userID, conversationID uuid.UUID) error {
	if m.markAsReadFn == nil {
		return errors.New("not implemented")
	}
	return m.markAsReadFn(ctx, userID, conversationID)
}

func (m *mockChatHandlerService) GetConversationByMatch(ctx context.Context, userID, matchID uuid.UUID) (*models.ConversationPreview, error) {
	if m.getConversationByMatchFn == nil {
		return nil, errors.New("not implemented")
	}
	return m.getConversationByMatchFn(ctx, userID, matchID)
}

func TestHandlerGetConversations_PassesPagination(t *testing.T) {
	userID := uuid.New()
	called := false

	h := &Handler{
		service: &mockChatHandlerService{
			getConversationsFn: func(_ context.Context, gotUserID uuid.UUID, limit, offset int) ([]models.ConversationPreview, error) {
				called = true
				if gotUserID != userID {
					t.Fatalf("unexpected userID: %s", gotUserID)
				}
				if limit != 15 || offset != 30 {
					t.Fatalf("unexpected pagination values: limit=%d offset=%d", limit, offset)
				}
				return []models.ConversationPreview{{ID: uuid.New()}}, nil
			},
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/conversations?limit=15&offset=30", nil)
	req = setUser(req, userID)
	rec := httptest.NewRecorder()

	h.GetConversations(rec, req)

	if !called {
		t.Fatal("expected service GetConversations to be called")
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestHandlerSendMessage_CreatesMessage(t *testing.T) {
	userID := uuid.New()
	conversationID := uuid.New()
	created := time.Now().UTC()

	h := &Handler{
		service: &mockChatHandlerService{
			sendMessageFn: func(_ context.Context, gotUserID, gotConversationID uuid.UUID, msgType models.MessageType, content string) (*models.Message, error) {
				if gotUserID != userID || gotConversationID != conversationID {
					t.Fatalf("unexpected IDs user=%s conversation=%s", gotUserID, gotConversationID)
				}
				if msgType != models.MessageTypeText {
					t.Fatalf("expected default text type, got %q", msgType)
				}
				if content != "hello" {
					t.Fatalf("unexpected content: %q", content)
				}
				return &models.Message{
					ID:             uuid.New(),
					ConversationID: conversationID,
					SenderID:       userID,
					Type:           msgType,
					Content:        content,
					CreatedAt:      created,
				}, nil
			},
		},
	}

	r := chi.NewRouter()
	r.Post("/{conversationID}/messages", h.SendMessage)

	req := httptest.NewRequest(http.MethodPost, "/"+conversationID.String()+"/messages", strings.NewReader(`{"content":"hello"}`))
	req = setUser(req, userID)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rec.Code)
	}
}

func TestHandlerMarkAsRead_NoContent(t *testing.T) {
	userID := uuid.New()
	conversationID := uuid.New()
	called := false

	h := &Handler{
		service: &mockChatHandlerService{
			markAsReadFn: func(_ context.Context, gotUserID, gotConversationID uuid.UUID) error {
				called = true
				if gotUserID != userID || gotConversationID != conversationID {
					t.Fatalf("unexpected IDs user=%s conversation=%s", gotUserID, gotConversationID)
				}
				return nil
			},
		},
	}

	r := chi.NewRouter()
	r.Post("/{conversationID}/read", h.MarkAsRead)

	req := httptest.NewRequest(http.MethodPost, "/"+conversationID.String()+"/read", nil)
	req = setUser(req, userID)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if !called {
		t.Fatal("expected service MarkAsRead to be called")
	}
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
}

func TestHandlerGetMessages_ForbiddenForNonParticipant(t *testing.T) {
	userID := uuid.New()
	conversationID := uuid.New()

	h := &Handler{
		service: &mockChatHandlerService{
			getMessagesFn: func(_ context.Context, _, _ uuid.UUID, _, _ int) ([]models.Message, error) {
				return nil, ErrNotInConversation
			},
		},
	}

	r := chi.NewRouter()
	r.Get("/{conversationID}/messages", h.GetMessages)

	req := httptest.NewRequest(http.MethodGet, "/"+conversationID.String()+"/messages", nil)
	req = setUser(req, userID)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rec.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
}
