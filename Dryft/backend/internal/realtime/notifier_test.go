package realtime

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
)

func deliverQueuedUserMessages(t *testing.T, hub *Hub, count int) {
	t.Helper()
	for i := 0; i < count; i++ {
		select {
		case msg := <-hub.userBroadcast:
			hub.broadcastToUser(msg.UserID, msg.Message)
		case <-time.After(500 * time.Millisecond):
			t.Fatalf("timed out waiting for queued user message %d/%d", i+1, count)
		}
	}
}

func TestNotifierNotifyNewMatch_DeliversToBothUsers(t *testing.T) {
	hub := NewHub()
	n := NewNotifier(hub)

	userA := uuid.New()
	userB := uuid.New()
	matchID := uuid.New()
	conversationID := uuid.New()

	clientA := newTestClient(hub, userA)
	clientB := newTestClient(hub, userB)
	hub.registerClient(clientA)
	hub.registerClient(clientB)
	drainChannel(clientA)
	drainChannel(clientB)

	n.NotifyNewMatch(matchID, conversationID, userA, userB, "Alice", "Bob", nil, nil, time.Now().UnixMilli())
	deliverQueuedUserMessages(t, hub, 2)

	envA := waitForMessageType(clientA, EventTypeNewMatch, time.Second)
	envB := waitForMessageType(clientB, EventTypeNewMatch, time.Second)
	if envA == nil || envB == nil {
		t.Fatal("expected new_match envelopes for both users")
	}
	if envA.Type != EventTypeNewMatch || envB.Type != EventTypeNewMatch {
		t.Fatalf("expected new_match envelopes, got %s and %s", envA.Type, envB.Type)
	}

	var payloadA NewMatchPayload
	if err := json.Unmarshal(envA.Payload, &payloadA); err != nil {
		t.Fatalf("unmarshal payload A: %v", err)
	}
	if payloadA.User.ID != userB {
		t.Fatalf("expected user A payload to reference user B, got %s", payloadA.User.ID)
	}

	var payloadB NewMatchPayload
	if err := json.Unmarshal(envB.Payload, &payloadB); err != nil {
		t.Fatalf("unmarshal payload B: %v", err)
	}
	if payloadB.User.ID != userA {
		t.Fatalf("expected user B payload to reference user A, got %s", payloadB.User.ID)
	}
}

func TestNotifierNotifyUnmatch_DeliversToTargetUser(t *testing.T) {
	hub := NewHub()
	n := NewNotifier(hub)

	userID := uuid.New()
	client := newTestClient(hub, userID)
	hub.registerClient(client)
	drainChannel(client)

	n.NotifyUnmatch(uuid.New(), uuid.New(), userID)
	deliverQueuedUserMessages(t, hub, 1)

	env := waitForMessageType(client, EventTypeUnmatched, time.Second)
	if env == nil {
		t.Fatal("expected unmatched event envelope")
	}
	if env.Type != EventTypeUnmatched {
		t.Fatalf("expected unmatched event, got %s", env.Type)
	}
}

func TestNotifierPresenceHelpers(t *testing.T) {
	hub := NewHub()
	n := NewNotifier(hub)

	onlineUser := uuid.New()
	offlineUser := uuid.New()
	client := newTestClient(hub, onlineUser)
	hub.registerClient(client)
	drainChannel(client)

	if !n.IsUserOnline(onlineUser) {
		t.Fatal("expected online user to be reported online")
	}
	if n.IsUserOnline(offlineUser) {
		t.Fatal("expected offline user to be reported offline")
	}

	presence := n.GetPresence(onlineUser)
	if presence == nil || !presence.IsOnline {
		t.Fatalf("expected non-nil online presence, got %+v", presence)
	}

	online := n.GetOnlineUsers([]uuid.UUID{onlineUser, offlineUser})
	if !online[onlineUser] {
		t.Fatal("expected online user entry to be true")
	}
	if online[offlineUser] {
		t.Fatal("expected offline user entry to be false")
	}
}

func TestNotifierNotifyNewMessage_OfflineRecipientNoPanic(t *testing.T) {
	hub := NewHub()
	n := NewNotifier(hub)

	n.NotifyNewMessage(uuid.New(), uuid.New(), NewMessagePayload{
		ID:             uuid.New(),
		ConversationID: uuid.New(),
		SenderID:       uuid.New(),
		Type:           "text",
		Content:        "hello",
		CreatedAt:      time.Now().UnixMilli(),
	})

	// Message should still be queued and processable even if there are no active clients.
	deliverQueuedUserMessages(t, hub, 1)
}
