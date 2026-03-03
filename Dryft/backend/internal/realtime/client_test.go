package realtime

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestNewClient_InitialState(t *testing.T) {
	hub := NewHub()
	userID := uuid.New()
	client := NewClient(hub, nil, userID, "test@dryft.site", true, nil, nil)

	if client.UserID != userID {
		t.Fatalf("unexpected user id: %s", client.UserID)
	}
	if client.Email != "test@dryft.site" {
		t.Fatalf("unexpected email: %s", client.Email)
	}
	if cap(client.send) != sendBufferSize {
		t.Fatalf("expected send buffer capacity %d, got %d", sendBufferSize, cap(client.send))
	}
	if len(client.subscriptions) != 0 {
		t.Fatalf("expected no subscriptions on init, got %d", len(client.subscriptions))
	}
}

func TestClientHandleMessage_PingSendsPong(t *testing.T) {
	client := &Client{send: make(chan *Envelope, 1)}
	client.handleMessage(&Envelope{Type: EventTypePing})

	select {
	case env := <-client.send:
		if env.Type != EventTypePong {
			t.Fatalf("expected pong envelope, got %s", env.Type)
		}
	default:
		t.Fatal("expected pong message on send channel")
	}
}

func TestClientHandleMessage_UnknownEventSendsError(t *testing.T) {
	client := &Client{send: make(chan *Envelope, 1)}
	client.handleMessage(&Envelope{Type: EventType("unknown_event")})

	select {
	case env := <-client.send:
		if env.Type != EventTypeError {
			t.Fatalf("expected error envelope, got %s", env.Type)
		}
		var payload ErrorPayload
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			t.Fatalf("unmarshal error payload: %v", err)
		}
		if payload.Code != "unknown_event" {
			t.Fatalf("expected unknown_event code, got %q", payload.Code)
		}
	default:
		t.Fatal("expected error message on send channel")
	}
}

func TestClientSendError_Payload(t *testing.T) {
	client := &Client{send: make(chan *Envelope, 1)}
	client.sendError("invalid_payload", "bad json")

	env := <-client.send
	if env.Type != EventTypeError {
		t.Fatalf("expected error envelope, got %s", env.Type)
	}

	var payload ErrorPayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		t.Fatalf("unmarshal payload: %v", err)
	}
	if payload.Code != "invalid_payload" || payload.Message != "bad json" {
		t.Fatalf("unexpected payload: %+v", payload)
	}
}

func TestClientHandleTypingStart_RequiresSubscription(t *testing.T) {
	convID := uuid.New()
	payload, err := json.Marshal(TypingPayload{ConversationID: convID})
	if err != nil {
		t.Fatalf("marshal typing payload: %v", err)
	}

	client := &Client{
		subscriptions: make(map[uuid.UUID]bool),
		send:          make(chan *Envelope, 1),
	}
	client.handleTypingStart(payload)

	if client.typingConversation != nil {
		t.Fatal("expected typingConversation to remain nil when not subscribed")
	}
}

func TestClientHandleUnsubscribe_RemovesSubscription(t *testing.T) {
	hub := NewHub()
	userID := uuid.New()
	convID := uuid.New()

	client := &Client{
		hub:           hub,
		UserID:        userID,
		subscriptions: make(map[uuid.UUID]bool),
		send:          make(chan *Envelope, 2),
	}

	hub.registerClient(client)
	hub.Subscribe(client, convID)

	payload, err := json.Marshal(SubscribePayload{ConversationID: convID})
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	client.handleUnsubscribe(payload)

	if client.subscriptions[convID] {
		t.Fatal("expected conversation to be removed from subscriptions")
	}
}

func TestClientHandleTypingStop_ClearsTypingAndBroadcastsStop(t *testing.T) {
	hub := NewHub()
	convID := uuid.New()
	senderID := uuid.New()
	receiverID := uuid.New()

	sender := &Client{
		hub:           hub,
		UserID:        senderID,
		subscriptions: map[uuid.UUID]bool{convID: true},
		send:          make(chan *Envelope, 4),
	}
	receiver := newTestClient(hub, receiverID)

	hub.registerClient(sender)
	hub.registerClient(receiver)
	hub.Subscribe(sender, convID)
	hub.Subscribe(receiver, convID)
	drainChannel(sender)
	drainChannel(receiver)

	sender.typingConversation = &convID
	sender.typingTimer = time.NewTimer(time.Minute)

	payload, err := json.Marshal(TypingPayload{ConversationID: convID})
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	sender.handleTypingStop(payload)

	// Process queued conversation broadcast synchronously in test.
	select {
	case msg := <-hub.convBroadcast:
		hub.broadcastToConversation(msg.ConversationID, msg.Message, msg.ExcludeClient)
	case <-time.After(time.Second):
		t.Fatal("expected typing stop broadcast")
	}

	if sender.typingConversation != nil {
		t.Fatal("expected typing conversation to be cleared")
	}
	if sender.typingTimer != nil {
		t.Fatal("expected typing timer to be cleared")
	}

	env := waitForMessageType(receiver, EventTypeTypingIndicator, time.Second)
	if env == nil {
		t.Fatal("expected typing indicator for receiver")
	}
	var indicator TypingIndicatorPayload
	if err := json.Unmarshal(env.Payload, &indicator); err != nil {
		t.Fatalf("unmarshal typing indicator: %v", err)
	}
	if indicator.IsTyping {
		t.Fatalf("expected stop-typing indicator, got %+v", indicator)
	}
}

func TestClientHandleCallSignal_InvalidPayloadSendsError(t *testing.T) {
	client := &Client{send: make(chan *Envelope, 2)}
	client.handleCallSignal(EventTypeCallOffer, json.RawMessage(`{invalid`))

	env := <-client.send
	if env.Type != EventTypeError {
		t.Fatalf("expected error envelope, got %s", env.Type)
	}
}

func TestClientHandleCallSignal_RoutesToTargetUser(t *testing.T) {
	hub := NewHub()
	caller := newTestClient(hub, uuid.New())
	targetID := uuid.New()
	target := newTestClient(hub, targetID)
	hub.registerClient(caller)
	hub.registerClient(target)
	drainChannel(caller)
	drainChannel(target)

	payload, err := json.Marshal(CallSignalPayload{
		CallID:       "call-123",
		TargetUserID: targetID,
		Reason:       "ended",
	})
	if err != nil {
		t.Fatalf("marshal call payload: %v", err)
	}

	caller.handleCallSignal(EventTypeCallEnd, payload)

	select {
	case msg := <-hub.userBroadcast:
		hub.broadcastToUser(msg.UserID, msg.Message)
	case <-time.After(time.Second):
		t.Fatal("expected routed user message")
	}

	env := waitForMessageType(target, EventTypeCallEnd, time.Second)
	if env == nil {
		t.Fatal("expected call_end event for target user")
	}
}

func TestRealtimeTimingConstants(t *testing.T) {
	if pingPeriod >= pongWait {
		t.Fatalf("expected pingPeriod (%s) to be less than pongWait (%s)", pingPeriod, pongWait)
	}
	if maxMessageSize <= 0 {
		t.Fatalf("expected positive maxMessageSize, got %d", maxMessageSize)
	}
}
