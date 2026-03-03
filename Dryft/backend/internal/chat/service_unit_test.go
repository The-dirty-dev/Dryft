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

func TestChatSentinelErrors(t *testing.T) {
	tests := map[error]string{
		ErrConversationNotFound: "conversation not found",
		ErrNotInConversation:    "you are not part of this conversation",
		ErrMessageNotFound:      "message not found",
		ErrEmptyMessage:         "message content cannot be empty",
		ErrMatchUnmatched:       "cannot send message to unmatched user",
	}

	for err, expected := range tests {
		if err.Error() != expected {
			t.Fatalf("expected %q, got %q", expected, err.Error())
		}
	}
}
