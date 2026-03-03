package chat

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/models"
)

func BenchmarkMessageSerialization(b *testing.B) {
	b.ReportAllocs()
	msg := models.Message{
		ID:             uuid.New(),
		ConversationID: uuid.New(),
		SenderID:       uuid.New(),
		Type:           models.MessageTypeText,
		Content:        "hello world from benchmark",
		CreatedAt:      time.Now(),
	}

	for i := 0; i < b.N; i++ {
		payload, err := json.Marshal(msg)
		if err != nil {
			b.Fatalf("marshal: %v", err)
		}
		var out models.Message
		if err := json.Unmarshal(payload, &out); err != nil {
			b.Fatalf("unmarshal: %v", err)
		}
	}
}

func BenchmarkConversationListAggregation(b *testing.B) {
	b.ReportAllocs()
	messages := make([]models.Message, 500)
	now := time.Now()
	for i := range messages {
		messages[i] = models.Message{
			ID:             uuid.New(),
			ConversationID: uuid.New(),
			SenderID:       uuid.New(),
			Type:           models.MessageTypeText,
			Content:        "preview text",
			CreatedAt:      now,
		}
	}

	for i := 0; i < b.N; i++ {
		unread := 0
		for j := range messages {
			preview := messages[j].ToPreview(30)
			if !preview.IsRead {
				unread++
			}
		}
		if unread < 0 {
			b.Fatalf("invalid unread count: %d", unread)
		}
	}
}

func BenchmarkUnreadCountAggregation(b *testing.B) {
	b.ReportAllocs()
	readAt := time.Now()
	msgs := make([]models.Message, 1000)
	for i := range msgs {
		msgs[i] = models.Message{ID: uuid.New()}
		if i%3 == 0 {
			msgs[i].ReadAt = &readAt
		}
	}

	for i := 0; i < b.N; i++ {
		count := 0
		for j := range msgs {
			if msgs[j].ReadAt == nil {
				count++
			}
		}
		if count < 0 {
			b.Fatalf("invalid count: %d", count)
		}
	}
}
