package chat

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/httputil"
	"github.com/dryft-app/backend/internal/models"
)

// Handler handles HTTP requests for chat
type Handler struct {
	service *Service
}

// NewHandler creates a new chat handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// SendMessageRequest represents a request to send a message
type SendMessageRequest struct {
	Type    string `json:"type"`    // "text", "image", "gif"
	Content string `json:"content"`
}

// GetConversations handles GET /v1/conversations
func (h *Handler) GetConversations(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	pg := httputil.ParsePagination(r, 20, 100)

	conversations, err := h.service.GetConversations(r.Context(), userID, pg.Limit, pg.Offset)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get conversations")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"conversations": conversations,
	})
}

// GetConversation handles GET /v1/conversations/{conversationID}
func (h *Handler) GetConversation(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	conversationIDStr := chi.URLParam(r, "conversationID")
	conversationID, err := uuid.Parse(conversationIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid conversation ID")
		return
	}

	conversation, err := h.service.GetConversation(r.Context(), userID, conversationID)
	if err != nil {
		if errors.Is(err, ErrConversationNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "conversation not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get conversation")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, conversation)
}

// GetMessages handles GET /v1/conversations/{conversationID}/messages
func (h *Handler) GetMessages(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	conversationIDStr := chi.URLParam(r, "conversationID")
	conversationID, err := uuid.Parse(conversationIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid conversation ID")
		return
	}

	pg := httputil.ParsePagination(r, 50, 100)

	messages, err := h.service.GetMessages(r.Context(), userID, conversationID, pg.Limit, pg.Offset)
	if err != nil {
		if errors.Is(err, ErrNotInConversation) {
			httputil.WriteError(w, http.StatusForbidden, "you are not part of this conversation")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get messages")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"messages": messages,
	})
}

// SendMessage handles POST /v1/conversations/{conversationID}/messages
func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	conversationIDStr := chi.URLParam(r, "conversationID")
	conversationID, err := uuid.Parse(conversationIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid conversation ID")
		return
	}

	var req SendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate and parse message type
	var msgType models.MessageType
	switch req.Type {
	case "text", "":
		msgType = models.MessageTypeText
	case "image":
		msgType = models.MessageTypeImage
	case "gif":
		msgType = models.MessageTypeGif
	default:
		httputil.WriteError(w, http.StatusBadRequest, "invalid message type")
		return
	}

	message, err := h.service.SendMessage(r.Context(), userID, conversationID, msgType, req.Content)
	if err != nil {
		switch {
		case errors.Is(err, ErrNotInConversation):
			httputil.WriteError(w, http.StatusForbidden, "you are not part of this conversation")
		case errors.Is(err, ErrMatchUnmatched):
			httputil.WriteError(w, http.StatusForbidden, "cannot send message to unmatched user")
		case errors.Is(err, ErrEmptyMessage):
			httputil.WriteError(w, http.StatusBadRequest, "message content cannot be empty")
		default:
			httputil.WriteError(w, http.StatusInternalServerError, "failed to send message")
		}
		return
	}

	httputil.WriteJSON(w, http.StatusCreated, message)
}

// MarkAsRead handles POST /v1/conversations/{conversationID}/read
func (h *Handler) MarkAsRead(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	conversationIDStr := chi.URLParam(r, "conversationID")
	conversationID, err := uuid.Parse(conversationIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid conversation ID")
		return
	}

	err = h.service.MarkAsRead(r.Context(), userID, conversationID)
	if err != nil {
		if errors.Is(err, ErrNotInConversation) {
			httputil.WriteError(w, http.StatusForbidden, "you are not part of this conversation")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to mark as read")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetConversationByMatch handles GET /v1/matches/{matchID}/conversation
func (h *Handler) GetConversationByMatch(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromContext(r)
	if err != nil {
		httputil.WriteError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	matchIDStr := chi.URLParam(r, "matchID")
	matchID, err := uuid.Parse(matchIDStr)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid match ID")
		return
	}

	conversation, err := h.service.GetConversationByMatch(r.Context(), userID, matchID)
	if err != nil {
		if errors.Is(err, ErrConversationNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "conversation not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to get conversation")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, conversation)
}

// Helper functions

type contextKey string

const userIDContextKey contextKey = "user_id"

func getUserIDFromContext(r *http.Request) (uuid.UUID, error) {
	if id, ok := r.Context().Value(userIDContextKey).(uuid.UUID); ok {
		return id, nil
	}
	return uuid.Nil, http.ErrNoCookie
}

