package chat

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/models"
)

func TestSendMessage_RejectsEmptyContent(t *testing.T) {
	svc := &Service{}
	_, err := svc.SendMessage(context.Background(), uuid.New(), uuid.New(), models.MessageTypeText, "")
	if !errors.Is(err, ErrEmptyMessage) {
		t.Fatalf("expected ErrEmptyMessage, got %v", err)
	}
}

func TestSendMessage_RejectsEmptyConversationID(t *testing.T) {
	svc := &Service{}
	_, err := svc.SendMessage(context.Background(), uuid.New(), uuid.Nil, models.MessageTypeText, "hi")
	if !errors.Is(err, ErrInvalidConversation) {
		t.Fatalf("expected ErrInvalidConversation, got %v", err)
	}
}

func TestSendMessage_RejectsEmptyUserID(t *testing.T) {
	svc := &Service{}
	_, err := svc.SendMessage(context.Background(), uuid.Nil, uuid.New(), models.MessageTypeText, "hi")
	if !errors.Is(err, ErrInvalidUserID) {
		t.Fatalf("expected ErrInvalidUserID, got %v", err)
	}
}

func TestSendMessage_ValidatesMessageType(t *testing.T) {
	svc := &Service{}
	_, err := svc.SendMessage(context.Background(), uuid.New(), uuid.New(), models.MessageType("voice"), "hello")
	if !errors.Is(err, ErrInvalidMessageType) {
		t.Fatalf("expected ErrInvalidMessageType, got %v", err)
	}
}

func TestGetConversations_RequiresValidUser(t *testing.T) {
	svc := &Service{}
	_, err := svc.GetConversations(context.Background(), uuid.Nil, 20, 0)
	if !errors.Is(err, ErrInvalidUserID) {
		t.Fatalf("expected ErrInvalidUserID, got %v", err)
	}
}

func TestMarkAsRead_RequiresValidUser(t *testing.T) {
	svc := &Service{}
	err := svc.MarkAsRead(context.Background(), uuid.Nil, uuid.New())
	if !errors.Is(err, ErrInvalidUserID) {
		t.Fatalf("expected ErrInvalidUserID, got %v", err)
	}
}

func TestGetConversationByMatch_ReturnsNilForNoMatch(t *testing.T) {
	svc := &Service{}
	_, err := svc.GetConversationByMatch(context.Background(), uuid.New(), uuid.Nil)
	if !errors.Is(err, ErrConversationNotFound) {
		t.Fatalf("expected ErrConversationNotFound for zero match id, got %v", err)
	}
}

func TestChatSentinelErrors(t *testing.T) {
	tests := map[error]string{
		ErrConversationNotFound: "conversation not found",
		ErrNotInConversation:    "you are not part of this conversation",
		ErrMessageNotFound:      "message not found",
		ErrEmptyMessage:         "message content cannot be empty",
		ErrMatchUnmatched:       "cannot send message to unmatched user",
		ErrInvalidUserID:        "invalid user id",
		ErrInvalidConversation:  "invalid conversation id",
		ErrInvalidMessageType:   "invalid message type",
	}

	for err, expected := range tests {
		if err.Error() != expected {
			t.Fatalf("expected %q, got %q", expected, err.Error())
		}
	}
}
