//go:build integration

package chat

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/dryft-app/backend/internal/models"
	"github.com/dryft-app/backend/internal/testutil"
)

func TestServiceSendMessage(t *testing.T) {
	tdb, err := testutil.SetupTestDB()
	if err != nil {
		t.Fatalf("setup db: %v", err)
	}
	defer tdb.Teardown()

	ctx := context.Background()

	userA, err := testutil.CreateTestUser(tdb, "chat-a@example.com", "password")
	if err != nil {
		t.Fatalf("create user A: %v", err)
	}
	userB, err := testutil.CreateTestUser(tdb, "chat-b@example.com", "password")
	if err != nil {
		t.Fatalf("create user B: %v", err)
	}

	matchID := uuid.New()
	_, err = tdb.DB.Pool.Exec(ctx,
		"INSERT INTO matches (id, user_a, user_b, matched_at) VALUES ($1, $2, $3, NOW())",
		matchID, userA, userB,
	)
	if err != nil {
		t.Fatalf("insert match: %v", err)
	}

	conversationID := uuid.New()
	_, err = tdb.DB.Pool.Exec(ctx,
		"INSERT INTO conversations (id, match_id, user_a_id, user_b_id) VALUES ($1, $2, $3, $4)",
		conversationID, matchID, userA, userB,
	)
	if err != nil {
		t.Fatalf("insert conversation: %v", err)
	}

	svc := NewService(tdb.DB, nil)
	msg, err := svc.SendMessage(ctx, userA, conversationID, models.MessageTypeText, "Hello")
	if err != nil {
		t.Fatalf("send message: %v", err)
	}

	if msg == nil || msg.Content != "Hello" {
		t.Fatalf("unexpected message payload: %+v", msg)
	}

	var count int
	if err := tdb.DB.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM messages WHERE conversation_id = $1", conversationID).Scan(&count); err != nil {
		t.Fatalf("query messages: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 message, got %d", count)
	}
}

func TestServiceSendMessageRejectsEmpty(t *testing.T) {
	svc := NewService(nil, nil)
	if _, err := svc.SendMessage(context.Background(), uuid.New(), uuid.New(), models.MessageTypeText, ""); err != ErrEmptyMessage {
		t.Fatalf("expected ErrEmptyMessage, got %v", err)
	}
}

func TestServiceSendMessageRejectsUnmatched(t *testing.T) {
	tdb, err := testutil.SetupTestDB()
	if err != nil {
		t.Fatalf("setup db: %v", err)
	}
	defer tdb.Teardown()

	ctx := context.Background()

	userA, err := testutil.CreateTestUser(tdb, "unmatched-a@example.com", "password")
	if err != nil {
		t.Fatalf("create user A: %v", err)
	}
	userB, err := testutil.CreateTestUser(tdb, "unmatched-b@example.com", "password")
	if err != nil {
		t.Fatalf("create user B: %v", err)
	}

	matchID := uuid.New()
	_, err = tdb.DB.Pool.Exec(ctx,
		"INSERT INTO matches (id, user_a, user_b, matched_at, unmatched_at) VALUES ($1, $2, $3, NOW(), NOW())",
		matchID, userA, userB,
	)
	if err != nil {
		t.Fatalf("insert match: %v", err)
	}

	conversationID := uuid.New()
	_, err = tdb.DB.Pool.Exec(ctx,
		"INSERT INTO conversations (id, match_id, user_a_id, user_b_id) VALUES ($1, $2, $3, $4)",
		conversationID, matchID, userA, userB,
	)
	if err != nil {
		t.Fatalf("insert conversation: %v", err)
	}

	svc := NewService(tdb.DB, nil)
	if _, err := svc.SendMessage(ctx, userA, conversationID, models.MessageTypeText, "hello"); err != ErrMatchUnmatched {
		t.Fatalf("expected ErrMatchUnmatched, got %v", err)
	}
}
