package realtime

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

// newTestClient creates a minimal Client suitable for hub tests.
// conn, chatService, and callNotifier are nil since we are not doing
// any WebSocket I/O or database operations in these tests.
func newTestClient(hub *Hub, userID uuid.UUID) *Client {
	return &Client{
		hub:           hub,
		conn:          nil,
		UserID:        userID,
		Email:         userID.String() + "@test.com",
		Verified:      true,
		subscriptions: make(map[uuid.UUID]bool),
		send:          make(chan *Envelope, 256),
		chatService:   nil,
		callNotifier:  nil,
	}
}

// drainChannel removes all pending messages from a client's send channel
// and returns them.
func drainChannel(c *Client) []*Envelope {
	var msgs []*Envelope
	for {
		select {
		case msg := <-c.send:
			msgs = append(msgs, msg)
		default:
			return msgs
		}
	}
}

// waitForMessageType waits for a specific message type on the channel,
// draining and ignoring any other messages (e.g., presence updates).
// Returns the matching envelope or nil if timed out.
func waitForMessageType(c *Client, msgType EventType, timeout time.Duration) *Envelope {
	deadline := time.After(timeout)
	for {
		select {
		case msg := <-c.send:
			if msg.Type == msgType {
				return msg
			}
			// discard non-matching messages (e.g., presence broadcasts)
		case <-deadline:
			return nil
		}
	}
}

// hasNoMessageOfType checks that no message of the given type is in the channel.
// It drains the channel and returns true if no matching message was found.
func hasNoMessageOfType(c *Client, msgType EventType) bool {
	msgs := drainChannel(c)
	for _, msg := range msgs {
		if msg.Type == msgType {
			return false
		}
	}
	return true
}

func TestNewHub(t *testing.T) {
	hub := NewHub()

	if hub == nil {
		t.Fatal("NewHub() returned nil")
	}
	if hub.clients == nil {
		t.Error("expected clients map to be initialized")
	}
	if hub.conversations == nil {
		t.Error("expected conversations map to be initialized")
	}
	if hub.presence == nil {
		t.Error("expected presence map to be initialized")
	}
	if hub.register == nil {
		t.Error("expected register channel to be initialized")
	}
	if hub.unregister == nil {
		t.Error("expected unregister channel to be initialized")
	}
	if hub.userBroadcast == nil {
		t.Error("expected userBroadcast channel to be initialized")
	}
	if hub.convBroadcast == nil {
		t.Error("expected convBroadcast channel to be initialized")
	}
}

func TestRegisterClient(t *testing.T) {
	hub := NewHub()
	userID := uuid.New()
	client := newTestClient(hub, userID)

	hub.registerClient(client)

	// Check clients map
	hub.mu.RLock()
	defer hub.mu.RUnlock()

	clients, ok := hub.clients[userID]
	if !ok {
		t.Fatal("expected user to be in clients map after registration")
	}
	if !clients[client] {
		t.Error("expected client to be in user's client set")
	}

	// Check presence
	info, ok := hub.presence[userID]
	if !ok {
		t.Fatal("expected user to have presence info after registration")
	}
	if !info.IsOnline {
		t.Error("expected user to be online after registration")
	}
	if info.Connections != 1 {
		t.Errorf("expected 1 connection, got %d", info.Connections)
	}
}

func TestRegisterClient_MultipleConnections(t *testing.T) {
	hub := NewHub()
	userID := uuid.New()
	client1 := newTestClient(hub, userID)
	client2 := newTestClient(hub, userID)

	hub.registerClient(client1)
	hub.registerClient(client2)

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	clients := hub.clients[userID]
	if len(clients) != 2 {
		t.Errorf("expected 2 clients for user, got %d", len(clients))
	}

	info := hub.presence[userID]
	if info.Connections != 2 {
		t.Errorf("expected 2 connections, got %d", info.Connections)
	}
	if !info.IsOnline {
		t.Error("expected user to be online with 2 connections")
	}
}

func TestUnregisterClient(t *testing.T) {
	hub := NewHub()
	userID := uuid.New()
	client := newTestClient(hub, userID)

	hub.registerClient(client)
	hub.unregisterClient(client)

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	// Client should be removed
	if clients, ok := hub.clients[userID]; ok && len(clients) > 0 {
		t.Error("expected user's client set to be empty after unregistration")
	}

	// Presence should show offline
	info := hub.presence[userID]
	if info == nil {
		t.Fatal("expected presence info to still exist after unregistration")
	}
	if info.IsOnline {
		t.Error("expected user to be offline after unregistration")
	}
	if info.Connections != 0 {
		t.Errorf("expected 0 connections, got %d", info.Connections)
	}
	if info.LastSeen.IsZero() {
		t.Error("expected LastSeen to be set after going offline")
	}
}

func TestUnregisterClient_PartialDisconnect(t *testing.T) {
	hub := NewHub()
	userID := uuid.New()
	client1 := newTestClient(hub, userID)
	client2 := newTestClient(hub, userID)

	hub.registerClient(client1)
	hub.registerClient(client2)

	// Unregister only one
	hub.unregisterClient(client1)

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	// User should still have one client
	clients := hub.clients[userID]
	if len(clients) != 1 {
		t.Errorf("expected 1 client remaining, got %d", len(clients))
	}

	// User should still be online
	info := hub.presence[userID]
	if !info.IsOnline {
		t.Error("expected user to remain online with 1 connection remaining")
	}
	if info.Connections != 1 {
		t.Errorf("expected 1 connection, got %d", info.Connections)
	}
}

func TestUnregisterClient_RemovesFromConversations(t *testing.T) {
	hub := NewHub()
	userID := uuid.New()
	convID := uuid.New()
	client := newTestClient(hub, userID)

	hub.registerClient(client)
	hub.Subscribe(client, convID)

	// Verify subscription exists
	hub.mu.RLock()
	_, hasSub := hub.conversations[convID]
	hub.mu.RUnlock()
	if !hasSub {
		t.Fatal("expected conversation to have subscribers before unregister")
	}

	hub.unregisterClient(client)

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	// Conversation entry should be cleaned up since no subscribers remain
	if subs, ok := hub.conversations[convID]; ok && len(subs) > 0 {
		t.Error("expected conversation subscribers to be cleaned up after unregister")
	}
}

func TestSubscribe(t *testing.T) {
	hub := NewHub()
	userID := uuid.New()
	convID := uuid.New()
	client := newTestClient(hub, userID)

	hub.registerClient(client)
	hub.Subscribe(client, convID)

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	// Check conversation subscribers
	subs, ok := hub.conversations[convID]
	if !ok {
		t.Fatal("expected conversation to exist in conversations map")
	}
	if !subs[client] {
		t.Error("expected client to be in conversation subscribers")
	}

	// Check client subscriptions
	if !client.subscriptions[convID] {
		t.Error("expected conversation to be in client's subscriptions")
	}
}

func TestSubscribe_MultipleClients(t *testing.T) {
	hub := NewHub()
	convID := uuid.New()

	user1 := uuid.New()
	user2 := uuid.New()
	client1 := newTestClient(hub, user1)
	client2 := newTestClient(hub, user2)

	hub.registerClient(client1)
	hub.registerClient(client2)
	hub.Subscribe(client1, convID)
	hub.Subscribe(client2, convID)

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	subs := hub.conversations[convID]
	if len(subs) != 2 {
		t.Errorf("expected 2 subscribers, got %d", len(subs))
	}
}

func TestUnsubscribe(t *testing.T) {
	hub := NewHub()
	userID := uuid.New()
	convID := uuid.New()
	client := newTestClient(hub, userID)

	hub.registerClient(client)
	hub.Subscribe(client, convID)
	hub.Unsubscribe(client, convID)

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	// Conversation entry should be cleaned up since no subscribers remain
	if subs, ok := hub.conversations[convID]; ok && len(subs) > 0 {
		t.Error("expected conversation to be cleaned up after last subscriber leaves")
	}

	// Client subscriptions should be cleaned up
	if client.subscriptions[convID] {
		t.Error("expected client subscription to be removed")
	}
}

func TestUnsubscribe_LeavesOtherSubscribers(t *testing.T) {
	hub := NewHub()
	convID := uuid.New()

	user1 := uuid.New()
	user2 := uuid.New()
	client1 := newTestClient(hub, user1)
	client2 := newTestClient(hub, user2)

	hub.registerClient(client1)
	hub.registerClient(client2)
	hub.Subscribe(client1, convID)
	hub.Subscribe(client2, convID)

	hub.Unsubscribe(client1, convID)

	hub.mu.RLock()
	defer hub.mu.RUnlock()

	subs := hub.conversations[convID]
	if len(subs) != 1 {
		t.Errorf("expected 1 subscriber remaining, got %d", len(subs))
	}
	if !subs[client2] {
		t.Error("expected client2 to remain subscribed")
	}
}

func TestIsUserOnline(t *testing.T) {
	hub := NewHub()

	userID := uuid.New()
	nonExistentUser := uuid.New()
	client := newTestClient(hub, userID)

	// Before registration
	if hub.IsUserOnline(userID) {
		t.Error("expected user to be offline before registration")
	}

	// After registration
	hub.registerClient(client)
	if !hub.IsUserOnline(userID) {
		t.Error("expected user to be online after registration")
	}

	// Non-existent user
	if hub.IsUserOnline(nonExistentUser) {
		t.Error("expected non-existent user to be offline")
	}

	// After unregistration
	hub.unregisterClient(client)
	if hub.IsUserOnline(userID) {
		t.Error("expected user to be offline after unregistration")
	}
}

func TestGetOnlineUsers(t *testing.T) {
	hub := NewHub()

	user1 := uuid.New()
	user2 := uuid.New()
	user3 := uuid.New() // will not be registered
	user4 := uuid.New()

	client1 := newTestClient(hub, user1)
	client2 := newTestClient(hub, user2)
	client4 := newTestClient(hub, user4)

	hub.registerClient(client1)
	hub.registerClient(client2)
	hub.registerClient(client4)

	// Unregister user4 to make them offline
	hub.unregisterClient(client4)

	queryIDs := []uuid.UUID{user1, user2, user3, user4}
	result := hub.GetOnlineUsers(queryIDs)

	if !result[user1] {
		t.Error("expected user1 to be online")
	}
	if !result[user2] {
		t.Error("expected user2 to be online")
	}
	if result[user3] {
		t.Error("expected user3 (never registered) to not be in online set")
	}
	if result[user4] {
		t.Error("expected user4 (unregistered) to not be in online set")
	}

	// Expected count: 2 online users
	if len(result) != 2 {
		t.Errorf("expected 2 online users, got %d", len(result))
	}
}

func TestGetOnlineUsers_EmptyQuery(t *testing.T) {
	hub := NewHub()

	result := hub.GetOnlineUsers([]uuid.UUID{})
	if len(result) != 0 {
		t.Errorf("expected empty result for empty query, got %d", len(result))
	}
}

func TestGetUserPresence(t *testing.T) {
	hub := NewHub()
	userID := uuid.New()
	client := newTestClient(hub, userID)

	// Before registration: nil
	if info := hub.GetUserPresence(userID); info != nil {
		t.Error("expected nil presence before registration")
	}

	// After registration
	hub.registerClient(client)
	info := hub.GetUserPresence(userID)
	if info == nil {
		t.Fatal("expected non-nil presence after registration")
	}
	if !info.IsOnline {
		t.Error("expected IsOnline=true after registration")
	}
	if info.Connections != 1 {
		t.Errorf("expected 1 connection, got %d", info.Connections)
	}

	// After unregistration
	hub.unregisterClient(client)
	info = hub.GetUserPresence(userID)
	if info == nil {
		t.Fatal("expected non-nil presence after unregistration")
	}
	if info.IsOnline {
		t.Error("expected IsOnline=false after unregistration")
	}
	if info.LastSeen.IsZero() {
		t.Error("expected LastSeen to be set after going offline")
	}
}

func TestBroadcastToUser(t *testing.T) {
	hub := NewHub()

	userA := uuid.New()
	userB := uuid.New()
	clientA1 := newTestClient(hub, userA)
	clientA2 := newTestClient(hub, userA)
	clientB := newTestClient(hub, userB)

	hub.registerClient(clientA1)
	hub.registerClient(clientA2)
	hub.registerClient(clientB)

	// Wait for async presence broadcasts to settle
	time.Sleep(50 * time.Millisecond)

	// Drain any presence messages that arrived during registration
	drainChannel(clientA1)
	drainChannel(clientA2)
	drainChannel(clientB)

	// Create a test envelope
	envelope, err := NewEnvelope(EventTypeNewMessage, map[string]string{"text": "hello"})
	if err != nil {
		t.Fatalf("failed to create envelope: %v", err)
	}

	// Broadcast to userA (calls the unexported method directly)
	hub.broadcastToUser(userA, envelope)

	// Both of userA's clients should receive the message
	msg := waitForMessageType(clientA1, EventTypeNewMessage, 100*time.Millisecond)
	if msg == nil {
		t.Error("clientA1: expected to receive a new_message, but timed out")
	}

	msg = waitForMessageType(clientA2, EventTypeNewMessage, 100*time.Millisecond)
	if msg == nil {
		t.Error("clientA2: expected to receive a new_message, but timed out")
	}

	// userB should NOT receive the new_message
	if !hasNoMessageOfType(clientB, EventTypeNewMessage) {
		t.Error("clientB: should not have received a new_message targeted at userA")
	}
}

func TestBroadcastToConversation(t *testing.T) {
	hub := NewHub()

	user1 := uuid.New()
	user2 := uuid.New()
	user3 := uuid.New() // not subscribed
	convID := uuid.New()

	client1 := newTestClient(hub, user1)
	client2 := newTestClient(hub, user2)
	client3 := newTestClient(hub, user3)

	hub.registerClient(client1)
	hub.registerClient(client2)
	hub.registerClient(client3)

	// Wait for async presence broadcasts to settle
	time.Sleep(50 * time.Millisecond)

	// Drain any presence messages
	drainChannel(client1)
	drainChannel(client2)
	drainChannel(client3)

	hub.Subscribe(client1, convID)
	hub.Subscribe(client2, convID)
	// client3 is NOT subscribed

	envelope, err := NewEnvelope(EventTypeNewMessage, map[string]string{"text": "hi conv"})
	if err != nil {
		t.Fatalf("failed to create envelope: %v", err)
	}

	// Broadcast to conversation, no exclusion
	hub.broadcastToConversation(convID, envelope, nil)

	// client1 should receive
	msg := waitForMessageType(client1, EventTypeNewMessage, 100*time.Millisecond)
	if msg == nil {
		t.Error("client1: expected to receive conversation broadcast")
	}

	// client2 should receive
	msg = waitForMessageType(client2, EventTypeNewMessage, 100*time.Millisecond)
	if msg == nil {
		t.Error("client2: expected to receive conversation broadcast")
	}

	// client3 should NOT receive new_message
	if !hasNoMessageOfType(client3, EventTypeNewMessage) {
		t.Error("client3: should not have received conversation broadcast (not subscribed)")
	}
}

func TestBroadcastToConversation_ExcludesSender(t *testing.T) {
	hub := NewHub()

	user1 := uuid.New()
	user2 := uuid.New()
	convID := uuid.New()

	client1 := newTestClient(hub, user1)
	client2 := newTestClient(hub, user2)

	hub.registerClient(client1)
	hub.registerClient(client2)

	// Wait for async presence broadcasts to settle
	time.Sleep(50 * time.Millisecond)

	// Drain any presence messages
	drainChannel(client1)
	drainChannel(client2)

	hub.Subscribe(client1, convID)
	hub.Subscribe(client2, convID)

	envelope, err := NewEnvelope(EventTypeNewMessage, map[string]string{"text": "from client1"})
	if err != nil {
		t.Fatalf("failed to create envelope: %v", err)
	}

	// Broadcast with client1 excluded (they are the sender)
	hub.broadcastToConversation(convID, envelope, client1)

	// client2 should receive
	msg := waitForMessageType(client2, EventTypeNewMessage, 100*time.Millisecond)
	if msg == nil {
		t.Error("client2: expected to receive broadcast")
	}

	// client1 should NOT receive new_message (excluded as sender)
	if !hasNoMessageOfType(client1, EventTypeNewMessage) {
		t.Error("client1 (sender): should not receive their own broadcast")
	}
}

func TestSendToUser_ViaChannel(t *testing.T) {
	hub := NewHub()

	// Start the hub's Run loop in a goroutine
	go hub.Run()

	userID := uuid.New()
	client := newTestClient(hub, userID)

	// Use the register channel as Run() would
	hub.register <- client

	// Give Run() a moment to process registration + presence
	time.Sleep(50 * time.Millisecond)

	// Drain any presence messages
	drainChannel(client)

	envelope, err := NewEnvelope(EventTypePong, nil)
	if err != nil {
		t.Fatalf("failed to create envelope: %v", err)
	}

	// Use the public API which sends to the channel
	hub.SendToUser(userID, envelope)

	// Wait for delivery via Run loop
	msg := waitForMessageType(client, EventTypePong, 500*time.Millisecond)
	if msg == nil {
		t.Error("timed out waiting for message via SendToUser")
	}
}

func TestSendToConversation_ViaChannel(t *testing.T) {
	hub := NewHub()

	go hub.Run()

	user1 := uuid.New()
	user2 := uuid.New()
	convID := uuid.New()
	client1 := newTestClient(hub, user1)
	client2 := newTestClient(hub, user2)

	hub.register <- client1
	hub.register <- client2
	time.Sleep(50 * time.Millisecond)

	// Drain any presence messages
	drainChannel(client1)
	drainChannel(client2)

	hub.Subscribe(client1, convID)
	hub.Subscribe(client2, convID)

	envelope, err := NewEnvelope(EventTypeNewMessage, map[string]string{"text": "channel test"})
	if err != nil {
		t.Fatalf("failed to create envelope: %v", err)
	}

	// Exclude client1 (sender)
	hub.SendToConversation(convID, envelope, client1)

	// client2 should get the message
	msg := waitForMessageType(client2, EventTypeNewMessage, 500*time.Millisecond)
	if msg == nil {
		t.Error("timed out waiting for conversation message via SendToConversation")
	}

	// Give a short window for any stray messages
	time.Sleep(50 * time.Millisecond)

	// client1 (excluded) should not receive new_message
	if !hasNoMessageOfType(client1, EventTypeNewMessage) {
		t.Error("client1 (excluded sender) should not have received the message")
	}
}
